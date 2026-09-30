/**
 * Lớp truy cập dữ liệu cho Chat nội bộ.
 *
 * Mọi hàm ở đây KHÔNG kiểm tra quyền — quyền được kiểm ở tầng service
 * (`chatRoomService`) và ở Socket.IO handler. Repository chỉ lo SQL.
 */
const { openConnection, openDedicatedConnection } = require("../../config/database");

const MAX_MESSAGE_LENGTH = 4000;
/** Tin RICHTEXT lưu HTML nên cần trần ký tự rộng hơn tin thường. */
const MAX_RICH_MESSAGE_LENGTH = 20000;
/** Loại tin hợp lệ — khai báo tại đây để repository không phụ thuộc vào tầng core. */
const MSG_TYPES = new Set(["TEXT", "IMAGE", "FILE", "SYSTEM", "RICH"]);

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

/**
 * Giới hạn tối đa cho 1 lần tìm nhân sự.
 * Nút "Chọn tất cả" (tạo phòng toàn công ty) cần lấy hết ~300 nhân sự trong 1 lần gọi.
 */
const MAX_EMPLOYEE_SEARCH_LIMIT = 5000;

// ⚠️ `ZTBEMPLINFO.EMPL_NO` là varchar nhưng dữ liệu có thể chứa KHOẢNG TRẮNG Ở ĐẦU
// (ví dụ ' TKD1605') ⇒ luôn LTRIM/RTRIM khi trả về FE, nếu không filter "trừ chính mình"
// và việc so khớp mã nhân sự ở FE sẽ sai.
const EMPLOYEE_SELECT = `
  SELECT TOP (@LIMIT)
         LTRIM(RTRIM(e.EMPL_NO)) AS EMPL_NO,
         LTRIM(RTRIM(e.CMS_ID)) AS CMS_ID,
         e.FIRST_NAME, e.MIDLAST_NAME, e.EMPL_IMAGE,
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
      LIMIT: Math.min(Math.max(Number(limit) || 30, 1), MAX_EMPLOYEE_SEARCH_LIMIT),
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
    `SELECT LTRIM(RTRIM(e.EMPL_NO)) AS EMPL_NO, LTRIM(RTRIM(e.CMS_ID)) AS CMS_ID,
            e.FIRST_NAME, e.MIDLAST_NAME, e.EMPL_IMAGE, j.JOB_NAME,
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
     WHERE e.CTR_CD = @CTR_CD AND LTRIM(RTRIM(e.EMPL_NO)) IN (${placeholders})`,
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
            p.ROLE, p.MUTED, p.MUTED_UNTIL, p.PINNED_AT, p.LAST_READ_MESSAGE_ID,
            -- Số giây còn tắt thông báo (NULL = đang nhận). Tính bằng giờ máy chủ để FE
            -- không phải xử lý lệch múi giờ.
            -- ⚠️ Mốc "cho tới khi mở lại" là 9999-12-31 ⇒ DATEDIFF(SECOND...) sẽ TRÀN INT
            -- (> 68 năm) và làm hỏng cả câu query, nên phải chặn trần 1 năm trước.
            CASE WHEN p.MUTED_UNTIL IS NOT NULL AND p.MUTED_UNTIL > GETDATE()
                 THEN CASE WHEN p.MUTED_UNTIL >= '9000-01-01'
                           THEN 31536000
                           ELSE DATEDIFF(SECOND, GETDATE(), p.MUTED_UNTIL) END
            END AS MUTED_SECONDS_LEFT,
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
     -- Ghim trước (ghim MỚI hơn lên trên), rồi tới phòng có hoạt động mới nhất.
     ORDER BY CASE WHEN p.PINNED_AT IS NULL THEN 1 ELSE 0 END,
              p.PINNED_AT DESC,
              ISNULL(c.LAST_MESSAGE_AT, c.CREATED_AT) DESC`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo }
  );
}

/**
 * Ghim / bỏ ghim 1 phòng cho RIÊNG người dùng hiện tại.
 * Ghim lại lần nữa ⇒ cập nhật lại mốc thời gian để được đẩy lên đầu danh sách.
 */
async function setConversationPinned({ ctrCd, conversationId, emplNo, pinned }) {
  return queryOne(
    `UPDATE ZTB_CHAT_PARTICIPANT
     SET PINNED_AT = CASE WHEN @PINNED = 1 THEN GETDATE() ELSE NULL END
     OUTPUT INSERTED.PINNED_AT
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`,
    {
      CONVERSATION_ID: conversationId,
      CTR_CD: ctrCd,
      EMPL_NO: emplNo,
      PINNED: pinned ? 1 : 0,
    }
  );
}

