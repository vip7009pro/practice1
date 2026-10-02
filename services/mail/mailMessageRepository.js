/**
 * Lớp truy cập dữ liệu (DAL) cho module Email — phần EMAIL/ĐÍNH KÈM/HỘI THOẠI.
 *  - ZTB_MAIL_MESSAGE, ZTB_MAIL_RECIPIENT
 *  - ZTB_MAIL_ATTACHMENT, ZTB_MAIL_PHYSICAL_FILE
 *  - ZTB_MAIL_USERSTATE (trạng thái đọc/sao theo từng user)
 *  - ZTB_MAIL_THREAD
 *
 * KHÔNG kiểm tra quyền. Repository chỉ lo SQL.
 */
const { queryRows, queryOne } = require("./mailRepository");

/** Danh sách account id đã validate (số nguyên dương) ⇒ IN (...). */
function accountInClause(accountIds) {
  const ids = (accountIds || [])
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return { sql: "(NULL)", ok: false };
  return { sql: `(${ids.join(",")})`, ok: true };
}

/* ------------------------------------------------------------------ */
/* Dedup + insert                                                      */
/* ------------------------------------------------------------------ */

/** Tìm email đã tồn tại theo Message-ID / UIDL / hash (theo thứ tự ưu tiên). */
async function findMessageByDedup({ accountId, messageId, uidl, contentHash }) {
  // Message-ID là khoá ĐÁNG TIN NHẤT: nếu có và chưa từng thấy ⇒ email MỚI
  // (không dùng hash để tránh loại nhầm 2 email hợp lệ có nội dung giống nhau).
  if (messageId) {
    const row = await queryOne(
      `SELECT ID FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ACC AND MESSAGE_ID = @MID`,
      { ACC: accountId, MID: messageId }
    );
    return row || null;
  }
  // Không có Message-ID ⇒ dùng UIDL (định danh duy nhất theo mailbox server).
  if (uidl) {
    const row = await queryOne(
      `SELECT ID FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ACC AND UIDL = @UIDL`,
      { ACC: accountId, UIDL: uidl }
    );
    if (row) return row;
  }
  // Fallback cuối: hash nội dung THÔ (chỉ khi email không có Message-ID).
  if (contentHash) {
    return queryOne(
      `SELECT ID FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ACC AND CONTENT_HASH = @HASH`,
      { ACC: accountId, HASH: contentHash }
    );
  }
  return null;
}

/** Chèn email (trong transaction). Trả về ID vừa tạo. */
async function insertMessage(tx, fields) {
  const rows = await tx.query(
    `INSERT INTO ZTB_MAIL_MESSAGE
      (MAIL_ACCOUNT_ID, MESSAGE_ID, UIDL, THREAD_ID, IN_REPLY_TO, REFERENCES_HEADER,
       FROM_ADDRESS, FROM_NAME, TO_JSON, CC_JSON, BCC_JSON, SUBJECT, SENT_AT, RECEIVED_AT,
       FOLDER, HAS_ATTACHMENT, ATTACHMENT_COUNT, BODY_STORAGE_PATH, BODY_INLINE,
       PREVIEW_TEXT, SIZE_BYTES, CONTENT_HASH)
     OUTPUT INSERTED.ID
     VALUES (@MAIL_ACCOUNT_ID, @MESSAGE_ID, @UIDL, @THREAD_ID, @IN_REPLY_TO, @REFERENCES_HEADER,
       @FROM_ADDRESS, @FROM_NAME, @TO_JSON, @CC_JSON, @BCC_JSON, @SUBJECT, @SENT_AT, @RECEIVED_AT,
       @FOLDER, @HAS_ATTACHMENT, @ATTACHMENT_COUNT, @BODY_STORAGE_PATH, @BODY_INLINE,
       @PREVIEW_TEXT, @SIZE_BYTES, @CONTENT_HASH)`,
    {
      MAIL_ACCOUNT_ID: fields.mailAccountId,
      MESSAGE_ID: fields.messageId ?? null,
      UIDL: fields.uidl ?? null,
      THREAD_ID: fields.threadId ?? null,
      IN_REPLY_TO: fields.inReplyTo ?? null,
      REFERENCES_HEADER: fields.referencesHeader ?? null,
      FROM_ADDRESS: fields.fromAddress ?? null,
      FROM_NAME: fields.fromName ?? null,
      TO_JSON: fields.toJson ?? null,
      CC_JSON: fields.ccJson ?? null,
      BCC_JSON: fields.bccJson ?? null,
      SUBJECT: fields.subject ?? null,
      SENT_AT: fields.sentAt ?? null,
      RECEIVED_AT: fields.receivedAt ?? null,
      FOLDER: fields.folder || "INBOX",
      HAS_ATTACHMENT: fields.hasAttachment ? 1 : 0,
      ATTACHMENT_COUNT: fields.attachmentCount ?? 0,
      BODY_STORAGE_PATH: fields.bodyStoragePath ?? null,
      BODY_INLINE: fields.bodyInline ?? null,
      PREVIEW_TEXT: fields.previewText ?? null,
      SIZE_BYTES: fields.sizeBytes ?? null,
      CONTENT_HASH: fields.contentHash ?? null,
    }
  );
  return rows.recordset?.[0]?.ID ?? null;
}

