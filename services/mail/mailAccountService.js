/**
 * Command handlers cho quản lý mailbox (admin) + đồng bộ thủ công.
 *
 * Đăng ký tự động qua `services/dbCommandHandlers.js` (spread module này).
 * Envelope thống nhất: { tk_status:"OK", data } | { tk_status:"NG", code, message }.
 *
 * Phân quyền: KHÔNG có role model trong ERP ⇒ dùng chức danh (`JOB_NAME`) +
 * whitelist EMPL_NO (như `permissionService` phía FE). Cấu hình qua env
 * `MAIL_ADMIN_JOBNAMES` (mặc định "Admin,ADMIN,Leader") và `MAIL_ADMIN_EMPL_NOS`.
 */
const mailRepo = require("./mailRepository");
const mailCrypto = require("./mailCrypto");
const { syncMailbox, testConnection } = require("./mailIngest");

const ADMIN_EMPL_NOS = new Set(
  String(process.env.MAIL_ADMIN_EMPL_NOS || "NHU1903,NVH1011")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean)
);
const ADMIN_JOBNAMES = new Set(
  String(process.env.MAIL_ADMIN_JOBNAMES || "Admin,ADMIN,Leader")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

function ok(res, data) {
  res.send({ tk_status: "OK", data });
}
function fail(res, message, code) {
  res.send({ tk_status: "NG", code, message });
}

function isMailAdmin(req) {
  const p = req.payload_data || {};
  const empl = String(p.EMPL_NO || "").trim().toUpperCase();
  if (ADMIN_EMPL_NOS.has(empl)) return true;
  const job = String(p.JOB_NAME || "").trim();
  return ADMIN_JOBNAMES.has(job) || ADMIN_JOBNAMES.has(job.toUpperCase());
}

function ctx(req) {
  const p = req.payload_data || {};
  return { ctrCd: p.CTR_CD, emplNo: String(p.EMPL_NO || "").trim().toUpperCase() };
}

function requireAdmin(req, res) {
  if (!isMailAdmin(req)) {
    fail(res, "Bạn không có quyền quản lý Email", "FORBIDDEN");
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* CRUD mailbox                                                        */
/* ------------------------------------------------------------------ */

exports.emailAccountList = async (req, res, DATA = {}) => {
  try {
    const { ctrCd } = ctx(req);
    const isAdmin = isMailAdmin(req);
    // Người thường chỉ thấy mailbox của mình; admin thấy tất cả.
    const emplNo = isAdmin && DATA.all ? null : ctx(req).emplNo;
    const rows = await mailRepo.listAccounts({ ctrCd, activeOnly: !!DATA.activeOnly, emplNo });
    ok(res, rows);
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailAccountCreate = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { ctrCd } = ctx(req);
    const email = String(DATA.EMAIL_ADDRESS || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(res, "Địa chỉ email không hợp lệ", "INVALID_EMAIL");
    }
    if (!DATA.POP3_HOST) return fail(res, "Thiếu POP3 host", "INVALID");
    const existing = await mailRepo.findAccountByEmail({ ctrCd, emailAddress: email });
    if (existing) return fail(res, "Mailbox này đã tồn tại", "DUPLICATE");

    const id = await mailRepo.insertAccount({
      ctrCd,
      emplNo: DATA.EMPL_NO ? String(DATA.EMPL_NO).trim().toUpperCase() : null,
      emailAddress: email,
      displayName: DATA.DISPLAY_NAME || null,
      pop3Host: DATA.POP3_HOST,
      pop3Port: Number(DATA.POP3_PORT) || (DATA.POP3_SECURE ? 995 : 110),
      pop3Secure: DATA.POP3_SECURE !== false,
      pop3Username: DATA.POP3_USERNAME || email,
      pop3CredEnc: DATA.POP3_PASSWORD ? mailCrypto.encryptSecret(DATA.POP3_PASSWORD) : null,
      smtpHost: DATA.SMTP_HOST || DATA.POP3_HOST,
      smtpPort: Number(DATA.SMTP_PORT) || 587,
      smtpSecure: DATA.SMTP_SECURE !== false,
      smtpUsername: DATA.SMTP_USERNAME || DATA.POP3_USERNAME || email,
      isActive: DATA.IS_ACTIVE !== false,
      isShared: !!DATA.IS_SHARED,
    });
    await mailRepo.ensureCheckpoint(id);
    ok(res, { id });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailAccountUpdate = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID mailbox", "INVALID");
    const fields = {
      emplNo: DATA.EMPL_NO !== undefined ? (DATA.EMPL_NO ? String(DATA.EMPL_NO).trim().toUpperCase() : null) : undefined,
      displayName: DATA.DISPLAY_NAME,
      pop3Host: DATA.POP3_HOST,
      pop3Port: DATA.POP3_PORT !== undefined ? Number(DATA.POP3_PORT) : undefined,
      pop3Secure: DATA.POP3_SECURE,
      pop3Username: DATA.POP3_USERNAME,
      smtpHost: DATA.SMTP_HOST,
      smtpPort: DATA.SMTP_PORT !== undefined ? Number(DATA.SMTP_PORT) : undefined,
      smtpSecure: DATA.SMTP_SECURE,
      smtpUsername: DATA.SMTP_USERNAME,
      isActive: DATA.IS_ACTIVE,
      isShared: DATA.IS_SHARED,
    };
    // Chỉ cập nhật credential khi có mật khẩu mới.
    if (DATA.POP3_PASSWORD) fields.pop3CredEnc = mailCrypto.encryptSecret(DATA.POP3_PASSWORD);
    if (DATA.SMTP_PASSWORD) fields.smtpCredEnc = mailCrypto.encryptSecret(DATA.SMTP_PASSWORD);

    await mailRepo.updateAccount(id, fields);
    ok(res, { id });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailAccountToggle = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID mailbox", "INVALID");
    await mailRepo.setAccountActive(id, DATA.IS_ACTIVE !== false);
    ok(res, { id, isActive: DATA.IS_ACTIVE !== false });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailAccountTest = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID mailbox", "INVALID");
    const account = await mailRepo.getAccountWithCredentials(id);
    if (!account) return fail(res, "Không tìm thấy mailbox", "NOT_FOUND");
    const result = await testConnection(account);
    if (!result.ok) return fail(res, result.message, "CONNECT_FAILED");
    ok(res, { message: result.message });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailAccountReset = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID mailbox", "INVALID");
    await mailRepo.resetCheckpoint(id);
    ok(res, { id });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Đồng bộ                                                             */
/* ------------------------------------------------------------------ */

exports.emailSyncNow = async (req, res, DATA = {}) => {
  try {
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID mailbox", "INVALID");
    const account = await mailRepo.getAccountById(id);
    if (!account) return fail(res, "Không tìm thấy mailbox", "NOT_FOUND");

    // Không chờ: trả về ngay, worker chạy nền (tránh treo HTTP request).
    const isAdmin = isMailAdmin(req);
    const { emplNo } = ctx(req);
    if (!isAdmin && account.EMPL_NO && String(account.EMPL_NO).trim().toUpperCase() !== emplNo) {
      return fail(res, "Bạn không có quyền đồng bộ mailbox này", "FORBIDDEN");
    }
    syncMailbox(id, { manual: true })
      .then((r) => console.log(`[mail] manual sync acc=${id} =>`, r))
      .catch((e) => console.error(`[mail] manual sync acc=${id} lỗi:`, e?.message || e));
    ok(res, { id, started: true });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailSyncLogList = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID mailbox", "INVALID");
    const rows = await mailRepo.listSyncLogs({ accountId: id, limit: DATA.limit || 50 });
    ok(res, rows);
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};
