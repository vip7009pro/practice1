/**
 * Lớp truy cập dữ liệu cho Chat nội bộ.
 *
 * Mọi hàm ở đây KHÔNG kiểm tra quyền — quyền được kiểm ở tầng service
 * (`chatRoomService`) và ở Socket.IO handler. Repository chỉ lo SQL.
 */
const { openConnection, openDedicatedConnection } = require("../../config/database");

const MAX_MESSAGE_LENGTH = 4000;

async function queryRows(sql, params = {}) {
  const pool = await openConnection();
  const result = await pool.query(sql, params);
  return result.recordset || [];
}

async function queryOne(sql, params = {}) {
  const rows = await queryRows(sql, params);
  return rows[0];
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

/** Khoá định danh phòng chat 1-1: sort để A-B và B-A cho cùng khoá. */
function buildDirectKey(a, b) {
  return [String(a).trim().toUpperCase(), String(b).trim().toUpperCase()].sort().join("|");
}

/* ------------------------------------------------------------------ */
/* Nhân sự                                                             */
/* ------------------------------------------------------------------ */

const EMPLOYEE_SELECT = `
  SELECT TOP (@LIMIT)
         e.EMPL_NO, e.CMS_ID, e.FIRST_NAME, e.MIDLAST_NAME, e.EMPL_IMAGE,
         j.JOB_NAME, wp.SUBDEPTCODE, sd.SUBDEPTNAME, md.MAINDEPTNAME
  FROM ZTBEMPLINFO e
  LEFT JOIN ZTBJOB j
         ON j.JOB_CODE = e.JOB_CODE AND j.CTR_CD = e.CTR_CD
  LEFT JOIN ZTBWORKPOSITION wp
         ON wp.WORK_POSITION_CODE = e.WORK_POSITION_CODE AND wp.CTR_CD = e.CTR_CD
  LEFT JOIN ZTBSUBDEPARTMENT sd
         ON sd.SUBDEPTCODE = wp.SUBDEPTCODE AND sd.CTR_CD = wp.CTR_CD
  LEFT JOIN ZTBMAINDEPARMENT md
         ON md.MAINDEPTCODE = sd.MAINDEPTCODE AND md.CTR_CD = sd.CTR_CD
  WHERE e.CTR_CD = @CTR_CD
    AND ISNULL(e.WORK_STATUS_CODE, 0) <> 0
    AND (@KEYWORD_EMPTY = 1
         OR e.EMPL_NO LIKE @KEYWORD
         OR e.CMS_ID LIKE @KEYWORD
         OR (ISNULL(e.MIDLAST_NAME,'') + N' ' + ISNULL(e.FIRST_NAME,'')) LIKE @KEYWORD)
  ORDER BY e.EMPL_NO`;

async function searchEmployees({ ctrCd, keyword, limit = 30 }) {
  const trimmed = String(keyword || "").trim();
  return queryRows(
    EMPLOYEE_SELECT,
    {
      CTR_CD: ctrCd,
      LIMIT: Math.min(Math.max(Number(limit) || 30, 1), 100),
      KEYWORD: `%${trimmed}%`,
      KEYWORD_EMPTY: trimmed.length === 0 ? 1 : 0,
    }
  );
}

async function getEmployeesByNos({ ctrCd, emplNos }) {
  const list = (emplNos || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean);
  if (list.length === 0) return [];
  const placeholders = list.map((_, index) => `@E${index}`).join(",");
  const params = { CTR_CD: ctrCd };
  list.forEach((value, index) => {
    params[`E${index}`] = value;
  });
  return queryRows(
    `SELECT e.EMPL_NO, e.CMS_ID, e.FIRST_NAME, e.MIDLAST_NAME, e.EMPL_IMAGE, j.JOB_NAME,
            sd.SUBDEPTNAME, md.MAINDEPTNAME
     FROM ZTBEMPLINFO e
     LEFT JOIN ZTBJOB j
            ON j.JOB_CODE = e.JOB_CODE AND j.CTR_CD = e.CTR_CD
     LEFT JOIN ZTBWORKPOSITION wp
            ON wp.WORK_POSITION_CODE = e.WORK_POSITION_CODE AND wp.CTR_CD = e.CTR_CD
     LEFT JOIN ZTBSUBDEPARTMENT sd
            ON sd.SUBDEPTCODE = wp.SUBDEPTCODE AND sd.CTR_CD = wp.CTR_CD
     LEFT JOIN ZTBMAINDEPARMENT md
            ON md.MAINDEPTCODE = sd.MAINDEPTCODE AND md.CTR_CD = sd.CTR_CD
     WHERE e.CTR_CD = @CTR_CD AND e.EMPL_NO IN (${placeholders})`,
    params
  );
}

/* ------------------------------------------------------------------ */
/* Phòng chat                                                          */
/* ------------------------------------------------------------------ */

async function getConversationById({ ctrCd, conversationId }) {
  return queryOne(
    `SELECT * FROM ZTB_CHAT_CONVERSATION
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND CTR_CD = @CTR_CD`,
    { CONVERSATION_ID: Number(conversationId), CTR_CD: ctrCd }
  );
}

/**
 * Tìm hội thoại 1-1 theo khoá định danh.
 *
 * KHÔNG lọc DELETED_AT: unique index UX_CHAT_CONV_DIRECT áp cho mọi dòng, nên nếu
 * lọc bỏ dòng đã soft-delete thì lần mở lại sẽ vi phạm khoá duy nhất.
 */
async function findDirectConversation({ ctrCd, directKey }) {
  return queryOne(
    `SELECT * FROM ZTB_CHAT_CONVERSATION WHERE CTR_CD = @CTR_CD AND DIRECT_KEY = @DIRECT_KEY`,
    { CTR_CD: ctrCd, DIRECT_KEY: directKey }
  );
}

/** Phục hồi hội thoại đã soft-delete (không xoá vật lý, không tạo dòng mới). */
async function reviveConversation({ conversationId }) {
  const pool = await openConnection();
  await pool.query(
    `UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = NULL, UPDATED_AT = GETDATE()
     WHERE CONVERSATION_ID = @CONVERSATION_ID`,
    { CONVERSATION_ID: Number(conversationId) }
  );
}

/** Đảm bảo 1 người có mặt và đang hoạt động trong phòng (thêm lại nếu đã rời). */
async function ensureParticipant({ ctrCd, conversationId, emplNo, role = "MEMBER" }) {
  const pool = await openConnection();
  await pool.query(
    `IF EXISTS (SELECT 1 FROM ZTB_CHAT_PARTICIPANT WHERE CONVERSATION_ID=@CONVERSATION_ID AND EMPL_NO=@EMPL_NO)
       UPDATE ZTB_CHAT_PARTICIPANT SET LEFT_AT = NULL WHERE CONVERSATION_ID=@CONVERSATION_ID AND EMPL_NO=@EMPL_NO
     ELSE
       INSERT INTO ZTB_CHAT_PARTICIPANT (CONVERSATION_ID, EMPL_NO, CTR_CD, ROLE)
       VALUES (@CONVERSATION_ID, @EMPL_NO, @CTR_CD, @ROLE)`,
    {
      CONVERSATION_ID: Number(conversationId),
      EMPL_NO: String(emplNo).trim().toUpperCase(),
      CTR_CD: ctrCd,
      ROLE: role,
    }
  );
}

async function listConversations({ ctrCd, emplNo }) {
  return queryRows(
    `SELECT c.CONVERSATION_ID, c.CONV_TYPE, c.TITLE, c.AVATAR, c.OWNER_EMPL_NO,
            c.LAST_MESSAGE_ID, c.LAST_MESSAGE_AT, c.CREATED_AT,
            p.ROLE, p.MUTED, p.LAST_READ_MESSAGE_ID,
            m.SENDER_EMPL_NO AS LAST_SENDER, m.MSG_TYPE AS LAST_TYPE,
            m.CONTENT AS LAST_CONTENT, m.CREATED_AT AS LAST_CREATED_AT,
            m.DELETED_AT AS LAST_DELETED_AT,
            (SELECT COUNT(1) FROM ZTB_CHAT_MESSAGE um
              WHERE um.CONVERSATION_ID = c.CONVERSATION_ID
                AND um.DELETED_AT IS NULL
                AND um.SENDER_EMPL_NO <> @EMPL_NO
                AND (p.LAST_READ_MESSAGE_ID IS NULL OR um.MESSAGE_ID > p.LAST_READ_MESSAGE_ID)
            ) AS UNREAD_COUNT
     FROM ZTB_CHAT_PARTICIPANT p
     INNER JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = p.CONVERSATION_ID
     LEFT JOIN ZTB_CHAT_MESSAGE m ON m.MESSAGE_ID = c.LAST_MESSAGE_ID
     WHERE p.EMPL_NO = @EMPL_NO AND p.CTR_CD = @CTR_CD
       AND p.LEFT_AT IS NULL AND c.DELETED_AT IS NULL
     ORDER BY ISNULL(c.LAST_MESSAGE_AT, c.CREATED_AT) DESC`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo }
  );
}