async function insertRecipients(tx, messageId, recipients = []) {
  for (const r of recipients) {
    if (!r || !r.address) continue;
    await tx.query(
      `INSERT INTO ZTB_MAIL_RECIPIENT (MESSAGE_ID, RECIPIENT_TYPE, ADDRESS, DISPLAY_NAME)
       VALUES (@MSG, @TYPE, @ADDR, @NAME)`,
      { MSG: messageId, TYPE: r.type || "TO", ADDR: r.address, NAME: r.name ?? null }
    );
  }
}

async function updateMessageAttachmentMeta(tx, messageId, { count }) {
  await tx.query(
    `UPDATE ZTB_MAIL_MESSAGE SET HAS_ATTACHMENT = CASE WHEN @CNT > 0 THEN 1 ELSE 0 END,
            ATTACHMENT_COUNT = @CNT WHERE ID = @ID`,
    { ID: messageId, CNT: count }
  );
}

async function getMessageById(id) {
  return queryOne(`SELECT * FROM ZTB_MAIL_MESSAGE WHERE ID = @ID`, { ID: id });
}

/** Tập UIDL đã có của 1 mailbox (để xác định email mới). */
async function listExistingUidls(accountId) {
  const rows = await queryRows(
    `SELECT UIDL FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ACC AND UIDL IS NOT NULL`,
    { ACC: accountId }
  );
  return new Set(rows.map((r) => r.UIDL));
}

/* ------------------------------------------------------------------ */
/* Tìm kiếm (Phase 5)                                                  */
/* ------------------------------------------------------------------ */

