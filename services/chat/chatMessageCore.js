/**
 * Lõi xử lý tin nhắn chat — dùng CHUNG cho cả HTTP command (chatRoomService)
 * và Socket.IO handler. Nhờ vậy luồng realtime và luồng HTTP có cùng validation,
 * cùng transaction persist-before-emit và cùng cơ chế chống gửi trùng.
 *
 * Module này KHÔNG emit socket (tránh require vòng) — người gọi tự phát sự kiện.
 */
const repo = require("./chatRepository");
const { sanitizeRichContent, richToPlainText } = require("./richText");

const MSG_TYPES = new Set(["TEXT", "IMAGE", "FILE", "SYSTEM", "RICH"]);
const REACTION_TYPES = new Set(["LIKE", "LOVE", "HAHA", "WOW", "SAD", "ANGRY"]);
const ROLE_RANK = { MEMBER: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 };
const REPLY_SNIPPET_LENGTH = 120;

/** Lấy participant còn hoạt động; trả null nếu không phải thành viên. */
async function getActiveMembership(conversationId, emplNo) {
  const participant = await repo.getParticipant({ conversationId, emplNo });
  if (!participant || participant.LEFT_AT) return null;
  return participant;
}

function hasRole(participant, minimumRole) {
  if (!participant) return false;
  return (ROLE_RANK[participant.ROLE] || 0) >= (ROLE_RANK[minimumRole] || 99);
}

/**
 * Ghi tin nhắn mới sau khi kiểm tra quyền + dữ liệu đầu vào.
 * Trả về { ok, code, message, memberNos, duplicated }.
 */
async function sendMessage({
  ctrCd,
  conversationId,
  senderEmplNo,
  msgType = "TEXT",
  content,
  clientMessageId,
  mentions,
  replyToMessageId,
  attachmentIds,
  forwardedFromMessageId,
}) {
  const conversation = await repo.getConversationById({ ctrCd, conversationId });
  if (!conversation || conversation.DELETED_AT) {
    return { ok: false, code: "NOT_FOUND", message: "Phòng chat không tồn tại" };
  }

  const membership = await getActiveMembership(conversationId, senderEmplNo);
  if (!membership) {
    return { ok: false, code: "FORBIDDEN", message: "Bạn không còn trong phòng chat này" };
  }

  const type = MSG_TYPES.has(msgType) ? msgType : "TEXT";
  // Tin RICHTEXT: nội dung là HTML đã được lọc; độ dài cho phép rộng hơn vì còn thẻ markup.
  const isRich = type === "RICH";
  const text = isRich
    ? sanitizeRichContent(content)
    : typeof content === "string"
    ? content.trim()
    : "";
  const hasAttachments = Array.isArray(attachmentIds) && attachmentIds.length > 0;

  if (!text && !hasAttachments) {
    return { ok: false, code: "EMPTY", message: "Tin nhắn trống" };
  }
  const maxLength = isRich ? repo.MAX_RICH_MESSAGE_LENGTH : repo.MAX_MESSAGE_LENGTH;
  if (text.length > maxLength) {
    return {
      ok: false,
      code: "TOO_LONG",
      message: `Tin nhắn tối đa ${maxLength} ký tự`,
    };
  }

  const safeMentions = Array.isArray(mentions)
    ? mentions.map((v) => String(v).trim().toUpperCase()).filter(Boolean).slice(0, 50)
    : null;

  const { message, duplicated, attachments } = await repo.insertMessage({
    ctrCd,
    conversationId,
    senderEmplNo,
    msgType: type,
    content: text,
    mentions: safeMentions,
    replyToMessageId,
    clientMessageId,
    attachmentIds,
    forwardedFromMessageId,
  });

  const members = await repo.listActiveMemberNos({ conversationId });

  return {
    ok: true,
    duplicated,
    message,
    attachments,
    conversation,
    memberNos: members.map((row) => row.EMPL_NO),
  };
}

function replySnippet(row) {
  if (!row) return null;
  const raw = String(row.CONTENT || "").trim();
  // Tin RICHTEXT lưu HTML ⇒ trích dẫn phải là text thuần mới đọc được.
  const content = row.MSG_TYPE === "RICH" ? richToPlainText(raw) : raw;
  const preview = row.DELETED_AT
    ? "Tin nhắn đã được thu hồi"
    : row.MSG_TYPE === "IMAGE"
    ? "[Hình ảnh]"
    : row.MSG_TYPE === "FILE"
    ? "[Tệp đính kèm]"
    : content.length > REPLY_SNIPPET_LENGTH
    ? `${content.slice(0, REPLY_SNIPPET_LENGTH)}…`
    : content || "[Tin nhắn]";

  return {
    MESSAGE_ID: row.MESSAGE_ID,
    SENDER_EMPL_NO: String(row.SENDER_EMPL_NO || "").trim().toUpperCase(),
    MSG_TYPE: row.MSG_TYPE,
    DELETED_AT: row.DELETED_AT || null,
    PREVIEW: preview,
  };
}

/**
 * Gom cảm xúc theo loại cho FE:
 *   { LIKE: { count: 12, users: ["A","B"] }, LOVE: { count: 3, users: ["C"] } }
 * `count` = tổng số lần thả (một người có thể thả nhiều lần), `users` để FE biết
 * "tôi đã thả chưa" và hiển thị tooltip ai đã thả.
 */