/**
 * Tắt/bật thông báo cho RIÊNG người dùng ở 1 phòng.
 * `mutedUntil` = null ⇒ bật lại; Date trong tương lai ⇒ tắt tới mốc đó.
 * (FE gửi mốc `9999-12-31` cho lựa chọn "cho tới khi mở lại phòng".)
 */
async function setConversationMute({ ctrCd, conversationId, emplNo, mutedUntil }) {
  return queryOne(
    `UPDATE ZTB_CHAT_PARTICIPANT
     SET MUTED_UNTIL = @MUTED_UNTIL
     OUTPUT INSERTED.MUTED_UNTIL
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`,
    {
      CONVERSATION_ID: conversationId,
      CTR_CD: ctrCd,
      EMPL_NO: emplNo,
      MUTED_UNTIL: mutedUntil || null,
    }
  );
}

/** Những thành viên đang TẮT thông báo ở 1 phòng (để bỏ qua khi push offline). */
async function listMutedMemberNos({ conversationId }) {
  const rows = await queryRows(
    `SELECT LTRIM(RTRIM(EMPL_NO)) AS EMPL_NO FROM ZTB_CHAT_PARTICIPANT
     WHERE CONVERSATION_ID = @CONVERSATION_ID AND LEFT_AT IS NULL
       AND MUTED_UNTIL IS NOT NULL AND MUTED_UNTIL > GETDATE()`,
    { CONVERSATION_ID: Number(conversationId) }
  );
  return rows.map((row) => String(row.EMPL_NO || "").trim().toUpperCase()).filter(Boolean);
}

