/**
 * Lớp truy cập dữ liệu (DAL) cho module Email — phần VẬN HÀNH.
 *  - ZTB_MAIL_ACCOUNT            (mailbox)
 *  - ZTB_MAIL_SYNC_CHECKPOINT    (con trỏ UIDL + khoá chống chạy chồng)
 *  - ZTB_MAIL_SYNC_LOG           (nhật ký đồng bộ)
 *  - ZTB_MAIL_FOLDER             (thư mục hiển thị phía client)
 *  - ZTB_MAIL_DRAFT              (bản nháp)
 *  - Thống kê dung lượng
 *
 * KHÔNG kiểm tra quyền — tầng service mới kiểm. Repository chỉ lo SQL.
 * Phần email/đính kèm/hội thoại nằm ở `mailMessageRepository.js`.
 */
const { openConnection, openDedicatedConnection } = require("../../config/database");

async function queryRows(sql, params = {}) {
  const pool = await openConnection();
  const result = await pool.query(sql, params);
  return result.recordset || [];
}

async function queryOne(sql, params = {}) {
  const rows = await queryRows(sql, params);
  return rows[0] || null;
}

/** Chạy nhiều câu lệnh trong 1 transaction trên connection riêng. */
async function withTransaction(work) {
  const connection = await openDedicatedConnection();
  try {
    await connection.promises.beginTransaction();
    const result = await work({
      query: (sql, params = {}) => connection.promises.query(sql, params),
    });
    await connection.promises.commit();
    return result;
  } catch (error) {
    await connection.promises.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.promises.close().catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Mailbox (ZTB_MAIL_ACCOUNT)                                          */
/* ------------------------------------------------------------------ */

const ACCOUNT_COLUMNS = `ID, CTR_CD, EMPL_NO, EMAIL_ADDRESS, DISPLAY_NAME,
  POP3_HOST, POP3_PORT, POP3_SECURE, POP3_USERNAME,
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USERNAME,
  IS_ACTIVE, IS_SHARED, LAST_SYNC_AT, LAST_SYNC_STATUS, LAST_ERROR,
  CREATED_AT, UPDATED_AT`;

async function listAccounts({ ctrCd, activeOnly = false, emplNo = null } = {}) {
  const conditions = ["CTR_CD = @CTR_CD"];
  const params = { CTR_CD: ctrCd };
  if (activeOnly) conditions.push("IS_ACTIVE = 1");
  if (emplNo) {
    conditions.push("(EMPL_NO = @EMPL_NO OR IS_SHARED = 1)");
    params.EMPL_NO = emplNo;
  }
  return queryRows(
    `SELECT ${ACCOUNT_COLUMNS} FROM ZTB_MAIL_ACCOUNT
     WHERE ${conditions.join(" AND ")}
     ORDER BY IS_ACTIVE DESC, EMAIL_ADDRESS`,
    params
  );
}

async function getAccountById(id) {
  return queryOne(`SELECT ${ACCOUNT_COLUMNS} FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: id });
}

/** Lấy account KÈM credential đã mã hoá (chỉ worker gọi). */
async function getAccountWithCredentials(id) {
  return queryOne(
    `SELECT ${ACCOUNT_COLUMNS}, POP3_CRED_ENC, SMTP_CRED_ENC
     FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`,
    { ID: id }
  );
}

async function findAccountByEmail({ ctrCd, emailAddress }) {
  return queryOne(
    `SELECT ${ACCOUNT_COLUMNS} FROM ZTB_MAIL_ACCOUNT WHERE CTR_CD = @CTR_CD AND EMAIL_ADDRESS = @EMAIL`,
    { CTR_CD: ctrCd, EMAIL: emailAddress }
  );
}

async function insertAccount(fields) {
  const rows = await queryRows(
    `INSERT INTO ZTB_MAIL_ACCOUNT
      (CTR_CD, EMPL_NO, EMAIL_ADDRESS, DISPLAY_NAME,
       POP3_HOST, POP3_PORT, POP3_SECURE, POP3_USERNAME, POP3_CRED_ENC,
       SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USERNAME,
       IS_ACTIVE, IS_SHARED)
     OUTPUT INSERTED.ID
     VALUES (@CTR_CD, @EMPL_NO, @EMAIL, @DISPLAY_NAME,
       @POP3_HOST, @POP3_PORT, @POP3_SECURE, @POP3_USERNAME, @POP3_CRED_ENC,
       @SMTP_HOST, @SMTP_PORT, @SMTP_SECURE, @SMTP_USERNAME,
       @IS_ACTIVE, @IS_SHARED)`,
    {
      CTR_CD: fields.ctrCd,
      EMPL_NO: fields.emplNo ?? null,
      EMAIL: fields.emailAddress,
      DISPLAY_NAME: fields.displayName ?? null,
      POP3_HOST: fields.pop3Host ?? null,
      POP3_PORT: fields.pop3Port ?? null,
      POP3_SECURE: fields.pop3Secure ? 1 : 0,
      POP3_USERNAME: fields.pop3Username ?? null,
      POP3_CRED_ENC: fields.pop3CredEnc ?? null,
      SMTP_HOST: fields.smtpHost ?? null,
      SMTP_PORT: fields.smtpPort ?? null,
      SMTP_SECURE: fields.smtpSecure ? 1 : 0,
      SMTP_USERNAME: fields.smtpUsername ?? null,
      IS_ACTIVE: fields.isActive === false ? 0 : 1,
      IS_SHARED: fields.isShared ? 1 : 0,
    }
  );
  return rows[0]?.ID ?? null;
}

/** Cập nhật các trường cho phép (chỉ những key có mặt trong `fields`). */
async function updateAccount(id, fields) {
  const map = {
    EMPL_NO: fields.emplNo,
    DISPLAY_NAME: fields.displayName,
    POP3_HOST: fields.pop3Host,
    POP3_PORT: fields.pop3Port,
    POP3_SECURE: fields.pop3Secure === undefined ? undefined : fields.pop3Secure ? 1 : 0,
    POP3_USERNAME: fields.pop3Username,
    POP3_CRED_ENC: fields.pop3CredEnc,
    SMTP_HOST: fields.smtpHost,
    SMTP_PORT: fields.smtpPort,
    SMTP_SECURE: fields.smtpSecure === undefined ? undefined : fields.smtpSecure ? 1 : 0,
    SMTP_USERNAME: fields.smtpUsername,
    SMTP_CRED_ENC: fields.smtpCredEnc,
    IS_ACTIVE: fields.isActive === undefined ? undefined : fields.isActive ? 1 : 0,
    IS_SHARED: fields.isShared === undefined ? undefined : fields.isShared ? 1 : 0,
  };
  const sets = [];
  const params = { ID: id };
  for (const [col, value] of Object.entries(map)) {
    if (value === undefined) continue;
    sets.push(`${col} = @${col}`);
    params[col] = value;
  }
  if (sets.length === 0) return 0;
  sets.push("UPDATED_AT = GETDATE()");
  await queryRows(`UPDATE ZTB_MAIL_ACCOUNT SET ${sets.join(", ")} WHERE ID = @ID`, params);
  return 1;
}

async function setAccountActive(id, isActive) {
  await queryRows(
    `UPDATE ZTB_MAIL_ACCOUNT SET IS_ACTIVE = @ACTIVE, UPDATED_AT = GETDATE() WHERE ID = @ID`,
    { ID: id, ACTIVE: isActive ? 1 : 0 }
  );
}

async function updateAccountSyncState(id, { status, error, at = new Date() }) {
  await queryRows(
    `UPDATE ZTB_MAIL_ACCOUNT
       SET LAST_SYNC_AT = @AT, LAST_SYNC_STATUS = @STATUS, LAST_ERROR = @ERROR, UPDATED_AT = GETDATE()
     WHERE ID = @ID`,
    { ID: id, AT: at, STATUS: status ?? null, ERROR: error ? String(error).slice(0, 1000) : null }
  );
}

/* ------------------------------------------------------------------ */
/* Checkpoint (ZTB_MAIL_SYNC_CHECKPOINT)                               */
/* ------------------------------------------------------------------ */

async function ensureCheckpoint(accountId) {
  await queryRows(
    `IF NOT EXISTS (SELECT 1 FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @ID)
       INSERT INTO ZTB_MAIL_SYNC_CHECKPOINT (MAIL_ACCOUNT_ID) VALUES (@ID)`,
    { ID: accountId }
  );
}

async function getCheckpoint(accountId) {
  return queryOne(
    `SELECT MAIL_ACCOUNT_ID, LAST_UIDL, LAST_SYNC_AT, IN_PROGRESS, LOCKED_AT, LOCKED_BY, TOTAL_IMPORTED
     FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @ID`,
    { ID: accountId }
  );
}

/**
 * Chiếm khoá đồng bộ nguyên tử. Trả true nếu chiếm được.
 * Cho phép chiếm lại nếu khoá cũ đã "cũ" (worker crash) — `staleMs`.
 */
async function tryAcquireLock(accountId, lockBy, staleMs = 10 * 60 * 1000) {
  await ensureCheckpoint(accountId);
  const staleDate = new Date(Date.now() - staleMs);
  const rows = await queryRows(
    `UPDATE ZTB_MAIL_SYNC_CHECKPOINT
        SET IN_PROGRESS = 1, LOCKED_AT = GETDATE(), LOCKED_BY = @BY
      OUTPUT INSERTED.MAIL_ACCOUNT_ID
      WHERE MAIL_ACCOUNT_ID = @ID
        AND (IN_PROGRESS = 0 OR LOCKED_AT IS NULL OR LOCKED_AT < @STALE)`,
    { ID: accountId, BY: String(lockBy || "worker").slice(0, 100), STALE: staleDate }
  );
  return rows.length > 0;
}

async function releaseLock(accountId, { lastUidl, importedDelta = 0 } = {}) {
  await queryRows(
    `UPDATE ZTB_MAIL_SYNC_CHECKPOINT
        SET IN_PROGRESS = 0, LOCKED_AT = NULL, LOCKED_BY = NULL,
            LAST_SYNC_AT = GETDATE(),
            LAST_UIDL = COALESCE(@UIDL, LAST_UIDL),
            TOTAL_IMPORTED = TOTAL_IMPORTED + @DELTA
      WHERE MAIL_ACCOUNT_ID = @ID`,
    { ID: accountId, UIDL: lastUidl ?? null, DELTA: importedDelta }
  );
}

async function resetCheckpoint(accountId) {
  await ensureCheckpoint(accountId);
  await queryRows(
    `UPDATE ZTB_MAIL_SYNC_CHECKPOINT
        SET LAST_UIDL = NULL, IN_PROGRESS = 0, LOCKED_AT = NULL, LOCKED_BY = NULL
      WHERE MAIL_ACCOUNT_ID = @ID`,
    { ID: accountId }
  );
}

/** Danh sách account tới hạn đồng bộ (active, không đang chạy). */
async function listSyncableAccounts({ intervalSeconds = 45 } = {}) {
  return queryRows(
    `SELECT a.ID, a.CTR_CD, a.EMPL_NO, a.EMAIL_ADDRESS
     FROM ZTB_MAIL_ACCOUNT a
     LEFT JOIN ZTB_MAIL_SYNC_CHECKPOINT c ON c.MAIL_ACCOUNT_ID = a.ID
     WHERE a.IS_ACTIVE = 1
       AND ISNULL(c.IN_PROGRESS, 0) = 0
       AND (c.LAST_SYNC_AT IS NULL OR DATEDIFF(SECOND, c.LAST_SYNC_AT, GETDATE()) >= @INTERVAL)
     ORDER BY ISNULL(c.LAST_SYNC_AT, '1900-01-01') ASC`,
    { INTERVAL: intervalSeconds }
  );
}

/* ------------------------------------------------------------------ */
/* Sync log (ZTB_MAIL_SYNC_LOG)                                        */
/* ------------------------------------------------------------------ */

async function startSyncLog(accountId) {
  const rows = await queryRows(
    `INSERT INTO ZTB_MAIL_SYNC_LOG (MAIL_ACCOUNT_ID) OUTPUT INSERTED.ID VALUES (@ID)`,
    { ID: accountId }
  );
  return rows[0]?.ID ?? null;
}

async function finishSyncLog(id, fields = {}) {
  await queryRows(
    `UPDATE ZTB_MAIL_SYNC_LOG
        SET FINISHED_AT = GETDATE(), STATUS = @STATUS, CONNECTED = @CONNECTED,
            NEW_COUNT = @NEW_COUNT, IMPORTED_COUNT = @IMPORTED, ATTACH_COUNT = @ATTACH,
            ERROR_CODE = @ERRCODE, ERROR_MESSAGE = @ERRMSG,
            DURATION_MS = DATEDIFF(MILLISECOND, STARTED_AT, GETDATE())
      WHERE ID = @ID`,
    {
      ID: id,
      STATUS: fields.status ?? "SUCCESS",
      CONNECTED: fields.connected ? 1 : 0,
      NEW_COUNT: fields.newCount ?? 0,
      IMPORTED: fields.importedCount ?? 0,
      ATTACH: fields.attachCount ?? 0,
      ERRCODE: fields.errorCode ?? null,
      ERRMSG: fields.errorMessage ? String(fields.errorMessage).slice(0, 1000) : null,
    }
  );
}

async function listSyncLogs({ accountId, limit = 50 }) {
  return queryRows(
    `SELECT TOP (@LIMIT) ID, MAIL_ACCOUNT_ID, STARTED_AT, FINISHED_AT, STATUS, CONNECTED,
            NEW_COUNT, IMPORTED_COUNT, ATTACH_COUNT, ERROR_CODE, ERROR_MESSAGE, DURATION_MS
     FROM ZTB_MAIL_SYNC_LOG WHERE MAIL_ACCOUNT_ID = @ID ORDER BY STARTED_AT DESC`,
    { ID: accountId, LIMIT: Math.min(Math.max(Number(limit) || 50, 1), 500) }
  );
}

/* ------------------------------------------------------------------ */
/* Folder (ZTB_MAIL_FOLDER)                                            */
/* ------------------------------------------------------------------ */

const SYSTEM_FOLDERS = [
  { key: "INBOX", name: "Hộp thư đến", order: 1 },
  { key: "STARRED", name: "Có gắn sao", order: 2 },
  { key: "SENT", name: "Đã gửi", order: 3 },
  { key: "DRAFT", name: "Thư nháp", order: 4 },
  { key: "ARCHIVE", name: "Lưu trữ", order: 5 },
  { key: "SPAM", name: "Thư rác", order: 6 },
  { key: "TRASH", name: "Thùng rác", order: 7 },
];

/** Tạo 7 thư mục hệ thống cho 1 user nếu chưa có. Idempotent. */
async function ensureSystemFolders({ ctrCd, emplNo }) {
  const owner = String(emplNo || "").trim().toUpperCase();
  for (const folder of SYSTEM_FOLDERS) {
    await queryRows(
      `IF NOT EXISTS (SELECT 1 FROM ZTB_MAIL_FOLDER WHERE CTR_CD=@CTR AND EMPL_NO=@EMPL AND FOLDER_KEY=@KEY)
         INSERT INTO ZTB_MAIL_FOLDER (CTR_CD, EMPL_NO, FOLDER_KEY, DISPLAY_NAME, SORT_ORDER, IS_SYSTEM)
         VALUES (@CTR, @EMPL, @KEY, @NAME, @ORD, 1)`,
      { CTR: ctrCd, EMPL: owner, KEY: folder.key, NAME: folder.name, ORD: folder.order }
    );
  }
}

async function listFolders({ ctrCd, emplNo }) {
  return queryRows(
    `SELECT ID, FOLDER_KEY, DISPLAY_NAME, SORT_ORDER, IS_SYSTEM
     FROM ZTB_MAIL_FOLDER WHERE CTR_CD = @CTR AND EMPL_NO = @EMPL
     ORDER BY SORT_ORDER, DISPLAY_NAME`,
    { CTR: ctrCd, EMPL: String(emplNo || "").trim().toUpperCase() }
  );
}

/* ------------------------------------------------------------------ */
/* Draft (ZTB_MAIL_DRAFT)                                              */
/* ------------------------------------------------------------------ */

async function listDrafts({ emplNo, limit = 50 }) {
  return queryRows(
    `SELECT TOP (@LIMIT) ID, SUBJECT, TO_JSON, UPDATED_AT, IN_REPLY_TO
     FROM ZTB_MAIL_DRAFT WHERE EMPL_NO = @EMPL ORDER BY UPDATED_AT DESC`,
    { EMPL: String(emplNo || "").trim().toUpperCase(), LIMIT: Math.min(Number(limit) || 50, 200) }
  );
}

async function getDraft(id) {
  return queryOne(`SELECT * FROM ZTB_MAIL_DRAFT WHERE ID = @ID`, { ID: id });
}

async function saveDraft(fields) {
  const empl = String(fields.emplNo || "").trim().toUpperCase();
  if (fields.id) {
    const owned = await queryOne(
      `SELECT ID FROM ZTB_MAIL_DRAFT WHERE ID = @ID AND EMPL_NO = @EMPL`,
      { ID: fields.id, EMPL: empl }
    );
    if (!owned) throw new Error("Bản nháp không tồn tại hoặc không thuộc về bạn");
    await queryRows(
      `UPDATE ZTB_MAIL_DRAFT SET TO_JSON=@TO, CC_JSON=@CC, BCC_JSON=@BCC, SUBJECT=@SUBJECT,
              BODY_HTML=@HTML, BODY_TEXT=@TEXT, ATTACH_JSON=@ATT, IN_REPLY_TO=@IRT,
              REFERENCES_HEADER=@REF, UPDATED_AT=GETDATE()
       WHERE ID=@ID AND EMPL_NO=@EMPL`,
      buildDraftParams(fields, { ID: fields.id, EMPL: empl })
    );
    return fields.id;
  }
  const rows = await queryRows(
    `INSERT INTO ZTB_MAIL_DRAFT (CTR_CD, EMPL_NO, TO_JSON, CC_JSON, BCC_JSON, SUBJECT, BODY_HTML, BODY_TEXT, ATTACH_JSON, IN_REPLY_TO, REFERENCES_HEADER)
     OUTPUT INSERTED.ID
     VALUES (@CTR, @EMPL, @TO, @CC, @BCC, @SUBJECT, @HTML, @TEXT, @ATT, @IRT, @REF)`,
    buildDraftParams(fields, { CTR: fields.ctrCd, EMPL: empl })
  );
  return rows[0]?.ID ?? null;
}

function buildDraftParams(fields, base) {
  return {
    ...base,
    TO: fields.toJson ?? null,
    CC: fields.ccJson ?? null,
    BCC: fields.bccJson ?? null,
    SUBJECT: fields.subject ?? null,
    HTML: fields.bodyHtml ?? null,
    TEXT: fields.bodyText ?? null,
    ATT: fields.attachJson ?? null,
    IRT: fields.inReplyTo ?? null,
    REF: fields.referencesHeader ?? null,
  };
}

async function deleteDraft({ id, emplNo }) {
  await queryRows(`DELETE FROM ZTB_MAIL_DRAFT WHERE ID = @ID AND EMPL_NO = @EMPL`, {
    ID: id,
    EMPL: String(emplNo || "").trim().toUpperCase(),
  });
}

/* ------------------------------------------------------------------ */
/* Thống kê dung lượng                                                 */
/* ------------------------------------------------------------------ */

async function getAccountStorage(accountId) {
  return queryOne(
    `SELECT
        (SELECT COUNT(*) FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ID) AS MESSAGE_COUNT,
        ISNULL(SUM(a.FILE_SIZE), 0) AS ATTACH_BYTES,
        COUNT(a.ID) AS ATTACH_COUNT
     FROM ZTB_MAIL_ATTACHMENT a
     JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID
     WHERE m.MAIL_ACCOUNT_ID = @ID`,
    { ID: accountId }
  );
}

async function getStorageDashboard({ ctrCd }) {
  return queryOne(
    `SELECT
        (SELECT COUNT(*) FROM ZTB_MAIL_ACCOUNT WHERE CTR_CD = @CTR) AS MAILBOX_COUNT,
        (SELECT COUNT(*) FROM ZTB_MAIL_MESSAGE m JOIN ZTB_MAIL_ACCOUNT a ON a.ID = m.MAIL_ACCOUNT_ID WHERE a.CTR_CD = @CTR) AS MESSAGE_COUNT,
        (SELECT COUNT(*) FROM ZTB_MAIL_ATTACHMENT at JOIN ZTB_MAIL_MESSAGE m ON m.ID = at.MESSAGE_ID JOIN ZTB_MAIL_ACCOUNT a ON a.ID = m.MAIL_ACCOUNT_ID WHERE a.CTR_CD = @CTR) AS ATTACHMENT_COUNT`,
    { CTR: ctrCd }
  );
}

module.exports = {
  queryRows,
  queryOne,
  withTransaction,
  // accounts
  listAccounts,
  getAccountById,
  getAccountWithCredentials,
  findAccountByEmail,
  insertAccount,
  updateAccount,
  setAccountActive,
  updateAccountSyncState,
  // checkpoint
  ensureCheckpoint,
  getCheckpoint,
  tryAcquireLock,
  releaseLock,
  resetCheckpoint,
  listSyncableAccounts,
  // sync log
  startSyncLog,
  finishSyncLog,
  listSyncLogs,
  // folder
  SYSTEM_FOLDERS,
  ensureSystemFolders,
  listFolders,
  // draft
  listDrafts,
  getDraft,
  saveDraft,
  deleteDraft,
  // stats
  getAccountStorage,
  getStorageDashboard,
};
