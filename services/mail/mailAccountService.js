/**
 * Command handlers cho quản lý mailbox (admin) + đồng bộ thủ công.
 *
 * Đăng ký tự động qua `services/dbCommandHandlers.js` (spread module này).
 * Envelope thống nhất: { tk_status:"OK", data } | { tk_status:"NG", code, message }.
 *
 * Phân quyền: module Email KHÔNG dùng chức danh (`JOB_NAME`) — quyền QUẢN TRỊ Email
 * chỉ dành cho các EMPL_NO trong `MAIL_ADMIN_EMPL_NOS` (mặc định: **chỉ NHU1903**).
 * Mọi nhân viên khác chỉ dùng được hộp thư của mình.
 */
const mailRepo = require("./mailRepository");
const mailCrypto = require("./mailCrypto");
const { syncMailbox, testConnection } = require("./mailIngest");
const mailSendTest = require("./mailSendService");

const ADMIN_EMPL_NOS = new Set(
  String(process.env.MAIL_ADMIN_EMPL_NOS || "NHU1903")
    .split(",")
    .map((v) => v.trim().toUpperCase())
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
  return ADMIN_EMPL_NOS.has(empl);
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

/** Tự-cấu-hình có được bật không (admin có thể tắt bằng env `MAIL_ALLOW_SELF_SERVICE`). */
function isSelfServiceEnabled() {
  return String(process.env.MAIL_ALLOW_SELF_SERVICE || "true") !== "false";
}

/** Chặn các thao tác tự-cấu-hình khi admin đã tắt. */
function requireSelfService(res) {
  if (isSelfServiceEnabled()) return true;
  fail(res, "Quản trị viên đã tắt tự cấu hình email. Vui lòng liên hệ bộ phận IT.", "SELF_SERVICE_DISABLED");
  return false;
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
      smtpPort: Number(DATA.SMTP_PORT) || (DATA.SMTP_SECURE !== false ? 465 : 25),
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

/* ================================================================== */
/* SELF-SERVICE: mỗi nhân viên tự cấu hình mailbox CỦA MÌNH            */
/* Không cần quyền admin. Chỉ thao tác trên mailbox có EMPL_NO = self. */
/* ================================================================== */

/** Map row account ⇒ object an toàn cho FE (KHÔNG bao giờ trả credential). */
function mapAccountSafe(row) {
  if (!row) return null;
  return {
    id: row.ID,
    emailAddress: row.EMAIL_ADDRESS,
    displayName: row.DISPLAY_NAME,
    pop3Host: row.POP3_HOST,
    pop3Port: row.POP3_PORT,
    pop3Secure: row.POP3_SECURE === true || row.POP3_SECURE === 1,
    pop3Username: row.POP3_USERNAME,
    smtpHost: row.SMTP_HOST,
    smtpPort: row.SMTP_PORT,
    smtpSecure: row.SMTP_SECURE === true || row.SMTP_SECURE === 1,
    smtpUsername: row.SMTP_USERNAME,
    isActive: row.IS_ACTIVE === true || row.IS_ACTIVE === 1,
    lastSyncAt: row.LAST_SYNC_AT,
    lastSyncStatus: row.LAST_SYNC_STATUS,
    lastError: row.LAST_ERROR,
    hasPassword: !!row.POP3_CRED_ENC,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lấy cấu hình mailbox của chính người dùng (để điền vào form). */
exports.emailMyAccount = async (req, res) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    if (!emplNo) return fail(res, "Không xác định được nhân sự", "UNAUTHORIZED");
    const found = await mailRepo.getAccountByEmpl({ ctrCd, emplNo });
    const full = found ? await mailRepo.getAccountWithCredentials(found.ID) : null;
    ok(res, { account: mapAccountSafe(full) });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Tạo/cập nhật mailbox của chính người dùng (upsert theo EMPL_NO). */
exports.emailSaveMyAccount = async (req, res, DATA = {}) => {
  if (!requireSelfService(res)) return;
  try {
    const { ctrCd, emplNo } = ctx(req);
    if (!emplNo) return fail(res, "Không xác định được nhân sự", "UNAUTHORIZED");

    const email = String(DATA.EMAIL_ADDRESS || "").trim();
    if (!email || !EMAIL_RE.test(email)) return fail(res, "Địa chỉ email không hợp lệ", "INVALID_EMAIL");
    const host = String(DATA.POP3_HOST || "").trim();
    if (!host) return fail(res, "Thiếu máy chủ POP3", "INVALID");
    const secure = DATA.POP3_SECURE !== false;
    const port = Number(DATA.POP3_PORT) || (secure ? 995 : 110);

    const existing = await mailRepo.getAccountByEmpl({ ctrCd, emplNo });

    // Nếu đổi địa chỉ email mà trùng mailbox khác ⇒ chặn.
    const clash = await mailRepo.findAccountByEmail({ ctrCd, emailAddress: email });
    if (clash && (!existing || clash.ID !== existing.ID)) {
      return fail(res, "Địa chỉ email này đã được dùng cho mailbox khác", "DUPLICATE");
    }

    const fields = {
      emplNo,
      displayName: DATA.DISPLAY_NAME || null,
      pop3Host: host,
      pop3Port: port,
      pop3Secure: secure,
      pop3Username: String(DATA.POP3_USERNAME || email).trim(),
      smtpHost: String(DATA.SMTP_HOST || host).trim(),
      // ⚠️ 587 thường bị chặn ở mạng nội bộ ⇒ mặc định KHÔNG SSL dùng 25.
      smtpPort: Number(DATA.SMTP_PORT) || (DATA.SMTP_SECURE !== false ? 465 : 25),
      smtpSecure: DATA.SMTP_SECURE !== false,
      smtpUsername: String(DATA.SMTP_USERNAME || DATA.POP3_USERNAME || email).trim(),
      isActive: DATA.IS_ACTIVE !== false,
    };
    // Chỉ cập nhật mật khẩu khi người dùng nhập mới (ô trống = giữ nguyên).
    if (DATA.POP3_PASSWORD) fields.pop3CredEnc = mailCrypto.encryptSecret(DATA.POP3_PASSWORD);
    if (DATA.SMTP_PASSWORD) fields.smtpCredEnc = mailCrypto.encryptSecret(DATA.SMTP_PASSWORD);

    let id;
    if (existing) {
      await mailRepo.updateAccount(existing.ID, fields);
      id = existing.ID;
    } else {
      if (!DATA.POP3_PASSWORD) return fail(res, "Cần nhập mật khẩu POP3 cho lần cấu hình đầu tiên", "INVALID");
      fields.emailAddress = email;
      id = await mailRepo.insertAccount({ ctrCd, ...fields });
      await mailRepo.ensureCheckpoint(id);
    }
    ok(res, { id });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Test kết nối POP3 + SMTP cho mailbox của chính người dùng (tham số form hoặc cấu hình đã lưu). */
exports.emailTestMyAccount = async (req, res, DATA = {}) => {
  if (!requireSelfService(res)) return;
  try {
    const { ctrCd, emplNo } = ctx(req);
    if (!emplNo) return fail(res, "Không xác định được nhân sự", "UNAUTHORIZED");

    let account = await mailRepo.getAccountByEmpl({ ctrCd, emplNo });
    if (account) account = await mailRepo.getAccountWithCredentials(account.ID);

    // Cho phép test bằng tham số vừa nhập trên form (chưa lưu), ghi đè cấu hình đã lưu.
    if (DATA.POP3_HOST) {
      const secure = DATA.POP3_SECURE !== false;
      account = {
        ...(account || {}),
        POP3_HOST: String(DATA.POP3_HOST).trim(),
        POP3_PORT: Number(DATA.POP3_PORT) || (secure ? 995 : 110),
        POP3_SECURE: secure,
        POP3_USERNAME: String(DATA.POP3_USERNAME || DATA.EMAIL_ADDRESS || "").trim(),
        EMAIL_ADDRESS: DATA.EMAIL_ADDRESS || account?.EMAIL_ADDRESS,
        POP3_CRED_ENC: DATA.POP3_PASSWORD
          ? mailCrypto.encryptSecret(DATA.POP3_PASSWORD)
          : account?.POP3_CRED_ENC,
      };
    }
    if (!account?.POP3_HOST) return fail(res, "Chưa có cấu hình POP3 để kiểm tra", "NO_CONFIG");

    const pop3 = await testConnection(account);

    // Test thêm SMTP (nhiều nơi chặn cổng SMTP ⇒ cần biết rõ).
    let smtp = { ok: false, message: "Chưa cấu hình SMTP" };
    const smtpHost = String(DATA.SMTP_HOST || account.SMTP_HOST || account.POP3_HOST || "").trim();
    if (smtpHost) {
      const secure = DATA.SMTP_SECURE !== undefined
        ? DATA.SMTP_SECURE !== false
        : account.SMTP_SECURE === true || account.SMTP_SECURE === 1;
      const password = DATA.SMTP_PASSWORD
        ? String(DATA.SMTP_PASSWORD)
        : account.SMTP_CRED_ENC
          ? mailCrypto.decryptSecret(account.SMTP_CRED_ENC)
          : mailCrypto.decryptSecret(account.POP3_CRED_ENC);
      smtp = await mailSendTest.testSmtpConfig({
        host: smtpHost,
        port: Number(DATA.SMTP_PORT) || Number(account.SMTP_PORT) || (secure ? 465 : 25),
        secure,
        username: String(DATA.SMTP_USERNAME || account.SMTP_USERNAME || account.POP3_USERNAME || "").trim(),
        password,
      });
    }

    ok(res, {
      message: pop3.message,
      pop3,
      smtp,
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Xoá cấu hình mailbox của chính người dùng (chỉ khi CHƯA có email nào để tránh mất dữ liệu). */
exports.emailDeleteMyAccount = async (req, res) => {
  if (!requireSelfService(res)) return;
  try {
    const { ctrCd, emplNo } = ctx(req);
    if (!emplNo) return fail(res, "Không xác định được nhân sự", "UNAUTHORIZED");
    const account = await mailRepo.getAccountByEmpl({ ctrCd, emplNo });
    if (!account) return fail(res, "Chưa có cấu hình mailbox", "NO_CONFIG");
    const count = await mailRepo.queryRows(
      `SELECT COUNT(*) AS C FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ID`,
      { ID: account.ID }
    );
    if (Number(count[0]?.C || 0) > 0) {
      return fail(res, "Mailbox đã có email — hãy tắt (bỏ tích hoạt động) thay vì xoá.", "HAS_MESSAGES");
    }
    await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @ID`, { ID: account.ID });
    await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: account.ID });
    ok(res, { id: account.ID });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};