/** Thành viên của nhiều phòng (để FE hiển thị tên/avatar) — không phân trang. */
async function listMembersForConversations({ ctrCd, conversationIds }) {
  const ids = (conversationIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return [];
  return queryRows(
    `SELECT p.CONVERSATION_ID, LTRIM(RTRIM(p.EMPL_NO)) AS EMPL_NO, p.ROLE, p.LEFT_AT,
            p.LAST_READ_MESSAGE_ID,
            e.CMS_ID, e.FIRST_NAME, e.MIDLAST_NAME, e.EMPL_IMAGE, j.JOB_NAME
     FROM ZTB_CHAT_PARTICIPANT p
     -- Cột ZTBEMPLINFO.EMPL_NO có thể chứa khoảng trắng ở đầu ⇒ so khớp sau khi trim,
     -- nếu không thì tên/ảnh của nhân sự đó không resolve (hiện ra mã nhân viên).
     LEFT JOIN ZTBEMPLINFO e
            ON e.CTR_CD = p.CTR_CD AND LTRIM(RTRIM(e.EMPL_NO)) = LTRIM(RTRIM(p.EMPL_NO))
     LEFT JOIN ZTBJOB j ON j.JOB_CODE = e.JOB_CODE AND j.CTR_CD = e.CTR_CD
     WHERE p.CTR_CD = @CTR_CD AND p.CONVERSATION_ID IN (${ids.join(",")})
     ORDER BY p.CONVERSATION_ID, EMPL_NO`,
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

/**
 * Lấy tin nhắn theo khoá (keyset), KHÔNG dùng OFFSET:
 *  - Trang lịch sử (cuộn lên): truyền `beforeMessageId` ⇒ lấy các tin CŨ HƠN, trả về tăng dần.
 *  - Đồng bộ sau khi mất mạng: truyền `afterMessageId` ⇒ lấy các tin MỚI HƠN, trả về tăng dần.
 *
 * Dùng `TOP + MESSAGE_ID` (identity) nên độ phức tạp KHÔNG phụ thuộc tổng số tin trong phòng
 * (index IDX_CHAT_MESSAGE_CONV (CONVERSATION_ID, MESSAGE_ID DESC) phục vụ cả 2 chiều).
 */
async function listMessages({ conversationId, beforeMessageId, afterMessageId, limit = 40, emplNo }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 500);
  const viewer = String(emplNo || "").trim().toUpperCase();

  const before = Number(beforeMessageId);
  const hasBefore = Number.isInteger(before) && before > 0;
  const after = Number(afterMessageId);
  const hasAfter = Number.isInteger(after) && after > 0;

  // Hai con trỏ loại trừ nhau: before = duyệt ngược (lịch sử), after = duyệt xuôi (đồng bộ).
  const cursorClause = hasAfter
    ? "AND m.MESSAGE_ID > @AFTER_ID"
    : hasBefore
      ? "AND m.MESSAGE_ID < @BEFORE_ID"
      : "";

  const rows = await queryRows(
    `SELECT TOP (@LIMIT) m.* FROM ZTB_CHAT_MESSAGE m
     WHERE m.CONVERSATION_ID = @CONVERSATION_ID
       ${cursorClause}
       AND NOT EXISTS (
         SELECT 1 FROM ZTB_CHAT_MESSAGE_HIDDEN h
         WHERE h.MESSAGE_ID = m.MESSAGE_ID AND h.EMPL_NO = @VIEWER
       )
     ORDER BY m.MESSAGE_ID ${hasAfter ? "ASC" : "DESC"}`,
    {
      LIMIT: safeLimit,
      CONVERSATION_ID: Number(conversationId),
      VIEWER: viewer,
      ...(hasAfter ? { AFTER_ID: after } : hasBefore ? { BEFORE_ID: before } : {}),
    }
  );
  // Duyệt ngược ⇒ đảo lại cho FE luôn nhận thứ tự tăng dần theo MESSAGE_ID.
  return hasAfter ? rows : rows.reverse();
}

/** Lấy 1 số tin nhắn theo id (dùng để dựng nội dung được trích dẫn khi reply). */
async function listMessagesByIds({ conversationId, messageIds, emplNo }) {
  const ids = (messageIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return [];
  const viewer = String(emplNo || "").trim().toUpperCase();
  return queryRows(
    `SELECT m.MESSAGE_ID, m.SENDER_EMPL_NO, m.MSG_TYPE, m.CONTENT, m.DELETED_AT, m.CONVERSATION_ID
     FROM ZTB_CHAT_MESSAGE m
     WHERE m.CONVERSATION_ID = @CONVERSATION_ID AND m.MESSAGE_ID IN (${ids.join(",")})
       AND NOT EXISTS (
         SELECT 1 FROM ZTB_CHAT_MESSAGE_HIDDEN h
         WHERE h.MESSAGE_ID = m.MESSAGE_ID AND h.EMPL_NO = @VIEWER
       )`,
    { CONVERSATION_ID: Number(conversationId), VIEWER: viewer }
  );
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
  forwardedFromMessageId,
}) {
  return withTransaction(async ({ query }) => {
    if (clientMessageId) {
      const existing = await query(
        `SELECT * FROM ZTB_CHAT_MESSAGE
         WHERE CTR_CD = @CTR_CD AND SENDER_EMPL_NO = @SENDER_EMPL_NO AND CLIENT_MESSAGE_ID = @CLIENT_MESSAGE_ID`,
        { CTR_CD: ctrCd, SENDER_EMPL_NO: senderEmplNo, CLIENT_MESSAGE_ID: clientMessageId }
      );
      if (existing.recordset && existing.recordset.length > 0) {
        return { message: existing.recordset[0], duplicated: true, attachments: [] };
      }
    }

    // File đính kèm hợp lệ: do chính người gửi upload, đúng phòng, chưa gắn tin nào.
    const rawIds = (attachmentIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
    let attachments = [];
    if (rawIds.length > 0) {
      const found = await query(
        `SELECT ATTACHMENT_ID, MESSAGE_ID, CONVERSATION_ID, UPLOADED_BY, ORIGINAL_NAME, MIME_TYPE, FILE_SIZE
         FROM ZTB_CHAT_ATTACHMENT
         WHERE ATTACHMENT_ID IN (${rawIds.join(",")})`,
        {}
      );
      attachments = (found.recordset || []).filter(
        (row) =>
          String(row.UPLOADED_BY || "").trim().toUpperCase() === senderEmplNo &&
          Number(row.CONVERSATION_ID) === Number(conversationId) &&
          !row.MESSAGE_ID
      );
    }

    // Suy ra loại tin từ đính kèm: gửi ảnh/file mà không kèm chữ vẫn phải là IMAGE/FILE.
    let type = MSG_TYPES.has(msgType) ? msgType : "TEXT";
    if (attachments.length > 0 && (type === "TEXT" || !String(content || "").trim())) {
      type = attachments.some((row) => /^image\//i.test(String(row.MIME_TYPE || ""))) ? "IMAGE" : "FILE";
    }

    const inserted = await query(
      `INSERT INTO ZTB_CHAT_MESSAGE
         (CONVERSATION_ID, CTR_CD, SENDER_EMPL_NO, MSG_TYPE, CONTENT, MENTIONS,
          REPLY_TO_MESSAGE_ID, CLIENT_MESSAGE_ID, FORWARDED_FROM_MESSAGE_ID)
       OUTPUT INSERTED.*
       VALUES (@CONVERSATION_ID, @CTR_CD, @SENDER_EMPL_NO, @MSG_TYPE, @CONTENT, @MENTIONS,
               @REPLY_TO_MESSAGE_ID, @CLIENT_MESSAGE_ID, @FORWARDED_FROM_MESSAGE_ID)`,
      {
        CONVERSATION_ID: Number(conversationId),
        CTR_CD: ctrCd,
        SENDER_EMPL_NO: senderEmplNo,
        MSG_TYPE: type,
        CONTENT: content
          ? String(content).slice(0, type === "RICH" ? MAX_RICH_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH)
          : null,
        MENTIONS: mentions ? JSON.stringify(mentions).slice(0, 1000) : null,
        REPLY_TO_MESSAGE_ID: Number.isInteger(Number(replyToMessageId)) && Number(replyToMessageId) > 0
          ? Number(replyToMessageId)
          : null,
        CLIENT_MESSAGE_ID: clientMessageId || null,
        FORWARDED_FROM_MESSAGE_ID:
          Number.isInteger(Number(forwardedFromMessageId)) && Number(forwardedFromMessageId) > 0
            ? Number(forwardedFromMessageId)
            : null,
      }
    );

    const message = inserted.recordset[0];

    if (attachments.length > 0) {
      const ids = attachments.map((row) => row.ATTACHMENT_ID).join(",");
      await query(
        `UPDATE ZTB_CHAT_ATTACHMENT SET MESSAGE_ID = @MESSAGE_ID
         WHERE ATTACHMENT_ID IN (${ids}) AND MESSAGE_ID IS NULL`,
        { MESSAGE_ID: message.MESSAGE_ID }
      );
    }

    await query(
      `UPDATE ZTB_CHAT_CONVERSATION
       SET LAST_MESSAGE_ID = @MESSAGE_ID, LAST_MESSAGE_AT = @CREATED_AT, UPDATED_AT = GETDATE()
       WHERE CONVERSATION_ID = @CONVERSATION_ID`,
      { MESSAGE_ID: message.MESSAGE_ID, CREATED_AT: message.CREATED_AT, CONVERSATION_ID: Number(conversationId) }
    );

    return {
      message,
      duplicated: false,
      attachments: attachments.map((row) => ({
        attachmentId: row.ATTACHMENT_ID,
        originalName: row.ORIGINAL_NAME,
        mimeType: row.MIME_TYPE,
        fileSize: row.FILE_SIZE,
      })),
    };
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
/* Cảm xúc (reaction) & ẩn tin theo từng user                          */
/* ------------------------------------------------------------------ */

/**
 * Ghim / bỏ ghim 1 tin nhắn (ghim chung cho cả phòng — mọi thành viên đều thấy).
 * Trả về mốc ghim mới (null nếu vừa bỏ ghim).
 */
async function setMessagePinned({ conversationId, messageId, emplNo, pinned }) {
  return queryOne(
    `UPDATE ZTB_CHAT_MESSAGE
     SET PINNED_AT = CASE WHEN @PINNED = 1 THEN GETDATE() ELSE NULL END,
         PINNED_BY = CASE WHEN @PINNED = 1 THEN @EMPL_NO ELSE NULL END
     OUTPUT INSERTED.PINNED_AT, INSERTED.PINNED_BY
     WHERE MESSAGE_ID = @MESSAGE_ID AND CONVERSATION_ID = @CONVERSATION_ID
       AND DELETED_AT IS NULL`,
    {
      MESSAGE_ID: Number(messageId),
      CONVERSATION_ID: Number(conversationId),
      EMPL_NO: emplNo,
      PINNED: pinned ? 1 : 0,
    }
  );
}

/** Danh sách tin nhắn đang ghim của NHIỀU phòng (ghim mới nhất trước). */
async function listPinnedMessagesForConversations({ conversationIds, limitPerConversation = 20 }) {
  const ids = (conversationIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return [];
  return queryRows(
    `SELECT CONVERSATION_ID, MESSAGE_ID, SENDER_EMPL_NO, MSG_TYPE, CONTENT,
            CREATED_AT, DELETED_AT, PINNED_AT, PINNED_BY
     FROM (
       SELECT m.CONVERSATION_ID, m.MESSAGE_ID, LTRIM(RTRIM(m.SENDER_EMPL_NO)) AS SENDER_EMPL_NO,
              m.MSG_TYPE, m.CONTENT, m.CREATED_AT, m.DELETED_AT, m.PINNED_AT,
              LTRIM(RTRIM(m.PINNED_BY)) AS PINNED_BY,
              ROW_NUMBER() OVER (PARTITION BY m.CONVERSATION_ID ORDER BY m.PINNED_AT DESC) AS RN
       FROM ZTB_CHAT_MESSAGE m
       WHERE m.CONVERSATION_ID IN (${ids.join(",")})
         AND m.PINNED_AT IS NOT NULL AND m.DELETED_AT IS NULL
     ) pinned
     WHERE RN <= ${Math.max(1, Math.min(Number(limitPerConversation) || 20, 50))}
     ORDER BY CONVERSATION_ID, PINNED_AT DESC`,
    {}
  );
}

async function listReactionsForMessages({ messageIds }) {
  const ids = (messageIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return [];
  return queryRows(
    `SELECT MESSAGE_ID, EMPL_NO, REACTION, ISNULL(RX_COUNT, 1) AS RX_COUNT
     FROM ZTB_CHAT_REACTION WHERE MESSAGE_ID IN (${ids.join(",")})`,
    {}
  );
}

async function getReaction({ messageId, emplNo }) {
  return queryOne(
    `SELECT * FROM ZTB_CHAT_REACTION WHERE MESSAGE_ID = @MESSAGE_ID AND EMPL_NO = @EMPL_NO`,
    { MESSAGE_ID: Number(messageId), EMPL_NO: emplNo }
  );
}

/**
 * Thả cảm xúc: mỗi người 1 DÒNG/tin.
 *  - Chưa có ⇒ tạo mới với RX_COUNT = 1.
 *  - Đã có ĐÚNG loại đó ⇒ tăng RX_COUNT (cho phép thả vô hạn, giống tim bay).
 *  - Đã có loại KHÁC ⇒ đổi loại và đặt lại RX_COUNT = 1.
 */
async function setReaction({ ctrCd, messageId, emplNo, reaction }) {
  const pool = await openConnection();
  await pool.query(
    `IF EXISTS (SELECT 1 FROM ZTB_CHAT_REACTION WHERE MESSAGE_ID=@MESSAGE_ID AND EMPL_NO=@EMPL_NO)
       UPDATE ZTB_CHAT_REACTION
       SET RX_COUNT = CASE WHEN REACTION = @REACTION THEN ISNULL(RX_COUNT,1) + 1 ELSE 1 END,
           REACTION = @REACTION,
           CREATED_AT = GETDATE()
       WHERE MESSAGE_ID=@MESSAGE_ID AND EMPL_NO=@EMPL_NO
     ELSE
       INSERT INTO ZTB_CHAT_REACTION (MESSAGE_ID, EMPL_NO, CTR_CD, REACTION, RX_COUNT)
       VALUES (@MESSAGE_ID, @EMPL_NO, @CTR_CD, @REACTION, 1)`,
    {
      MESSAGE_ID: Number(messageId),
      EMPL_NO: emplNo,
      CTR_CD: ctrCd,
      REACTION: reaction,
    }
  );
}

async function removeReaction({ messageId, emplNo }) {
  const pool = await openConnection();
  await pool.query(
    `DELETE FROM ZTB_CHAT_REACTION WHERE MESSAGE_ID=@MESSAGE_ID AND EMPL_NO=@EMPL_NO`,
    { MESSAGE_ID: Number(messageId), EMPL_NO: emplNo }
  );
}

/** "Xoá ở phía tôi": ẩn tin với riêng user, KHÔNG ảnh hưởng người khác. */
async function hideMessageForUser({ messageId, emplNo }) {
  const pool = await openConnection();
  await pool.query(
    `IF NOT EXISTS (SELECT 1 FROM ZTB_CHAT_MESSAGE_HIDDEN WHERE MESSAGE_ID=@MESSAGE_ID AND EMPL_NO=@EMPL_NO)
       INSERT INTO ZTB_CHAT_MESSAGE_HIDDEN (MESSAGE_ID, EMPL_NO) VALUES (@MESSAGE_ID, @EMPL_NO)`,
    { MESSAGE_ID: Number(messageId), EMPL_NO: emplNo }
  );
}

/** Nhân bản đính kèm sang phòng khác (chuyển tiếp) — dùng lại file vật lý, không copy. */
async function cloneAttachments({ attachmentIds, targetConversationId, ctrCd, emplNo }) {
  const ids = (attachmentIds || []).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) return [];

  return withTransaction(async ({ query }) => {
    const source = await query(
      `SELECT ATTACHMENT_ID, ORIGINAL_NAME, STORAGE_PATH, MIME_TYPE, FILE_SIZE, STORED_NAME
       FROM ZTB_CHAT_ATTACHMENT WHERE ATTACHMENT_ID IN (${ids.join(",")}) AND DELETED_AT IS NULL`,
      {}
    );

    const clonedIds = [];
    for (const row of source.recordset || []) {
      const inserted = await query(
        `INSERT INTO ZTB_CHAT_ATTACHMENT
           (CONVERSATION_ID, CTR_CD, ORIGINAL_NAME, STORED_NAME, STORAGE_PATH, MIME_TYPE, FILE_SIZE, UPLOADED_BY)
         OUTPUT INSERTED.ATTACHMENT_ID
         VALUES (@CONVERSATION_ID, @CTR_CD, @ORIGINAL_NAME, @STORED_NAME, @STORAGE_PATH, @MIME_TYPE, @FILE_SIZE, @UPLOADED_BY)`,
        {
          CONVERSATION_ID: Number(targetConversationId),
          CTR_CD: ctrCd,
          ORIGINAL_NAME: row.ORIGINAL_NAME,
          STORED_NAME: row.STORED_NAME,
          STORAGE_PATH: row.STORAGE_PATH,
          MIME_TYPE: row.MIME_TYPE,
          FILE_SIZE: row.FILE_SIZE,
          UPLOADED_BY: emplNo,
        }
      );
      clonedIds.push(inserted.recordset[0].ATTACHMENT_ID);
    }
    return clonedIds;
  });
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

/* ------------------------------------------------------------------ */
/* "My Files" — hội thoại cloud cá nhân (CONV_TYPE = SELF)            */
/* ------------------------------------------------------------------ */

const SELF_PREFIX = "SELF|";

/** Khoá định danh của phòng My Files (đủ duy nhất cho từng nhân viên). */
function buildSelfKey(emplNo) {
  return `${SELF_PREFIX}${String(emplNo || "").trim().toUpperCase()}`;
}

/**
 * Bảo đảm mỗi nhân viên luôn có 1 phòng "My Files" và trả về dòng hội thoại.
 * Không tạo trùng: dùng DIRECT_KEY (đã có unique index) làm khoá duy nhất.
 */
async function ensureSelfConversation({ ctrCd, emplNo }) {
  const key = buildSelfKey(emplNo);
  const found = await queryOne(
    `SELECT * FROM ZTB_CHAT_CONVERSATION WHERE CTR_CD = @CTR_CD AND DIRECT_KEY = @DIRECT_KEY`,
    { CTR_CD: ctrCd, DIRECT_KEY: key }
  );

  if (found) {
    // Từng bị đóng mềm ⇒ mở lại thay vì tạo dòng mới (tránh vi phạm unique index).
    if (found.DELETED_AT) await reviveConversation({ conversationId: found.CONVERSATION_ID });
    await ensureParticipant({
      ctrCd,
      conversationId: found.CONVERSATION_ID,
      emplNo,
      role: "OWNER",
    });
    return { ...found, DELETED_AT: null };
  }

  const created = await withTransaction(async ({ query }) => {
    const inserted = await query(
      `INSERT INTO ZTB_CHAT_CONVERSATION
         (CTR_CD, CONV_TYPE, TITLE, DIRECT_KEY, OWNER_EMPL_NO, CREATED_BY)
       OUTPUT INSERTED.*
       VALUES (@CTR_CD, 'SELF', @TITLE, @DIRECT_KEY, @EMPL_NO, @EMPL_NO)`,
      { CTR_CD: ctrCd, TITLE: "My Files", DIRECT_KEY: key, EMPL_NO: emplNo }
    );
    const conversation = inserted.recordset[0];
    await query(
      `INSERT INTO ZTB_CHAT_PARTICIPANT (CONVERSATION_ID, EMPL_NO, CTR_CD, ROLE)
       VALUES (@CONVERSATION_ID, @EMPL_NO, @CTR_CD, 'OWNER')`,
      { CONVERSATION_ID: conversation.CONVERSATION_ID, EMPL_NO: emplNo, CTR_CD: ctrCd }
    );
    return conversation;
  });

  return created;
}

/* ------------------------------------------------------------------ */
/* Tìm kiếm tin nhắn / tệp & danh sách media                          */
/* ------------------------------------------------------------------ */

/**
 * Phân tích mốc ngày cho bộ lọc.
 *
 * Bối cảnh (rất dễ sai): SQL Server dùng `GETDATE()` ⇒ cột thời gian lưu GIỜ VIỆT NAM,
 * còn driver mssql cấu hình `useUTC: true` ⇒ khi gửi tham số kiểu Date, driver lấy các
 * thành phần **UTC** của Date đó. Vì vậy muốn so với "00:00 ngày 30/09 giờ VN" thì phải
 * dựng Date bằng `Date.UTC(...)` (KHÔNG dùng `new Date(y, m, d)` — sẽ bị lệch múi giờ).
 */
function parseDayStart(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0, 0));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Mốc kết thúc (loại trừ) = 00:00 ngày kế tiếp để bao trọn ngày người dùng chọn. */
function parseDayEnd(value) {
  const raw = String(value ?? "").trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]) + 1, 0, 0, 0, 0));
  }
  const start = parseDayStart(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 3600 * 1000);
}

/** Đuôi tệp theo từng nhóm — dùng để lọc "loại file" khi tìm kiếm. */
const FILE_KIND_EXTENSIONS = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"],
  video: ["mp4", "mov", "avi", "mkv", "webm", "wmv", "m4v"],
  audio: ["mp3", "wav", "m4a", "ogg", "aac", "flac"],
  pdf: ["pdf"],
  word: ["doc", "docx", "rtf", "odt"],
  excel: ["xls", "xlsx", "xlsm", "ods"],
  csv: ["csv"],
  ppt: ["ppt", "pptx", "pps", "ppsx", "odp"],
  zip: ["zip", "rar", "7z", "tar", "gz", "bz2"],
};

/**
 * Sinh đoạn SQL kiểm tra "tệp thuộc nhóm kind".
 * `other` = có tệp nhưng KHÔNG thuộc bất kỳ nhóm nào ở trên.
 * Trả về { sql, params } để ghép vào câu truy vấn.
 */
function buildFileKindPredicate(alias, kind) {
  const normalized = String(kind || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return null;

  const likeClause = (exts) =>
    exts.map((ext) => `${alias}.ORIGINAL_NAME LIKE '%.${ext}'`).join(" OR ");

  if (normalized === "other") {
    const known = Object.values(FILE_KIND_EXTENSIONS)
      .flat()
      .map((ext) => `${alias}.ORIGINAL_NAME NOT LIKE '%.${ext}'`)
      .join(" AND ");
    return { sql: `(${known})`, params: {} };
  }

  const exts = FILE_KIND_EXTENSIONS[normalized];
  if (!exts) return null;
  return { sql: `(${likeClause(exts)})`, params: {} };
}

/**
 * Tìm kiếm tin nhắn theo từ khoá (nội dung hoặc tên tệp), người gửi, khoảng ngày,
 * loại tệp; phạm vi 1 phòng hoặc toàn bộ phòng mà người dùng tham gia.
 */
async function searchMessages({
  ctrCd,
  emplNo,
  conversationId,
  keyword,
  senderEmplNo,
  fromDate,
  toDate,
  fileKind,
  onlyWithFiles,
  beforeMessageId,
  limit = 30,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const text = String(keyword || "").trim();
  const viewer = String(emplNo || "").trim().toUpperCase();
  const convId = Number(conversationId);
  const kindPredicate = buildFileKindPredicate("fa", fileKind);

  const conditions = [
    "m.DELETED_AT IS NULL",
    "c.DELETED_AT IS NULL",
    "p.LEFT_AT IS NULL",
    `NOT EXISTS (SELECT 1 FROM ZTB_CHAT_MESSAGE_HIDDEN h
                   WHERE h.MESSAGE_ID = m.MESSAGE_ID AND h.EMPL_NO = @VIEWER)`,
  ];
  const params = { LIMIT: safeLimit, VIEWER: viewer, CTR_CD: ctrCd, EMPL_NO: viewer };

  if (Number.isInteger(convId) && convId > 0) {
    conditions.push("m.CONVERSATION_ID = @CONVERSATION_ID");
    params.CONVERSATION_ID = convId;
  }
  const sender = String(senderEmplNo || "").trim().toUpperCase();
  if (sender) {
    conditions.push("m.SENDER_EMPL_NO = @SENDER");
    params.SENDER = sender;
  }
  if (fromDate) {
    const start = parseDayStart(fromDate);
    if (start) {
      conditions.push("m.CREATED_AT >= @FROM_DATE");
      params.FROM_DATE = start;
    }
  }
  if (toDate) {
    const end = parseDayEnd(toDate);
    if (end) {
      conditions.push("m.CREATED_AT < @TO_DATE");
      params.TO_DATE = end;
    }
  }
  const cursor = Number(beforeMessageId);
  if (Number.isInteger(cursor) && cursor > 0) {
    conditions.push("m.MESSAGE_ID < @BEFORE_ID");
    params.BEFORE_ID = cursor;
  }

  // Từ khoá: khớp nội dung tin nhắn HOẶC tên tệp đính kèm.
  if (text) {
    conditions.push(
      `(m.CONTENT LIKE @LIKE
        OR EXISTS (SELECT 1 FROM ZTB_CHAT_ATTACHMENT ka
                    WHERE ka.MESSAGE_ID = m.MESSAGE_ID AND ka.DELETED_AT IS NULL
                      AND ka.ORIGINAL_NAME LIKE @LIKE))`
    );
    params.LIKE = `%${text}%`;
  }

  // Có tệp đính kèm (tuỳ chọn) — nếu có lọc loại tệp thì bắt buộc phải có tệp đúng loại.
  if (kindPredicate) {
    conditions.push(
      `EXISTS (SELECT 1 FROM ZTB_CHAT_ATTACHMENT fa
                WHERE fa.MESSAGE_ID = m.MESSAGE_ID AND fa.DELETED_AT IS NULL
                  AND ${kindPredicate.sql})`
    );
  } else if (onlyWithFiles) {
    conditions.push(
      `EXISTS (SELECT 1 FROM ZTB_CHAT_ATTACHMENT oa
                WHERE oa.MESSAGE_ID = m.MESSAGE_ID AND oa.DELETED_AT IS NULL)`
    );
  }

  return queryRows(
    `SELECT TOP (@LIMIT) m.MESSAGE_ID, m.CONVERSATION_ID, m.SENDER_EMPL_NO, m.MSG_TYPE,
            m.CONTENT, m.CREATED_AT, m.DELETED_AT, c.CONV_TYPE
       FROM ZTB_CHAT_MESSAGE m
       INNER JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = m.CONVERSATION_ID
       INNER JOIN ZTB_CHAT_PARTICIPANT p
               ON p.CONVERSATION_ID = m.CONVERSATION_ID
              AND p.EMPL_NO = @EMPL_NO AND p.CTR_CD = @CTR_CD
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY m.MESSAGE_ID DESC`,
    params
  );
}

/** Đếm nhanh số kết quả tìm kiếm (cùng bộ lọc) để hiển thị "x kết quả". */
async function countSearchMessages(options) {
  const safeLimit = 200;
  const rows = await searchMessages({ ...options, limit: safeLimit });
  return rows.length;
}

/**
 * Danh sách media/tệp của 1 phòng (cho cửa sổ "Xem media"), mới nhất trước.
 * Dùng ATTACHMENT_ID làm con trỏ phân trang.
 */
async function listConversationMedia({
  conversationId,
  emplNo,
  fileKind,
  fromDate,
  toDate,
  beforeAttachmentId,
  limit = 60,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), 200);
  const viewer = String(emplNo || "").trim().toUpperCase();
  const kindPredicate = buildFileKindPredicate("a", fileKind);

  const conditions = [
    "a.CONVERSATION_ID = @CONVERSATION_ID",
    "a.DELETED_AT IS NULL",
    "a.MESSAGE_ID IS NOT NULL",
    "m.DELETED_AT IS NULL",
  ];
  const params = { LIMIT: safeLimit, CONVERSATION_ID: Number(conversationId), VIEWER: viewer };

  const cursor = Number(beforeAttachmentId);
  if (Number.isInteger(cursor) && cursor > 0) {
    conditions.push("a.ATTACHMENT_ID < @BEFORE_ID");
    params.BEFORE_ID = cursor;
  }
  if (kindPredicate) conditions.push(kindPredicate.sql);
  if (fromDate) {
    const start = parseDayStart(fromDate);
    if (start) {
      conditions.push("m.CREATED_AT >= @FROM_DATE");
      params.FROM_DATE = start;
    }
  }
  if (toDate) {
    const end = parseDayEnd(toDate);
    if (end) {
      conditions.push("m.CREATED_AT < @TO_DATE");
      params.TO_DATE = end;
    }
  }

  return queryRows(
    `SELECT TOP (@LIMIT) a.ATTACHMENT_ID, a.MESSAGE_ID, a.ORIGINAL_NAME, a.MIME_TYPE,
            a.FILE_SIZE, a.UPLOADED_BY, a.CREATED_AT,
            m.SENDER_EMPL_NO, m.CREATED_AT AS MESSAGE_AT
       FROM ZTB_CHAT_ATTACHMENT a
       INNER JOIN ZTB_CHAT_MESSAGE m ON m.MESSAGE_ID = a.MESSAGE_ID
      WHERE ${conditions.join("\n        AND ")}
        AND NOT EXISTS (SELECT 1 FROM ZTB_CHAT_MESSAGE_HIDDEN h
                         WHERE h.MESSAGE_ID = m.MESSAGE_ID AND h.EMPL_NO = @VIEWER)
      ORDER BY a.ATTACHMENT_ID DESC`,
    params
  );
}

/** Tổng dung lượng (bytes) và số tệp đã lưu của 1 phòng. */
async function getConversationStorage({ conversationId }) {
  const row = await queryOne(
    `SELECT COUNT(1) AS FILE_COUNT, ISNULL(SUM(FILE_SIZE), 0) AS TOTAL_BYTES
       FROM ZTB_CHAT_ATTACHMENT
      WHERE CONVERSATION_ID = @CONVERSATION_ID AND DELETED_AT IS NULL`,
    { CONVERSATION_ID: Number(conversationId) }
  );
  return {
    fileCount: Number(row?.FILE_COUNT) || 0,
    totalBytes: Number(row?.TOTAL_BYTES) || 0,
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_RICH_MESSAGE_LENGTH,
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
  setConversationPinned,
  setConversationMute,
  listMutedMemberNos,
  listMembersForConversations,
  getParticipant,
  listActiveMemberNos,
  listMessages,
  listMessagesByIds,
  findMessageByClientId,
  insertMessage,
  markRead,
  softDeleteMessage,
  listAttachmentsByMessageIds,
  getAttachmentById,
  insertAttachment,
  cloneAttachments,
  setMessagePinned,
  listPinnedMessagesForConversations,
  listReactionsForMessages,
  getReaction,
  setReaction,
  removeReaction,
  hideMessageForUser,
  listFriends,
  listFriendRequests,
  findFriendRequest,
  insertFriendRequest,
  updateFriendStatus,
  writeAudit,
  buildSelfKey,
  ensureSelfConversation,
  searchMessages,
  countSearchMessages,
  listConversationMedia,
  getConversationStorage,
  FILE_KIND_EXTENSIONS,
};