/** Escape ký tự đại diện của LIKE để tìm đúng chuỗi người dùng nhập. */
function likeEscape(value) {
  return String(value ?? "").replace(/[\\%_\[]/g, (ch) => `\\${ch}`);
}

function likeArg(value) {
  return `%${likeEscape(value)}%`;
}

/**
 * Dựng mệnh đề WHERE + tham số cho tìm kiếm (dùng chung cho list & count).
 */
function buildSearchWhere(accountIds, emplNo, filters = {}) {
  const inc = accountInClause(accountIds);
  if (!inc.ok) return null;
  const empl = String(emplNo || "").trim().toUpperCase();
  const conditions = [`m.MAIL_ACCOUNT_ID IN ${inc.sql}`, `m.DELETED_AT IS NULL`, `us.DELETED_AT IS NULL`];
  const params = { EMPL: empl };

  const folder = String(filters.folder || "").toUpperCase();
  if (folder && folder !== "ALL") {
    if (folder === "STARRED") conditions.push(`ISNULL(us.IS_STARRED, m.IS_STARRED) = 1`);
    else {
      conditions.push(`ISNULL(us.FOLDER_OVERRIDE, m.FOLDER) = @FOLDER`);
      params.FOLDER = folder;
    }
  }

  if (filters.accountId) {
    conditions.push(`m.MAIL_ACCOUNT_ID = @ACC`);
    params.ACC = Number(filters.accountId);
  }
  if (filters.from) {
    conditions.push(`(m.FROM_ADDRESS LIKE @FROM ESCAPE '\\' OR m.FROM_NAME LIKE @FROM ESCAPE '\\')`);
    params.FROM = likeArg(filters.from);
  }
  if (filters.to) {
    conditions.push(`(m.TO_JSON LIKE @TO ESCAPE '\\' OR m.CC_JSON LIKE @TO ESCAPE '\\')`);
    params.TO = likeArg(filters.to);
  }
  if (filters.subject) {
    conditions.push(`m.SUBJECT LIKE @SUBJ ESCAPE '\\'`);
    params.SUBJ = likeArg(filters.subject);
  }
  if (filters.body) {
    conditions.push(`(m.BODY_INLINE LIKE @BODY ESCAPE '\\' OR m.PREVIEW_TEXT LIKE @BODY ESCAPE '\\')`);
    params.BODY = likeArg(filters.body);
  }
  if (filters.filename) {
    conditions.push(
      `EXISTS (SELECT 1 FROM ZTB_MAIL_ATTACHMENT a WHERE a.MESSAGE_ID = m.ID AND a.FILE_NAME LIKE @FN ESCAPE '\\')`
    );
    params.FN = likeArg(filters.filename);
  }
  if (filters.hasAttachment === true) conditions.push(`ISNULL(m.HAS_ATTACHMENT, 0) = 1`);
  if (filters.hasAttachment === false) conditions.push(`ISNULL(m.HAS_ATTACHMENT, 0) = 0`);
  if (filters.isUnread === true) conditions.push(`ISNULL(us.IS_READ, m.IS_READ) = 0`);
  if (filters.isRead === true) conditions.push(`ISNULL(us.IS_READ, m.IS_READ) = 1`);
  if (filters.isStarred === true) conditions.push(`ISNULL(us.IS_STARRED, m.IS_STARRED) = 1`);
  if (filters.after) {
    conditions.push(`m.RECEIVED_AT >= @AFTER`);
    params.AFTER = filters.after;
  }
  if (filters.before) {
    conditions.push(`m.RECEIVED_AT < @BEFORE`);
    params.BEFORE = filters.before;
  }

  // Từ khoá tự do + từ khoá rời: mọi từ phải xuất hiện trong các trường văn bản.
  const textMatch = (key) =>
    `(m.SUBJECT LIKE @${key} ESCAPE '\\' OR m.PREVIEW_TEXT LIKE @${key} ESCAPE '\\' OR m.BODY_INLINE LIKE @${key} ESCAPE '\\'
      OR m.FROM_ADDRESS LIKE @${key} ESCAPE '\\' OR m.FROM_NAME LIKE @${key} ESCAPE '\\'
      OR m.TO_JSON LIKE @${key} ESCAPE '\\' OR m.CC_JSON LIKE @${key} ESCAPE '\\')`;
  const terms = Array.isArray(filters.terms) ? filters.terms.map((t) => String(t).trim()).filter(Boolean).slice(0, 8) : [];
  terms.forEach((term, index) => {
    const key = `TERM${index}`;
    conditions.push(textMatch(key));
    params[key] = likeArg(term);
  });
  if (filters.keyword && terms.length === 0) {
    conditions.push(textMatch("Q"));
    params.Q = likeArg(filters.keyword);
  }

  return { conditions, params };
}

/**
 * Tìm kiếm email (server-side).
 *
 * Lọc: `q`/`terms` (từ khoá), `from`, `to`, `subject`, `body`, `filename`,
 * `folder`, `accountId`, `hasAttachment`, `isUnread`, `isRead`, `isStarred`,
 * `after`/`before` (Date), `sort` = newest|oldest|sender|subject.
 *
 * Phân trang: keyset (`cursor`) cho newest/oldest; `offset` cho các kiểu sắp xếp khác
 * (giới hạn 5000 để không OFFSET quá sâu).
 *
 * Lưu ý: chỉ tìm được trong `BODY_INLINE` + `PREVIEW_TEXT` (body lưu trên NAS không
 * tham gia tìm kiếm — cần nhánh Full-Text riêng nếu muốn mở rộng).
 */
async function searchMessages({ accountIds, emplNo, filters = {}, limit = 30, cursor = null, offset = 0 }) {
  const built = buildSearchWhere(accountIds, emplNo, filters);
  if (!built) return { rows: [], hasMore: false };
  const { conditions, params } = built;
  const size = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const sort = String(filters.sort || "newest").toLowerCase();
  const orderBy =
    sort === "oldest"
      ? "m.RECEIVED_AT ASC, m.ID ASC"
      : sort === "sender"
      ? "m.FROM_NAME ASC, m.FROM_ADDRESS ASC, m.RECEIVED_AT DESC"
      : sort === "subject"
      ? "m.SUBJECT ASC, m.RECEIVED_AT DESC"
      : "m.RECEIVED_AT DESC, m.ID DESC";

  const useKeyset = (sort === "newest" || sort === "oldest") && !!(cursor && cursor.receivedAt && cursor.id);
  if (useKeyset) {
    const op = sort === "oldest" ? ">" : "<";
    conditions.push(`(m.RECEIVED_AT ${op} @CUR_AT OR (m.RECEIVED_AT = @CUR_AT AND m.ID ${op} @CUR_ID))`);
    params.CUR_AT = cursor.receivedAt;
    params.CUR_ID = cursor.id;
  }

  const rows = await queryRows(
    `SELECT ${MESSAGE_LIST_COLUMNS}
     FROM ZTB_MAIL_MESSAGE m
     LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = @EMPL
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${orderBy}
     OFFSET @OFFSET ROWS FETCH NEXT @FETCH ROWS ONLY`,
    {
      ...params,
      // Keyset giữ OFFSET = 0 (đã lọc bằng con trỏ); kiểu sắp xếp khác đi theo offset.
      OFFSET: useKeyset ? 0 : Math.min(Math.max(Number(offset) || 0, 0), 5000),
      FETCH: size,
    }
  );
  return { rows, hasMore: rows.length >= size };
}

/** Đếm tổng số kết quả khớp bộ lọc (để hiển thị "N kết quả"). */
async function countSearchResults({ accountIds, emplNo, filters = {} }) {
  const built = buildSearchWhere(accountIds, emplNo, filters);
  if (!built) return 0;
  const row = await queryOne(
    `SELECT COUNT(*) AS CNT
     FROM ZTB_MAIL_MESSAGE m
     LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = @EMPL
     WHERE ${built.conditions.join(" AND ")}`,
    built.params
  );
  return Number(row?.CNT || 0);
}

/**
 * Lấy các email MỚI HƠN mốc `since` = { receivedAt, id } (Phase 6 — sau sự kiện `email:new`
 * hoặc sau khi socket kết nối lại). Không có `since` ⇒ lấy mới nhất tối đa `limit`.
 */
async function listMessagesSince({ accountIds, emplNo, folder = "INBOX", since = null, limit = 50 }) {
  const inc = accountInClause(accountIds);
  if (!inc.ok) return [];
  const empl = String(emplNo || "").trim().toUpperCase();
  const conditions = [`m.MAIL_ACCOUNT_ID IN ${inc.sql}`, `m.DELETED_AT IS NULL`, `us.DELETED_AT IS NULL`];
  const params = { EMPL: empl };

  const key = String(folder || "").toUpperCase();
  if (key === "STARRED") {
    conditions.push(`ISNULL(us.IS_STARRED, m.IS_STARRED) = 1`);
  } else if (key && key !== "ALL") {
    conditions.push(`ISNULL(us.FOLDER_OVERRIDE, m.FOLDER) = @FOLDER`);
    params.FOLDER = key;
  }
  if (since?.receivedAt && since?.id) {
    conditions.push(`(m.RECEIVED_AT > @SINCE_AT OR (m.RECEIVED_AT = @SINCE_AT AND m.ID > @SINCE_ID))`);
    params.SINCE_AT = since.receivedAt;
    params.SINCE_ID = since.id;
  }

  return queryRows(
    `SELECT ${MESSAGE_LIST_COLUMNS}
     FROM ZTB_MAIL_MESSAGE m
     LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = @EMPL
     WHERE ${conditions.join(" AND ")}
     ORDER BY m.RECEIVED_AT DESC, m.ID DESC
     OFFSET 0 ROWS FETCH NEXT @FETCH ROWS ONLY`,
    { ...params, FETCH: Math.min(Math.max(Number(limit) || 50, 1), 200) }
  );
}

/* ------------------------------------------------------------------ */
/* Hộp thư (inbox) — keyset pagination                                 */
/* ------------------------------------------------------------------ */

const MESSAGE_LIST_COLUMNS = `m.ID, m.MAIL_ACCOUNT_ID, m.MESSAGE_ID, m.THREAD_ID,
  m.FROM_ADDRESS, m.FROM_NAME, m.SUBJECT, m.SENT_AT, m.RECEIVED_AT,
  m.HAS_ATTACHMENT, m.ATTACHMENT_COUNT, m.PREVIEW_TEXT, m.FOLDER, m.SIZE_BYTES,
  ISNULL(us.IS_READ, m.IS_READ) AS IS_READ,
  ISNULL(us.IS_STARRED, m.IS_STARRED) AS IS_STARRED,
  ISNULL(us.IS_IMPORTANT, m.IS_IMPORTANT) AS IS_IMPORTANT,
  ISNULL(us.FOLDER_OVERRIDE, m.FOLDER) AS EFFECTIVE_FOLDER`;

/**
 * Danh sách email (keyset). `cursor` = { receivedAt, id }.
 * `folder` = INBOX | STARRED | SENT | ARCHIVE | SPAM | TRASH.
 */
async function listInbox({ accountIds, emplNo, folder = "INBOX", limit = 30, cursor = null }) {
  const inc = accountInClause(accountIds);
  if (!inc.ok) return [];
  const empl = String(emplNo || "").trim().toUpperCase();
  const conditions = [`m.MAIL_ACCOUNT_ID IN ${inc.sql}`, `m.DELETED_AT IS NULL`, `us.DELETED_AT IS NULL`];
  const params = { EMPL: empl, LIMIT: Math.min(Math.max(Number(limit) || 30, 1), 100) };

  if (folder === "STARRED") {
    conditions.push(`ISNULL(us.IS_STARRED, m.IS_STARRED) = 1`);
  } else {
    conditions.push(`ISNULL(us.FOLDER_OVERRIDE, m.FOLDER) = @FOLDER`);
    params.FOLDER = folder;
  }
  if (cursor && cursor.receivedAt && cursor.id) {
    conditions.push(`(m.RECEIVED_AT < @CUR_AT OR (m.RECEIVED_AT = @CUR_AT AND m.ID < @CUR_ID))`);
    params.CUR_AT = cursor.receivedAt;
    params.CUR_ID = cursor.id;
  }

  const rows = await queryRows(
    `SELECT TOP (@LIMIT) ${MESSAGE_LIST_COLUMNS}
     FROM ZTB_MAIL_MESSAGE m
     LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = @EMPL
     WHERE ${conditions.join(" AND ")}
     ORDER BY m.RECEIVED_AT DESC, m.ID DESC`,
    params
  );
  return rows;
}

/** Đếm email chưa đọc (per-user). Dùng index che — KHÔNG quét toàn bảng khi có filter account. */
async function countUnread({ accountIds, emplNo }) {
  const inc = accountInClause(accountIds);
  if (!inc.ok) return 0;
  const row = await queryOne(
    `SELECT COUNT(*) AS CNT
     FROM ZTB_MAIL_MESSAGE m
     LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = @EMPL
     WHERE m.MAIL_ACCOUNT_ID IN ${inc.sql}
       AND m.DELETED_AT IS NULL AND us.DELETED_AT IS NULL
       AND ISNULL(us.IS_READ, m.IS_READ) = 0
       AND ISNULL(us.FOLDER_OVERRIDE, m.FOLDER) = 'INBOX'`,
    { EMPL: String(emplNo || "").trim().toUpperCase() }
  );
  return Number(row?.CNT || 0);
}

/* ------------------------------------------------------------------ */
/* Trạng thái theo user (ZTB_MAIL_USERSTATE)                           */
/* ------------------------------------------------------------------ */

async function upsertUserState({ messageId, emplNo, isRead, isStarred, isImportant, folderOverride, deleted }) {
  const empl = String(emplNo || "").trim().toUpperCase();
  const map = [];
  const params = { MSG: messageId, EMPL: empl };
  if (isRead !== undefined) { map.push("IS_READ = @READ"); params.READ = isRead ? 1 : 0; map.push("READ_AT = CASE WHEN @READ = 1 THEN GETDATE() ELSE NULL END"); }
  if (isStarred !== undefined) { map.push("IS_STARRED = @STAR"); params.STAR = isStarred ? 1 : 0; }
  if (isImportant !== undefined) { map.push("IS_IMPORTANT = @IMP"); params.IMP = isImportant ? 1 : 0; }
  if (folderOverride !== undefined) { map.push("FOLDER_OVERRIDE = @FOLDER"); params.FOLDER = folderOverride; }
  if (deleted !== undefined) { map.push("DELETED_AT = CASE WHEN @DEL = 1 THEN GETDATE() ELSE NULL END"); params.DEL = deleted ? 1 : 0; }

  // Tạo dòng nếu chưa có, rồi cập nhật.
  await queryRows(
    `IF NOT EXISTS (SELECT 1 FROM ZTB_MAIL_USERSTATE WHERE MESSAGE_ID=@MSG AND EMPL_NO=@EMPL)
       INSERT INTO ZTB_MAIL_USERSTATE (MESSAGE_ID, EMPL_NO) VALUES (@MSG, @EMPL)`,
    params
  );
  if (map.length > 0) {
    await queryRows(
      `UPDATE ZTB_MAIL_USERSTATE SET ${map.join(", ")}, UPDATED_AT = GETDATE()
       WHERE MESSAGE_ID=@MSG AND EMPL_NO=@EMPL`,
      params
    );
  }
}

/* ------------------------------------------------------------------ */
/* Hội thoại (thread)                                                  */
/* ------------------------------------------------------------------ */

async function findThreadByHeaderRef({ ctrCd, headerRef }) {
  if (!headerRef) return null;
  return queryOne(
    `SELECT TOP 1 t.ID FROM ZTB_MAIL_THREAD t
     JOIN ZTB_MAIL_MESSAGE m ON m.THREAD_ID = t.ID
     WHERE t.CTR_CD = @CTR AND (m.MESSAGE_ID = @REF OR m.IN_REPLY_TO = @REF)
     ORDER BY m.RECEIVED_AT DESC`,
    { CTR: ctrCd, REF: headerRef }
  );
}

async function createThread({ ctrCd, subjectNorm, participantKey }) {
  const rows = await queryRows(
    `INSERT INTO ZTB_MAIL_THREAD (CTR_CD, SUBJECT_NORM, PARTICIPANT_KEY, LAST_MESSAGE_AT, MESSAGE_COUNT)
     OUTPUT INSERTED.ID VALUES (@CTR, @SUBJECT, @PART, GETDATE(), 0)`,
    { CTR: ctrCd, SUBJECT: subjectNorm ?? null, PART: participantKey ?? null }
  );
  return rows[0]?.ID ?? null;
}

async function touchThread(threadId, when) {
  await queryRows(
    `UPDATE ZTB_MAIL_THREAD SET LAST_MESSAGE_AT = COALESCE(@WHEN, GETDATE()),
            MESSAGE_COUNT = MESSAGE_COUNT + 1 WHERE ID = @ID`,
    { ID: threadId, WHEN: when ?? null }
  );
}

async function listThreadMessages(threadId) {
  return queryRows(
    `SELECT ID, MAIL_ACCOUNT_ID, MESSAGE_ID, FROM_ADDRESS, FROM_NAME, SUBJECT, SENT_AT, RECEIVED_AT,
            HAS_ATTACHMENT, ATTACHMENT_COUNT, PREVIEW_TEXT, FOLDER, IS_READ, IS_STARRED
     FROM ZTB_MAIL_MESSAGE WHERE THREAD_ID = @ID AND DELETED_AT IS NULL
     ORDER BY ISNULL(RECEIVED_AT, SENT_AT) ASC, ID ASC`,
    { ID: threadId }
  );
}

/* ------------------------------------------------------------------ */
/* Đính kèm + file vật lý                                              */
/* ------------------------------------------------------------------ */

async function getPhysicalFileByHash(hash) {
  return queryOne(`SELECT * FROM ZTB_MAIL_PHYSICAL_FILE WHERE FILE_HASH = @HASH`, { HASH: hash });
}

async function insertPhysicalFile(tx, { hash, storagePath, size }) {
  const res = await tx.query(
    `INSERT INTO ZTB_MAIL_PHYSICAL_FILE (FILE_HASH, STORAGE_PATH, FILE_SIZE, REF_COUNT)
     OUTPUT INSERTED.ID VALUES (@HASH, @PATH, @SIZE, 0)`,
    { HASH: hash, PATH: storagePath, SIZE: size }
  );
  return res.recordset?.[0]?.ID ?? null;
}

async function incrementPhysicalRef(tx, physicalId) {
  await tx.query(`UPDATE ZTB_MAIL_PHYSICAL_FILE SET REF_COUNT = REF_COUNT + 1 WHERE ID = @ID`, { ID: physicalId });
}

/** Lấy hoặc tạo file vật lý theo hash trong transaction, rồi +1 REF_COUNT. */
async function ensurePhysicalFileTx(tx, { hash, storagePath, size }) {
  const found = await tx.query(`SELECT ID FROM ZTB_MAIL_PHYSICAL_FILE WHERE FILE_HASH = @HASH`, { HASH: hash });
  let id = found.recordset?.[0]?.ID ?? null;
  if (!id) id = await insertPhysicalFile(tx, { hash, storagePath, size });
  await incrementPhysicalRef(tx, id);
  return id;
}

async function decrementPhysicalRef(tx, physicalId) {
  await tx.query(
    `UPDATE ZTB_MAIL_PHYSICAL_FILE SET REF_COUNT = CASE WHEN REF_COUNT > 0 THEN REF_COUNT - 1 ELSE 0 END
     WHERE ID = @ID`,
    { ID: physicalId }
  );
}

async function insertAttachment(tx, fields) {
  const res = await tx.query(
    `INSERT INTO ZTB_MAIL_ATTACHMENT
       (MESSAGE_ID, FILE_NAME, CONTENT_TYPE, FILE_SIZE, CONTENT_ID, IS_INLINE, FILE_HASH, PHYSICAL_FILE_ID, STATUS)
     OUTPUT INSERTED.ID
     VALUES (@MSG, @NAME, @TYPE, @SIZE, @CID, @INLINE, @HASH, @PFID, @STATUS)`,
    {
      MSG: fields.messageId,
      NAME: fields.fileName ?? null,
      TYPE: fields.contentType ?? null,
      SIZE: fields.fileSize ?? null,
      CID: fields.contentId ?? null,
      INLINE: fields.isInline ? 1 : 0,
      HASH: fields.fileHash ?? null,
      PFID: fields.physicalFileId ?? null,
      STATUS: fields.status || "PENDING",
    }
  );
  return res.recordset?.[0]?.ID ?? null;
}

async function updateAttachmentStatus(id, { status, physicalFileId, fileHash, fileSize }) {
  const sets = ["STATUS = @STATUS"];
  const params = { ID: id, STATUS: status };
  if (physicalFileId !== undefined) { sets.push("PHYSICAL_FILE_ID = @PFID"); params.PFID = physicalFileId; }
  if (fileHash !== undefined) { sets.push("FILE_HASH = @HASH"); params.HASH = fileHash; }
  if (fileSize !== undefined) { sets.push("FILE_SIZE = @SIZE"); params.SIZE = fileSize; }
  await queryRows(`UPDATE ZTB_MAIL_ATTACHMENT SET ${sets.join(", ")} WHERE ID = @ID`, params);
}

/** Đổi cờ ẢNH TRONG NỘI DUNG (`IS_INLINE`) của 1 đính kèm — dùng cho sửa dữ liệu/hậu kiểm. */
async function setAttachmentInline(id, isInline) {
  await queryRows(`UPDATE ZTB_MAIL_ATTACHMENT SET IS_INLINE = @INLINE WHERE ID = @ID`, {
    ID: id,
    INLINE: isInline ? 1 : 0,
  });
}

/**
 * Tính lại `HAS_ATTACHMENT` / `ATTACHMENT_COUNT` cho MỌI email có đính kèm,
 * chỉ đếm TỆP ĐÍNH KÈM THẬT (`IS_INLINE = 0`). Dùng sau khi sửa cờ inline.
 */
async function recalcAllAttachmentMeta() {
  const rows = await queryRows(
    `UPDATE m
       SET m.HAS_ATTACHMENT = CASE WHEN x.CNT > 0 THEN 1 ELSE 0 END,
           m.ATTACHMENT_COUNT = ISNULL(x.CNT, 0)
     OUTPUT INSERTED.ID, INSERTED.HAS_ATTACHMENT, INSERTED.ATTACHMENT_COUNT
     FROM ZTB_MAIL_MESSAGE m
     CROSS APPLY (
       SELECT COUNT(*) AS CNT FROM ZTB_MAIL_ATTACHMENT a
       WHERE a.MESSAGE_ID = m.ID AND a.IS_INLINE = 0
     ) x
     WHERE EXISTS (SELECT 1 FROM ZTB_MAIL_ATTACHMENT a2 WHERE a2.MESSAGE_ID = m.ID)`
  );
  return rows.length;
}

async function listAttachmentsByMessage(messageId) {
  return queryRows(
    `SELECT a.ID, a.MESSAGE_ID, a.FILE_NAME, a.CONTENT_TYPE, a.FILE_SIZE, a.CONTENT_ID,
            a.IS_INLINE, a.FILE_HASH, a.PHYSICAL_FILE_ID, a.STATUS,
            pf.STORAGE_PATH
     FROM ZTB_MAIL_ATTACHMENT a
     LEFT JOIN ZTB_MAIL_PHYSICAL_FILE pf ON pf.ID = a.PHYSICAL_FILE_ID
     WHERE a.MESSAGE_ID = @ID ORDER BY a.IS_INLINE DESC, a.ID`,
    { ID: messageId }
  );
}

async function getAttachmentById(id) {
  return queryOne(
    `SELECT a.*, pf.STORAGE_PATH, m.MAIL_ACCOUNT_ID, m.FOLDER
     FROM ZTB_MAIL_ATTACHMENT a
     JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID
     LEFT JOIN ZTB_MAIL_PHYSICAL_FILE pf ON pf.ID = a.PHYSICAL_FILE_ID
     WHERE a.ID = @ID`,
    { ID: id }
  );
}

async function listFailedAttachments({ limit = 100 } = {}) {
  return queryRows(
    `SELECT TOP (@LIMIT) a.ID, a.MESSAGE_ID, a.FILE_NAME, a.STATUS
     FROM ZTB_MAIL_ATTACHMENT a WHERE a.STATUS = 'FAILED' ORDER BY a.ID`,
    { LIMIT: Math.min(Number(limit) || 100, 500) }
  );
}

async function listOrphanPhysicalFiles({ limit = 200 } = {}) {
  return queryRows(
    `SELECT TOP (@LIMIT) ID, STORAGE_PATH, FILE_HASH FROM ZTB_MAIL_PHYSICAL_FILE WHERE REF_COUNT <= 0`,
    { LIMIT: Math.min(Number(limit) || 200, 1000) }
  );
}

async function deletePhysicalFile(id) {
  await queryRows(`DELETE FROM ZTB_MAIL_PHYSICAL_FILE WHERE ID = @ID`, { ID: id });
}

/** Email kèm account (để kiểm quyền khi tải). */
async function getMessageWithAccount(id) {
  return queryOne(
    `SELECT m.*, a.CTR_CD, a.EMPL_NO AS ACCOUNT_EMPL_NO, a.IS_SHARED
     FROM ZTB_MAIL_MESSAGE m JOIN ZTB_MAIL_ACCOUNT a ON a.ID = m.MAIL_ACCOUNT_ID
     WHERE m.ID = @ID`,
    { ID: id }
  );
}

module.exports = {
  accountInClause,
  findMessageByDedup,
  insertMessage,
  insertRecipients,
  updateMessageAttachmentMeta,
  getMessageById,
  listExistingUidls,
  getMessageWithAccount,
  listInbox,
  listMessagesSince,
  countUnread,
  searchMessages,
  countSearchResults,
  upsertUserState,
  findThreadByHeaderRef,
  createThread,
  touchThread,
  listThreadMessages,
  getPhysicalFileByHash,
  insertPhysicalFile,
  ensurePhysicalFileTx,
  incrementPhysicalRef,
  decrementPhysicalRef,
  insertAttachment,
  updateAttachmentStatus,
  setAttachmentInline,
  recalcAllAttachmentMeta,
  listAttachmentsByMessage,
  getAttachmentById,
  listFailedAttachments,
  listOrphanPhysicalFiles,
  deletePhysicalFile,
};
