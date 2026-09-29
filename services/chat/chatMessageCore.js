/**
 * Lõi xử lý tin nhắn chat — dùng CHUNG cho cả HTTP command (chatRoomService)
 * và Socket.IO handler. Nhờ vậy luồng realtime và luồng HTTP có cùng validation,
 * cùng transaction persist-before-emit và cùng cơ chế chống gửi trùng.
 *
 * Module này KHÔNG emit socket (tránh require vòng) — người gọi tự phát sự kiện.
 */
const repo = require("./chatRepository");

const MSG_TYPES = new Set(["TEXT", "IMAGE", "FILE", "SYSTEM"]);
const ROLE_RANK = { MEMBER: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 };

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
  const text = typeof content === "string" ? content.trim() : "";
  const hasAttachments = Array.isArray(attachmentIds) && attachmentIds.length > 0;

  if (!text && !hasAttachments) {
    return { ok: false, code: "EMPTY", message: "Tin nhắn trống" };
  }
  if (type === "TEXT" && text.length > repo.MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "TOO_LONG",
      message: `Tin nhắn tối đa ${repo.MAX_MESSAGE_LENGTH} ký tự`,
    };
  }

  const safeMentions = Array.isArray(mentions)
    ? mentions.map((v) => String(v).trim().toUpperCase()).filter(Boolean).slice(0, 50)
    : null;

  const { message, duplicated } = await repo.insertMessage({
    ctrCd,
    conversationId,
    senderEmplNo,
    msgType: type,
    content: text,
    mentions: safeMentions,
    replyToMessageId,
    clientMessageId,
    attachmentIds,
  });

  const members = await repo.listActiveMemberNos({ conversationId });

  return {
    ok: true,
    duplicated,
    message,
    memberNos: members.map((row) => row.EMPL_NO),
  };
}

/** Gắn thông tin file đính kèm vào danh sách tin nhắn. */
async function attachFiles(conversationId, messages) {
  const ids = messages.map((m) => m.MESSAGE_ID);
  const attachments = await repo.listAttachmentsByMessageIds({ conversationId, messageIds: ids });
  if (attachments.length === 0) return messages;

  const byMessage = new Map();
  attachments.forEach((row) => {
    const list = byMessage.get(row.MESSAGE_ID) || [];
    list.push({
      attachmentId: row.ATTACHMENT_ID,
      originalName: row.ORIGINAL_NAME,
      mimeType: row.MIME_TYPE,
      fileSize: row.FILE_SIZE,
    });
    byMessage.set(row.MESSAGE_ID, list);
  });

  return messages.map((message) => ({
    ...message,
    ATTACHMENTS: byMessage.get(message.MESSAGE_ID) || [],
  }));
}

/** Chuẩn hoá 1 row tin nhắn cho FE (thêm ATTACHMENTS rỗng nếu chưa nạp). */
function toClientMessage(row, attachments = []) {
  return {
    MESSAGE_ID: row.MESSAGE_ID,
    CONVERSATION_ID: row.CONVERSATION_ID,
    SENDER_EMPL_NO: row.SENDER_EMPL_NO,
    MSG_TYPE: row.MSG_TYPE,
    CONTENT: row.DELETED_AT ? null : row.CONTENT,
    MENTIONS: row.MENTIONS || null,
    REPLY_TO_MESSAGE_ID: row.REPLY_TO_MESSAGE_ID || null,
    CLIENT_MESSAGE_ID: row.CLIENT_MESSAGE_ID || null,
    CREATED_AT: row.CREATED_AT,
    EDITED_AT: row.EDITED_AT || null,
    DELETED_AT: row.DELETED_AT || null,
    ATTACHMENTS: attachments,
  };
}

module.exports = {
  ROLE_RANK,
  getActiveMembership,
  hasRole,
  sendMessage,
  attachFiles,
  toClientMessage,
};