function buildReactions(rows) {
  const grouped = {};
  (rows || []).forEach((item) => {
    const key = String(item.REACTION || "").toUpperCase();
    if (!key) return;
    const emplNo = String(item.EMPL_NO || "").trim().toUpperCase();
    const entry = grouped[key] || { count: 0, users: [] };
    entry.count += Number(item.RX_COUNT) || 1;
    if (emplNo && !entry.users.includes(emplNo)) entry.users.push(emplNo);
    grouped[key] = entry;
  });
  return grouped;
}

/** Chuẩn hoá 1 row tin nhắn cho FE (kèm đính kèm, cảm xúc, trích dẫn). */
function toClientMessage(row, extras = {}) {
  const attachments = Array.isArray(extras.attachments) ? extras.attachments : [];
  const reactions = Array.isArray(extras.reactions) ? extras.reactions : [];

  return {
    MESSAGE_ID: row.MESSAGE_ID,
    CONVERSATION_ID: row.CONVERSATION_ID,
    SENDER_EMPL_NO: String(row.SENDER_EMPL_NO || "").trim().toUpperCase(),
    MSG_TYPE: row.MSG_TYPE,
    CONTENT: row.DELETED_AT ? null : row.CONTENT,
    MENTIONS: row.MENTIONS || null,
    REPLY_TO_MESSAGE_ID: row.REPLY_TO_MESSAGE_ID || null,
    REPLY_TO: extras.replyTo || null,
    FORWARDED_FROM_MESSAGE_ID: row.FORWARDED_FROM_MESSAGE_ID || null,
    IS_FORWARDED: Boolean(row.FORWARDED_FROM_MESSAGE_ID),
    CLIENT_MESSAGE_ID: row.CLIENT_MESSAGE_ID || null,
    CREATED_AT: row.CREATED_AT,
    EDITED_AT: row.EDITED_AT || null,
    DELETED_AT: row.DELETED_AT || null,
    ATTACHMENTS: attachments,
    REACTIONS: buildReactions(reactions),
  };
}

/**
 * Gắn đính kèm + cảm xúc + trích dẫn cho MỘT tin nhắn (payload realtime / response khi gửi).
 * Thiếu bước này thì ảnh/file vừa gửi sẽ không hiện cho tới khi tải lại trang.
 */
async function enrichMessage(conversationId, row, presetAttachments) {
  const attachments =
    Array.isArray(presetAttachments) && presetAttachments.length > 0
      ? presetAttachments
      : (
          await repo.listAttachmentsByMessageIds({ conversationId, messageIds: [row.MESSAGE_ID] })
        ).map((item) => ({
          attachmentId: item.ATTACHMENT_ID,
          originalName: item.ORIGINAL_NAME,
          mimeType: item.MIME_TYPE,
          fileSize: item.FILE_SIZE,
        }));

  const reactions = await repo.listReactionsForMessages({ messageIds: [row.MESSAGE_ID] });

  let replyTo = null;
  if (row.REPLY_TO_MESSAGE_ID) {
    const parents = await repo.listMessagesByIds({
      conversationId,
      messageIds: [row.REPLY_TO_MESSAGE_ID],
    });
    replyTo = replySnippet(parents[0]);
  }

  return toClientMessage(row, { attachments, reactions, replyTo });
}

/** Gắn đính kèm + cảm xúc + trích dẫn cho NHIỀU tin nhắn (tối ưu số query). */
async function enrichMessages(conversationId, rows) {
  if (!rows || rows.length === 0) return [];

  const messageIds = rows.map((row) => row.MESSAGE_ID);
  const replyIds = rows.map((row) => row.REPLY_TO_MESSAGE_ID).filter(Boolean);

  const [attachmentRows, reactionRows, replyRows] = await Promise.all([
    repo.listAttachmentsByMessageIds({ conversationId, messageIds }),
    repo.listReactionsForMessages({ messageIds }),
    replyIds.length > 0 ? repo.listMessagesByIds({ conversationId, messageIds: replyIds }) : [],
  ]);

  const filesByMessage = new Map();
  attachmentRows.forEach((row) => {
    const list = filesByMessage.get(row.MESSAGE_ID) || [];
    list.push({
      attachmentId: row.ATTACHMENT_ID,
      originalName: row.ORIGINAL_NAME,
      mimeType: row.MIME_TYPE,
      fileSize: row.FILE_SIZE,
    });
    filesByMessage.set(row.MESSAGE_ID, list);
  });

  const repliesById = new Map(replyRows.map((row) => [row.MESSAGE_ID, row]));

  return rows.map((row) =>
    toClientMessage(row, {
      attachments: filesByMessage.get(row.MESSAGE_ID) || [],
      reactions: reactionRows.filter((item) => item.MESSAGE_ID === row.MESSAGE_ID),
      replyTo: row.REPLY_TO_MESSAGE_ID ? replySnippet(repliesById.get(row.REPLY_TO_MESSAGE_ID)) : null,
    })
  );
}

module.exports = {
  MSG_TYPES,
  REACTION_TYPES,
  ROLE_RANK,
  getActiveMembership,
  hasRole,
  sendMessage,
  toClientMessage,
  buildReactions,
  enrichMessage,
  enrichMessages,
};
