/**
 * Command handlers ADMIN cho module Email (Phase 8).
 *  - `emailAdminOverview`    — bảng mailbox kèm số liệu (số email/đính kèm/dung lượng/chưa đọc/lỗi sync)
 *  - `emailStorageDashboard` — tổng quan dung lượng: tổng, theo nhân viên, theo năm, tăng trưởng 14 ngày
 *  - `emailStorageByEmployee`— chi tiết dung lượng theo từng nhân viên
 *  - `emailReconcileNow`     — chạy đối soát DB ↔ file trên NAS ngay (kiểm tra toàn vẹn)
 *
 * Phân quyền: quyền QUẢN TRỊ Email chỉ dành cho EMPL_NO trong `MAIL_ADMIN_EMPL_NOS`
 * (mặc định: **chỉ NHU1903**) — KHÔNG dùng `JOB_NAME`/role model khác.
 */
const mailRepo = require("./mailRepository");
const { reconcile } = require("./mailReconcile");
const { syncMailbox } = require("./mailIngest");
const { isMailAdmin } = require("./mailAdminRule");

function ok(res, data) {
  res.send({ tk_status: "OK", data });
}
function fail(res, message, code) {
  res.send({ tk_status: "NG", code, message });
}

function requireAdmin(req, res) {
  if (!isMailAdmin(req)) {
    fail(res, "Bạn không có quyền quản lý Email", "FORBIDDEN");
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Truy vấn dùng chung                                                 */
/* ------------------------------------------------------------------ */

/**
 * Bảng mailbox kèm số liệu tổng hợp.
 *
 * Dùng OUTER APPLY (thay vì JOIN + GROUP BY) để KHÔNG nhân dòng khi đếm nhiều bảng,
 * và `TOP 1` khi lấy tên nhân viên vì ZTBEMPLINFO có thể có nhiều dòng cho 1 EMPL_NO.
 */
async function loadMailboxStats({ ctrCd, limit = 500 }) {
  return mailRepo.queryRows(
    `SELECT TOP (@LIMIT)
        a.ID, a.EMPL_NO, a.EMAIL_ADDRESS, a.DISPLAY_NAME,
        a.POP3_HOST, a.POP3_PORT, a.POP3_SECURE, a.SMTP_HOST, a.SMTP_PORT, a.SMTP_SECURE,
        a.IS_ACTIVE, a.IS_SHARED, a.SYNC_FROM_DATE, a.SYNC_TO_DATE, a.LAST_SYNC_AT, a.LAST_SYNC_STATUS, a.LAST_ERROR,
        LTRIM(RTRIM(ISNULL(emp.LAST_NAME, '') + ' ' + ISNULL(emp.FIRST_NAME, ''))) AS EMPL_NAME,
        ck.LAST_UIDL, ck.IN_PROGRESS, ck.LOCKED_AT, ck.SERVER_TOTAL,
        ISNULL(msg.CNT, 0) AS MESSAGE_COUNT,
        ISNULL(msg.BYTES, 0) AS MESSAGE_BYTES,
        ISNULL(att.CNT, 0) AS ATTACHMENT_COUNT,
        ISNULL(att.BYTES, 0) AS ATTACHMENT_BYTES,
        ISNULL(unread.CNT, 0) AS UNREAD_COUNT,
        ISNULL(sk.CNT, 0) AS SKIPPED_COUNT
     FROM ZTB_MAIL_ACCOUNT a
     OUTER APPLY (
        SELECT TOP 1 MIDLAST_NAME AS LAST_NAME, FIRST_NAME
        FROM ZTBEMPLINFO WHERE LTRIM(RTRIM(EMPL_NO)) = LTRIM(RTRIM(a.EMPL_NO))
        ORDER BY CMS_ID
     ) emp
     LEFT JOIN ZTB_MAIL_SYNC_CHECKPOINT ck ON ck.MAIL_ACCOUNT_ID = a.ID
     OUTER APPLY (
        SELECT COUNT(*) AS CNT, ISNULL(SUM(ISNULL(m.SIZE_BYTES, 0)), 0) AS BYTES
        FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID = a.ID
     ) msg
     OUTER APPLY (
        SELECT COUNT(*) AS CNT, ISNULL(SUM(ISNULL(x.FILE_SIZE, 0)), 0) AS BYTES
        FROM ZTB_MAIL_ATTACHMENT x
        JOIN ZTB_MAIL_MESSAGE m2 ON m2.ID = x.MESSAGE_ID
        WHERE m2.MAIL_ACCOUNT_ID = a.ID
     ) att
     OUTER APPLY (
        SELECT COUNT(*) AS CNT FROM ZTB_MAIL_MESSAGE m3
        WHERE m3.MAIL_ACCOUNT_ID = a.ID AND ISNULL(m3.IS_READ, 0) = 0
     ) unread
     OUTER APPLY (
        SELECT COUNT(*) AS CNT FROM ZTB_MAIL_SYNC_SKIP s WHERE s.MAIL_ACCOUNT_ID = a.ID
     ) sk
     WHERE a.CTR_CD = @CTR
     ORDER BY a.IS_ACTIVE DESC, a.EMPL_NO, a.EMAIL_ADDRESS`,
    { CTR: ctrCd, LIMIT: Math.min(Math.max(Number(limit) || 500, 1), 2000) }
  );
}

/** Map 1 dòng thống kê ⇒ object cho FE (không chứa credential). */
function mapMailboxStat(row) {
  const messageBytes = Number(row.MESSAGE_BYTES || 0);
  const attachmentBytes = Number(row.ATTACHMENT_BYTES || 0);
  const serverTotal = Number(row.SERVER_TOTAL || 0);
  const messageCount = Number(row.MESSAGE_COUNT || 0);
  return {
    id: row.ID,
    emplNo: row.EMPL_NO ? String(row.EMPL_NO).trim().toUpperCase() : null,
    emplName: row.EMPL_NAME || null,
    emailAddress: row.EMAIL_ADDRESS,
    displayName: row.DISPLAY_NAME,
    pop3Host: row.POP3_HOST,
    pop3Port: row.POP3_PORT,
    pop3Secure: row.POP3_SECURE === true || row.POP3_SECURE === 1,
    smtpHost: row.SMTP_HOST,
    smtpPort: row.SMTP_PORT,
    smtpSecure: row.SMTP_SECURE === true || row.SMTP_SECURE === 1,
    isActive: row.IS_ACTIVE === true || row.IS_ACTIVE === 1,
    isShared: row.IS_SHARED === true || row.IS_SHARED === 1,
    syncFromDate: row.SYNC_FROM_DATE || null,
    syncToDate: row.SYNC_TO_DATE || null,
    skippedCount: Number(row.SKIPPED_COUNT || 0),
    lastSyncAt: row.LAST_SYNC_AT,
    lastSyncStatus: row.LAST_SYNC_STATUS,
    lastError: row.LAST_ERROR,
    inProgress: row.IN_PROGRESS === true || row.IN_PROGRESS === 1,
    lockedAt: row.LOCKED_AT,
    lastUidl: row.LAST_UIDL,
    serverTotal,
    messageCount,
    // serverTotal = 0 khi server không trả STAT ⇒ không báo "còn thiếu" sai.
    pending: serverTotal > 0 ? Math.max(0, serverTotal - messageCount) : 0,
    unreadCount: Number(row.UNREAD_COUNT || 0),
    attachmentCount: Number(row.ATTACHMENT_COUNT || 0),
    messageBytes,
    attachmentBytes,
    storageBytes: messageBytes + attachmentBytes,
  };
}

/** Tổng hợp số liệu + danh sách theo nhân viên từ bảng mailbox. */
function summarize(mailboxes) {
  const totals = mailboxes.reduce(
    (acc, box) => ({
      mailboxCount: acc.mailboxCount + 1,
      activeMailboxCount: acc.activeMailboxCount + (box.isActive ? 1 : 0),
      errorMailboxCount: acc.errorMailboxCount + (box.lastSyncStatus === "ERROR" ? 1 : 0),
      messageCount: acc.messageCount + box.messageCount,
      attachmentCount: acc.attachmentCount + box.attachmentCount,
      unreadCount: acc.unreadCount + box.unreadCount,
      storageBytes: acc.storageBytes + box.storageBytes,
      pending: acc.pending + box.pending,
    }),
    {
      mailboxCount: 0,
      activeMailboxCount: 0,
      errorMailboxCount: 0,
      messageCount: 0,
      attachmentCount: 0,
      unreadCount: 0,
      storageBytes: 0,
      pending: 0,
    }
  );

  const byEmployeeMap = new Map();
  for (const box of mailboxes) {
    const key = box.emplNo || "__shared__";
    const current = byEmployeeMap.get(key) || {
      emplNo: box.emplNo,
      emplName: box.emplName,
      mailboxCount: 0,
      messageCount: 0,
      attachmentCount: 0,
      unreadCount: 0,
      storageBytes: 0,
    };
    current.mailboxCount += 1;
    current.messageCount += box.messageCount;
    current.attachmentCount += box.attachmentCount;
    current.unreadCount += box.unreadCount;
    current.storageBytes += box.storageBytes;
    if (!current.emplName && box.emplName) current.emplName = box.emplName;
    byEmployeeMap.set(key, current);
  }
  const byEmployee = [...byEmployeeMap.values()].sort((a, b) => b.storageBytes - a.storageBytes);
  return { totals, byEmployee };
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

/** Bảng quản trị mailbox + số liệu tổng (dùng cho trang admin). */
exports.emailAdminOverview = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const ctrCd = (req.payload_data || {}).CTR_CD;
    const rows = await loadMailboxStats({ ctrCd, limit: DATA.limit || 500 });
    const mailboxes = rows.map(mapMailboxStat);
    const { totals, byEmployee } = summarize(mailboxes);
    ok(res, { mailboxes, totals, byEmployee });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Dashboard dung lượng: tổng + theo năm + tăng trưởng 14 ngày + file vật lý (đã dedup). */
exports.emailStorageDashboard = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const ctrCd = (req.payload_data || {}).CTR_CD;
    const rows = await loadMailboxStats({ ctrCd, limit: DATA.limit || 500 });
    const mailboxes = rows.map(mapMailboxStat);
    const { totals, byEmployee } = summarize(mailboxes);

    // File vật lý trên NAS luôn ≤ tổng đính kèm vì dedup theo SHA-256.
    const physical = await mailRepo.queryOne(
      `SELECT COUNT(*) AS PHYSICAL_FILES, ISNULL(SUM(ISNULL(FILE_SIZE, 0)), 0) AS PHYSICAL_BYTES,
              SUM(CASE WHEN ISNULL(REF_COUNT, 0) <= 0 THEN 1 ELSE 0 END) AS ORPHAN_FILES
       FROM ZTB_MAIL_PHYSICAL_FILE`
    );

    const byYear = await mailRepo.queryRows(
      `SELECT YEAR(m.RECEIVED_AT) AS YEAR, COUNT(*) AS MESSAGE_COUNT,
              ISNULL(SUM(ISNULL(m.SIZE_BYTES, 0)), 0) AS BYTES
       FROM ZTB_MAIL_MESSAGE m
       JOIN ZTB_MAIL_ACCOUNT a ON a.ID = m.MAIL_ACCOUNT_ID
       WHERE a.CTR_CD = @CTR AND m.RECEIVED_AT IS NOT NULL
       GROUP BY YEAR(m.RECEIVED_AT)
       ORDER BY YEAR DESC`,
      { CTR: ctrCd }
    );

    const growth = await mailRepo.queryRows(
      `SELECT CAST(m.RECEIVED_AT AS DATE) AS DAY, COUNT(*) AS MESSAGE_COUNT
       FROM ZTB_MAIL_MESSAGE m
       JOIN ZTB_MAIL_ACCOUNT a ON a.ID = m.MAIL_ACCOUNT_ID
       WHERE a.CTR_CD = @CTR AND m.RECEIVED_AT >= DATEADD(day, -13, CAST(GETDATE() AS DATE))
       GROUP BY CAST(m.RECEIVED_AT AS DATE)
       ORDER BY DAY`,
      { CTR: ctrCd }
    );

    ok(res, {
      totals: {
        ...totals,
        physicalFiles: Number(physical?.PHYSICAL_FILES || 0),
        physicalBytes: Number(physical?.PHYSICAL_BYTES || 0),
        orphanFiles: Number(physical?.ORPHAN_FILES || 0),
        // Tiết kiệm nhờ dedup = tổng đính kèm trừ dung lượng file thật (≥ 0).
        dedupSavedBytes: Math.max(0, totals.storageBytes - Number(physical?.PHYSICAL_BYTES || 0)),
      },
      byEmployee,
      byYear: byYear.map((r) => ({ year: r.YEAR, messageCount: Number(r.MESSAGE_COUNT || 0), bytes: Number(r.BYTES || 0) })),
      growth: growth.map((r) => ({ day: r.DAY, messageCount: Number(r.MESSAGE_COUNT || 0) })),
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Chi tiết dung lượng theo nhân viên (kèm danh sách mailbox của họ). */
exports.emailStorageByEmployee = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const ctrCd = (req.payload_data || {}).CTR_CD;
    const rows = await loadMailboxStats({ ctrCd, limit: DATA.limit || 500 });
    const mailboxes = rows.map(mapMailboxStat);
    const { byEmployee } = summarize(mailboxes);
    const employees = byEmployee.map((emp) => ({
      ...emp,
      mailboxes: mailboxes
        .filter((box) => (box.emplNo || "__shared__") === (emp.emplNo || "__shared__"))
        .map((box) => ({
          id: box.id,
          emailAddress: box.emailAddress,
          isActive: box.isActive,
          messageCount: box.messageCount,
          attachmentCount: box.attachmentCount,
          storageBytes: box.storageBytes,
        })),
    }));
    ok(res, { employees });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Chạy đối soát DB ↔ NAS ngay: đếm lại REF_COUNT, dọn file mồ côi, đánh dấu file thiếu. */
exports.emailReconcileNow = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await reconcile({ limit: 1000 });
    ok(res, result);
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Nhập hàng loạt tài khoản email từ Excel (Phase 8 mở rộng)           */
/* ------------------------------------------------------------------ */

const mailCrypto = require("./mailCrypto");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMPORT_ROWS = 2000;

/** Chuẩn hoá tên cột: bỏ dấu, bỏ ký tự đặc biệt, viết hoa ("Mã NV" → "MANV"). */
function normalizeKey(key) {
  return String(key ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

/** Bảng tra cột của 1 dòng Excel theo tên đã chuẩn hoá. */
function buildRowMap(row) {
  const map = new Map();
  if (!row || typeof row !== "object") return map;
  Object.keys(row).forEach((key) => map.set(normalizeKey(key), row[key]));
  return map;
}

/**
 * Lấy giá trị theo danh sách tên cột (đã chuẩn hoá).
 * Ưu tiên khớp CHÍNH XÁC, sau đó mới khớp tiền tố (để "MÁY CHỦ POP3" khớp "MÁY CHỦ",
 * nhưng chỉ áp dụng cho tên cột dài ≥ 5 ký tự để tránh nhầm trường).
 */
function pick(map, aliases) {
  for (const alias of aliases) {
    const key = normalizeKey(alias);
    const value = map.get(key);
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  for (const alias of aliases) {
    const prefix = normalizeKey(alias);
    if (prefix.length < 5) continue;
    for (const [key, value] of map.entries()) {
      if (key.startsWith(prefix) && value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return "";
}

/** Đọc giá trị boolean từ Excel (TRUE/1/x/Có/Yes…). */
function pickBool(map, aliases, fallback) {
  const raw = pick(map, aliases);
  if (!raw) return fallback;
  const value = normalizeKey(raw).toLowerCase();
  if (["1", "true", "x", "yes", "y", "co", "bat"].includes(value)) return true;
  if (["0", "false", "no", "n", "khong", "tat"].includes(value)) return false;
  return fallback;
}

/** Chuẩn hoá 1 dòng Excel ⇒ object tài khoản (hoặc lỗi). */
function normalizeImportRow(row) {
  const map = buildRowMap(row);
  const emailAddress = pick(map, ["EMAIL_ADDRESS", "EMAIL", "DIA CHI EMAIL", "EMAIL CONG TY"]);
  const emplNo = pick(map, ["EMPL_NO", "MA_NV", "MANV", "MA NHAN SU", "MA ERP"]);
  const pop3Host = pick(map, ["POP3_HOST", "MAY CHU POP3", "HOST POP3", "MAY CHU", "POP3 SERVER", "MAIL SERVER"]);
  // Cổng quyết định SSL khi cột SSL để trống: 995 = SSL, 110 = không SSL.
  const pop3PortRaw = Number(pick(map, ["POP3_PORT", "CONG POP3", "PORT", "CONG"]));
  const pop3Secure = pickBool(map, ["POP3_SECURE", "SSL POP3", "SSL", "BAO MAT"], pop3PortRaw ? pop3PortRaw === 995 : true);
  const smtpHost = pick(map, ["SMTP_HOST", "MAY CHU SMTP", "SMTP SERVER"]) || pop3Host;
  const smtpPortRaw = Number(pick(map, ["SMTP_PORT", "CONG SMTP"]));
  const smtpSecure = pickBool(map, ["SMTP_SECURE", "SSL SMTP"], smtpPortRaw ? smtpPortRaw === 465 : pop3Secure);

  return {
    emplNo: emplNo ? emplNo.toUpperCase() : null,
    emailAddress,
    displayName: pick(map, ["DISPLAY_NAME", "TEN HIEN THI", "HO TEN", "TEN NV"]) || null,
    pop3Host,
    pop3Port: pop3PortRaw || (pop3Secure ? 995 : 110),
    pop3Secure,
    pop3Username: pick(map, ["POP3_USERNAME", "USERNAME", "TAI KHOAN POP3", "USER"]) || emailAddress,
    pop3Password: pick(map, ["POP3_PASSWORD", "PASSWORD POP3", "MAT KHAU", "PASSWORD", "PASS"]),
    smtpHost,
    smtpPort: smtpPortRaw || (smtpSecure ? 465 : 25),
    smtpSecure,
    smtpUsername:
      pick(map, ["SMTP_USERNAME", "TAI KHOAN SMTP"]) ||
      pick(map, ["POP3_USERNAME", "USERNAME", "USER"]) ||
      emailAddress,
    smtpPassword: pick(map, ["SMTP_PASSWORD", "MAT KHAU SMTP"]) || pick(map, ["POP3_PASSWORD", "MAT KHAU", "PASSWORD", "PASS"]),
    isActive: pickBool(map, ["IS_ACTIVE", "ACTIVE", "HOAT DONG", "TRANG THAI"], true),
    isShared: pickBool(map, ["IS_SHARED", "SHARED", "DUNG CHUNG"], false),
  };
}

/**
 * `emailAccountImport` — nhập HÀNG LOẠT mailbox từ Excel (admin).
 *
 * DATA: `ROWS` = mảng object (FE đã đọc Excel ⇒ JSON), `DRY_RUN` = true để chỉ kiểm tra.
 * Upsert theo (CTR_CD, EMAIL_ADDRESS): đã có ⇒ cập nhật (mật khẩu chỉ ghi khi có giá trị),
 * chưa có ⇒ tạo mới + khởi tạo con trỏ đồng bộ.
 * Trả về tổng hợp: created/updated/skipped/errors/warnings/accounts.
 */
exports.emailAccountImport = async (req, res, DATA = {}) => {
  if (!requireAdmin(req, res)) return;
  try {
    const ctrCd = (req.payload_data || {}).CTR_CD;
    const rows = Array.isArray(DATA.ROWS) ? DATA.ROWS : [];
    const dryRun = DATA.DRY_RUN === true;

    if (rows.length === 0) return fail(res, "Không có dòng dữ liệu để nhập", "INVALID");
    if (rows.length > MAX_IMPORT_ROWS) {
      return fail(res, `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} dòng (tệp có ${rows.length} dòng)`, "TOO_MANY_ROWS");
    }

    // Danh sách EMPL_NO có trong ERP ⇒ cảnh báo (không chặn) nếu mã nhân viên không tồn tại.
    const emplRows = await mailRepo.queryRows(
      `SELECT DISTINCT LTRIM(RTRIM(EMPL_NO)) AS EMPL_NO FROM ZTBEMPLINFO WHERE CTR_CD = @CTR`,
      { CTR: ctrCd }
    );
    const knownEmplNos = new Set(emplRows.map((r) => String(r.EMPL_NO || "").toUpperCase()));

    const summary = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      dryRun,
      errors: [],
      warnings: [],
      accounts: [],
    };
    const seenEmails = new Set();

    for (let index = 0; index < rows.length; index += 1) {
      const excelRowNumber = index + 2; // +2: dòng 1 là tiêu đề
      const normalized = normalizeImportRow(rows[index]);
      const label = normalized.emailAddress || normalized.emplNo || `dòng ${excelRowNumber}`;

      if (!normalized.emailAddress || !EMAIL_RE.test(normalized.emailAddress)) {
        summary.errors.push({ row: excelRowNumber, label, message: "Email không hợp lệ hoặc để trống" });
        summary.skipped += 1;
        continue;
      }
      if (!normalized.pop3Host) {
        summary.errors.push({ row: excelRowNumber, label, message: "Thiếu máy chủ POP3 (POP3_HOST)" });
        summary.skipped += 1;
        continue;
      }
      if (!normalized.emplNo && !normalized.isShared) {
        summary.errors.push({ row: excelRowNumber, label, message: "Thiếu MÃ NHÂN VIÊN (hoặc đánh dấu DÙNG CHUNG = x)" });
        summary.skipped += 1;
        continue;
      }
      const emailKey = normalized.emailAddress.toLowerCase();
      const duplicatedInFile = seenEmails.has(emailKey);
      seenEmails.add(emailKey);
      if (duplicatedInFile) {
        summary.warnings.push({ row: excelRowNumber, label, message: "Email trùng trong tệp — dòng sau ghi đè dòng trước" });
      }
      if (normalized.emplNo && !knownEmplNos.has(normalized.emplNo)) {
        summary.warnings.push({
          row: excelRowNumber,
          label,
          message: `Mã nhân viên "${normalized.emplNo}" không có trong hồ sơ nhân sự (vẫn nhập)`,
        });
      }

      if (dryRun) {
        summary.accounts.push({ row: excelRowNumber, ...normalized, pop3Password: undefined, smtpPassword: undefined });
        continue;
      }

      const existing = await mailRepo.findAccountByEmail({ ctrCd, emailAddress: normalized.emailAddress });
      const fields = {
        emplNo: normalized.emplNo,
        displayName: normalized.displayName,
        pop3Host: normalized.pop3Host,
        pop3Port: normalized.pop3Port,
        pop3Secure: normalized.pop3Secure,
        pop3Username: normalized.pop3Username,
        pop3CredEnc: normalized.pop3Password ? mailCrypto.encryptSecret(normalized.pop3Password) : undefined,
        smtpHost: normalized.smtpHost,
        smtpPort: normalized.smtpPort,
        smtpSecure: normalized.smtpSecure,
        smtpUsername: normalized.smtpUsername,
        smtpCredEnc: normalized.smtpPassword ? mailCrypto.encryptSecret(normalized.smtpPassword) : undefined,
        isActive: normalized.isActive,
        isShared: normalized.isShared,
      };

      try {
        if (existing) {
          await mailRepo.updateAccount(existing.ID, fields);
          summary.updated += 1;
          summary.accounts.push({ row: excelRowNumber, id: existing.ID, emailAddress: normalized.emailAddress, action: "updated" });
        } else {
          const id = await mailRepo.insertAccount({ ctrCd, emailAddress: normalized.emailAddress, ...fields });
          await mailRepo.ensureCheckpoint(id);
          summary.created += 1;
          summary.accounts.push({ row: excelRowNumber, id, emailAddress: normalized.emailAddress, action: "created" });
        }
      } catch (error) {
        summary.errors.push({ row: excelRowNumber, label, message: error?.message || String(error) });
        summary.skipped += 1;
      }
    }

    console.log(
      `[mail] import accounts: total=${summary.total} created=${summary.created} updated=${summary.updated} skipped=${summary.skipped} errors=${summary.errors.length}`
    );
    ok(res, summary);
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Đồng bộ HÀNG LOẠT (admin)                                           */
/* ------------------------------------------------------------------ */

/** Trạng thái lần "đồng bộ hàng loạt" gần nhất (để FE hiển thị tiến độ). */
const syncAllState = {
  running: false,
  total: 0,
  processed: 0,
  ok: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
};

/**
 * `emailSyncAll` — đẩy đồng bộ cho TẤT CẢ mailbox đang bật (chạy nền, trả về ngay).
 * Không chờ từng mailbox vì POP3 thường rất chậm; FE xem tiến độ qua `emailSyncAllStatus`.
 */
exports.emailSyncAll = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    if (syncAllState.running) {
      return ok(res, { ...syncAllState, started: false, message: "Đang đồng bộ hàng loạt" });
    }
    const ctrCd = (req.payload_data || {}).CTR_CD;
    const accounts = await mailRepo.listAccounts({ ctrCd, activeOnly: true });
    if (accounts.length === 0) return ok(res, { ...syncAllState, total: 0, started: false });

    Object.assign(syncAllState, {
      running: true,
      total: accounts.length,
      processed: 0,
      ok: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });

    // Chạy tuần tự (1 mailbox/lần) để không mở quá nhiều kết nối POP3 cùng lúc.
    (async () => {
      for (const account of accounts) {
        try {
          const result = await syncMailbox(account.ID, { manual: true });
          if (result?.ok) syncAllState.ok += 1;
          else syncAllState.failed += 1;
        } catch (error) {
          syncAllState.failed += 1;
          console.warn(`[mail] sync-all acc=${account.ID} lỗi: ${error?.message || error}`);
        } finally {
          syncAllState.processed += 1;
        }
      }
      syncAllState.running = false;
      syncAllState.finishedAt = new Date().toISOString();
      console.log(
        `[mail] sync-all xong: ${syncAllState.processed}/${syncAllState.total} (ok=${syncAllState.ok}, lỗi=${syncAllState.failed})`
      );
    })().catch((error) => {
      syncAllState.running = false;
      console.warn(`[mail] sync-all lỗi: ${error?.message || error}`);
    });

    ok(res, { ...syncAllState, started: true });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Tiến độ "đồng bộ hàng loạt". */
exports.emailSyncAllStatus = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  ok(res, { ...syncAllState });
};