/** Thành viên của nhiều phòng (để FE hiển thị tên/avatar) — không phân trang. */
async function listMembersForConversations({ ctrCd, conversationIds }) {
  const ids = (conversationIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return [];
  return queryRows(
    `SELECT p.CONVERSATION_ID, p.EMPL_NO, p.ROLE, p.LEFT_AT,
            e.CMS_ID, e.FIRST_NAME, e.MIDLAST_NAME, e.EMPL_IMAGE, j.JOB_NAME
     FROM ZTB_CHAT_PARTICIPANT p
     LEFT JOIN ZTBEMPLINFO e ON e.CTR_CD = p.CTR_CD AND e.EMPL_NO = p.EMPL_NO
     LEFT JOIN ZTBJOB j ON j.JOB_CODE = e.JOB_CODE AND j.CTR_CD = e.CTR_CD
     WHERE p.CTR_CD = @CTR_CD AND p.CONVERSATION_ID IN (${ids.join(",")})
     ORDER BY p.CONVERSATION_ID, p.EMPL_NO`,
    { CTR_CD: ctrCd }
  );
}

async function getParticipant({ conversationId, emplNo }) {
  return queryOne(
    `SELECT * FROM ZTB_CHAT_PARTICIPANT
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @EMPL_NO`,
    { CONVERSATION_ID: Number(conversationId), EMPL_NO: emplNo }
  );
}

/** Chỉ những thành viên còn hoạt động (chưa rời nhóm). */
async function listActiveMemberNos({ conversationId }) {
  const rows = await queryRows(
    `SELECT EMPL_NO, ROLE FROM ZTB_CHAT_PARTICIPANT
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND LEFT_AT IS NULL`,
    { CONVERSATION_ID: Number(conversationId) }
  );
  return rows;
}

/* ------------------------------------------------------------------ */
/* Tin nhắn                                                           */
/* ------------------------------------------------------------------ */

async function listMessages({ conversationId, beforeMessageId, limit = 40 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const before = Number(beforeMessageId);
  const hasCursor = Number.isInteger(before) && before > 0;
  const rows = await queryRows(
    `SELECT TOP (@LIMIT) * FROM ZTB_CHAT_MESSAGE
     WHERE CONVERSATION_ID = @CONVERSATION_ID
       ${hasCursor ? "AND MESSAGE_ID < @BEFORE_ID" : ""}
     ORDER BY MESSAGE_ID DESC`,
    {
      LIMIT: safeLimit,
      CONVERSATION_ID: Number(conversationId),
      ...(hasCursor ? { BEFORE_ID: before } : {}),
    }
  );
  return rows.reverse();
}

async function findMessageByClientId({ ctrCd, senderEmplNo, clientMessageId }) {
  if (!clientMessageId) return null;
  return queryOne(
    `SELECT * FROM ZTB_CHAT_MESSAGE
     WHERE CTR_CD = @CTR_CD AND SENDER_EMPL_NO = @SENDER_EMPL_NO AND CLIENT_MESSAGE_ID = @CLIENT_MESSAGE_ID`,
    { CTR_CD: ctrCd, SENDER_EMPL_NO: senderEmplNo, CLIENT_MESSAGE_ID: clientMessageId }
  );
}

/**
 * Ghi tin nhắn + cập nhật con trỏ phòng trong 1 transaction.
 * Trả về { message, duplicated } — duplicated = true khi chống gửi trùng.
 */
async function insertMessage({
  ctrCd,
  conversationId,
  senderEmplNo,
  msgType = "TEXT",
  content,
  mentions,
  replyToMessageId,
  clientMessageId,
  attachmentIds,
}) {
  return withTransaction(async ({ query }) => {
    if (clientMessageId) {
      const existing = await query(
        `SELECT * FROM ZTB_CHAT_MESSAGE
         WHERE CTR_CD = @CTR_CD AND SENDER_EMPL_NO = @SENDER_EMPL_NO AND CLIENT_MESSAGE_ID = @CLIENT_MESSAGE_ID`,
        { CTR_CD: ctrCd, SENDER_EMPL_NO: senderEmplNo, CLIENT_MESSAGE_ID: clientMessageId }
      );
      if (existing.recordset && existing.recordset.length > 0) {
        return { message: existing.recordset[0], duplicated: true };
      }
    }

    const inserted = await query(
      `INSERT INTO ZTB_CHAT_MESSAGE
         (CONVERSATION_ID, CTR_CD, SENDER_EMPL_NO, MSG_TYPE, CONTENT, MENTIONS, REPLY_TO_MESSAGE_ID, CLIENT_MESSAGE_ID)
       OUTPUT INSERTED.*
       VALUES (@CONVERSATION_ID, @CTR_CD, @SENDER_EMPL_NO, @MSG_TYPE, @CONTENT, @MENTIONS, @REPLY_TO_MESSAGE_ID, @CLIENT_MESSAGE_ID)`,
      {
        CONVERSATION_ID: Number(conversationId),
        CTR_CD: ctrCd,
        SENDER_EMPL_NO: senderEmplNo,
        MSG_TYPE: msgType,
        CONTENT: content ? String(content).slice(0, MAX_MESSAGE_LENGTH) : null,
        MENTIONS: mentions ? JSON.stringify(mentions).slice(0, 1000) : null,
        REPLY_TO_MESSAGE_ID: Number.isInteger(Number(replyToMessageId)) && Number(replyToMessageId) > 0
          ? Number(replyToMessageId)
          : null,
        CLIENT_MESSAGE_ID: clientMessageId || null,
      }
    );

    const message = inserted.recordset[0];

    if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      const ids = attachmentIds.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
      if (ids.length > 0) {
        await query(
          `UPDATE ZTB_CHAT_ATTACHMENT SET MESSAGE_ID = @MESSAGE_ID
           WHERE ATTACHMENT_ID IN (${ids.join(",")}) AND CONVERSATION_ID = @CONVERSATION_ID
             AND UPLOADED_BY = @UPLOADED_BY AND MESSAGE_ID IS NULL`,
          {
            MESSAGE_ID: message.MESSAGE_ID,
            CONVERSATION_ID: Number(conversationId),
            UPLOADED_BY: senderEmplNo,
          }
        );
      }
    }

    await query(
      `UPDATE ZTB_CHAT_CONVERSATION
       SET LAST_MESSAGE_ID = @MESSAGE_ID, LAST_MESSAGE_AT = @CREATED_AT, UPDATED_AT = GETDATE()
       WHERE CONVERSATION_ID = @CONVERSATION_ID`,
      { MESSAGE_ID: message.MESSAGE_ID, CREATED_AT: message.CREATED_AT, CONVERSATION_ID: Number(conversationId) }
    );

    return { message, duplicated: false };
  });
}

async function markRead({ ctrCd, conversationId, emplNo, lastMessageId }) {
  const pool = await openConnection();
  const result = await pool.query(
    `UPDATE ZTB_CHAT_PARTICIPANT
     SET LAST_READ_MESSAGE_ID = CASE
           WHEN LAST_READ_MESSAGE_ID IS NULL OR LAST_READ_MESSAGE_ID < @LAST_MESSAGE_ID THEN @LAST_MESSAGE_ID
           ELSE LAST_READ_MESSAGE_ID END
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @EMPL_NO AND CTR_CD = @CTR_CD`,
    {
      LAST_MESSAGE_ID: Number(lastMessageId) || 0,
      CONVERSATION_ID: Number(conversationId),
      EMPL_NO: emplNo,
      CTR_CD: ctrCd,
    }
  );
  return result.rowsAffected?.[0] || 0;
}

async function softDeleteMessage({ conversationId, messageId, actorEmplNo, allowAny }) {
  const pool = await openConnection();
  const result = await pool.query(
    `UPDATE ZTB_CHAT_MESSAGE
     SET DELETED_AT = GETDATE()
     WHERE MESSAGE_ID = @MESSAGE_ID AND CONVERSATION_ID = @CONVERSATION_ID
       AND DELETED_AT IS NULL
       ${allowAny ? "" : "AND SENDER_EMPL_NO = @ACTOR"}`,
    {
      MESSAGE_ID: Number(messageId),
      CONVERSATION_ID: Number(conversationId),
      ...(allowAny ? {} : { ACTOR: actorEmplNo }),
    }
  );
  return result.rowsAffected?.[0] || 0;
}

async function listAttachmentsByMessageIds({ conversationId, messageIds }) {
  const ids = (messageIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return [];
  return queryRows(
    `SELECT ATTACHMENT_ID, MESSAGE_ID, ORIGINAL_NAME, MIME_TYPE, FILE_SIZE
     FROM ZTB_CHAT_ATTACHMENT
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND DELETED_AT IS NULL AND MESSAGE_ID IN (${ids.join(",")})`,
    { CONVERSATION_ID: Number(conversationId) }
  );
}

async function getAttachmentById({ attachmentId }) {
  return queryOne(
    `SELECT * FROM ZTB_CHAT_ATTACHMENT WHERE ATTACHMENT_ID = @ATTACHMENT_ID AND DELETED_AT IS NULL`,
    { ATTACHMENT_ID: Number(attachmentId) }
  );
}

async function insertAttachment(record) {
  const inserted = await queryRows(
    `INSERT INTO ZTB_CHAT_ATTACHMENT
       (CONVERSATION_ID, CTR_CD, ORIGINAL_NAME, STORED_NAME, STORAGE_PATH, MIME_TYPE, FILE_SIZE, UPLOADED_BY)
     OUTPUT INSERTED.ATTACHMENT_ID, INSERTED.ORIGINAL_NAME, INSERTED.MIME_TYPE, INSERTED.FILE_SIZE
     VALUES (@CONVERSATION_ID, @CTR_CD, @ORIGINAL_NAME, @STORED_NAME, @STORAGE_PATH, @MIME_TYPE, @FILE_SIZE, @UPLOADED_BY)`,
    {
      CONVERSATION_ID: Number(record.conversationId),
      CTR_CD: record.ctrCd,
      ORIGINAL_NAME: String(record.originalName || "").slice(0, 300),
      STORED_NAME: record.storedName,
      STORAGE_PATH: record.storagePath,
      MIME_TYPE: record.mimeType || null,
      FILE_SIZE: Number(record.fileSize) || 0,
      UPLOADED_BY: record.uploadedBy,
    }
  );
  return inserted[0];
}

/* ------------------------------------------------------------------ */
/* Bạn bè                                                             */
/* ------------------------------------------------------------------ */

async function listFriends({ ctrCd, emplNo }) {
  return queryRows(
    `SELECT FRIEND_ID, REQUESTER, RECIPIENT, STATUS, CREATED_AT, UPDATED_AT
     FROM ZTB_CHAT_FRIEND
     WHERE CTR_CD = @CTR_CD AND STATUS = 'ACCEPTED'
       AND (REQUESTER = @EMPL_NO OR RECIPIENT = @EMPL_NO)`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo }
  );
}

async function listFriendRequests({ ctrCd, emplNo }) {
  return queryRows(
    `SELECT FRIEND_ID, REQUESTER, RECIPIENT, STATUS, CREATED_AT
     FROM ZTB_CHAT_FRIEND
     WHERE CTR_CD = @CTR_CD AND STATUS = 'PENDING'
       AND (REQUESTER = @EMPL_NO OR RECIPIENT = @EMPL_NO)`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo }
  );
}

async function findFriendRequest({ ctrCd, requester, recipient }) {
  return queryOne(
    `SELECT TOP 1 * FROM ZTB_CHAT_FRIEND
     WHERE CTR_CD = @CTR_CD
       AND ((REQUESTER = @REQUESTER AND RECIPIENT = @RECIPIENT)
         OR (REQUESTER = @RECIPIENT AND RECIPIENT = @REQUESTER))
       AND STATUS IN ('PENDING','ACCEPTED')
     ORDER BY FRIEND_ID DESC`,
    { CTR_CD: ctrCd, REQUESTER: requester, RECIPIENT: recipient }
  );
}

async function insertFriendRequest({ ctrCd, requester, recipient }) {
  const rows = await queryRows(
    `INSERT INTO ZTB_CHAT_FRIEND (CTR_CD, REQUESTER, RECIPIENT, STATUS)
     OUTPUT INSERTED.*
     VALUES (@CTR_CD, @REQUESTER, @RECIPIENT, 'PENDING')`,
    { CTR_CD: ctrCd, REQUESTER: requester, RECIPIENT: recipient }
  );
  return rows[0];
}

async function updateFriendStatus({ ctrCd, friendId, status, actorEmplNo }) {
  const pool = await openConnection();
  const result = await pool.query(
    `UPDATE ZTB_CHAT_FRIEND
     SET STATUS = @STATUS, UPDATED_AT = GETDATE()
     WHERE FRIEND_ID = @FRIEND_ID AND CTR_CD = @CTR_CD
       AND STATUS = 'PENDING'
       AND (REQUESTER = @ACTOR OR RECIPIENT = @ACTOR)`,
    {
      STATUS: status,
      FRIEND_ID: Number(friendId),
      CTR_CD: ctrCd,
      ACTOR: actorEmplNo,
    }
  );
  return result.rowsAffected?.[0] || 0;
}

async function writeAudit({ ctrCd, conversationId, actor, action, target, detail }) {
  try {
    const pool = await openConnection();
    await pool.query(
      `INSERT INTO ZTB_CHAT_AUDIT (CTR_CD, CONVERSATION_ID, ACTOR, ACTION, TARGET, DETAIL)
       VALUES (@CTR_CD, @CONVERSATION_ID, @ACTOR, @ACTION, @TARGET, @DETAIL)`,
      {
        CTR_CD: ctrCd || null,
        CONVERSATION_ID: Number.isInteger(Number(conversationId)) && Number(conversationId) > 0
          ? Number(conversationId)
          : null,
        ACTOR: actor || null,
        ACTION: String(action).slice(0, 50),
        TARGET: target ? String(target).slice(0, 100) : null,
        DETAIL: detail ? String(detail).slice(0, 1000) : null,
      }
    );
  } catch (error) {
    console.warn("[chat] Không ghi được audit:", error?.message || error);
  }
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  buildDirectKey,
  withTransaction,
  queryRows,
  queryOne,
  searchEmployees,
  getEmployeesByNos,
  getConversationById,
  findDirectConversation,
  reviveConversation,
  ensureParticipant,
  listConversations,
  listMembersForConversations,
  getParticipant,
  listActiveMemberNos,
  listMessages,
  findMessageByClientId,
  insertMessage,
  markRead,
  softDeleteMessage,
  listAttachmentsByMessageIds,
  getAttachmentById,
  insertAttachment,
  listFriends,
  listFriendRequests,
  findFriendRequest,
  insertFriendRequest,
  updateFriendStatus,
  writeAudit,
};
