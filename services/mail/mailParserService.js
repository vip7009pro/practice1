/**
 * Parse email thô (từ POP3) thành cấu trúc dùng được để lưu DB + NAS.
 * Dùng `mailparser.simpleParser` (thuần JS, tương thích pkg).
 *
 * Trả về chuẩn hoá: headers quan trọng, danh sách người nhận, html/text,
 * danh sách đính kèm (đã đọc thành Buffer để ghi NAS).
 */
const { simpleParser } = require("mailparser");

const MAX_PREVIEW = 300;

/** Chuẩn hoá 1 address object của mailparser ⇒ { address, name }. */
function normalizeAddress(addr) {
  if (!addr) return null;
  const address = String(addr.address || "").trim();
  if (!address) return null;
  return { address, name: addr.name ? String(addr.name).trim() : null };
}

function normalizeAddressList(list) {
  if (!list) return [];
  const arr = Array.isArray(list) ? list : [list];
  return arr.map(normalizeAddress).filter(Boolean);
}

/** Bỏ tiền tố Re:/Fwd:/Trả lời:/Chuyển tiếp: để gom hội thoại. */
function normalizeSubject(subject) {
  return String(subject || "")
    .replace(/^\s*((re|fwd?|tr|aw|sv|vs)\s*(\[\d+\])?\s*:\s*)+/gi, "")
    .replace(/^\s*(trả lời|chuyển tiếp)\s*:\s*/gi, "")
    .trim()
    .slice(0, 400);
}

/** Tạo đoạn xem trước ngắn từ text (hoặc html đã bỏ thẻ). */
function buildPreview({ text, html }) {
  let source = (text || "").trim();
  if (!source && html) {
    source = String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }
  return source.replace(/\s+/g, " ").trim().slice(0, MAX_PREVIEW);
}

/** References header ⇒ mảng Message-ID (theo thứ tự). */
function parseReferences(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Parse raw email buffer.
 * @param {Buffer} raw
 * @returns {Promise<object>}
 */
async function parseEmail(raw) {
  const parsed = await simpleParser(raw);

  const from = normalizeAddress(parsed.from?.value?.[0]) || { address: null, name: null };
  const to = normalizeAddressList(parsed.to?.value);
  const cc = normalizeAddressList(parsed.cc?.value);
  const bcc = normalizeAddressList(parsed.bcc?.value);

  const references = parseReferences(parsed.references);

  const attachments = (parsed.attachments || []).map((att) => ({
    fileName: att.filename || null,
    contentType: att.contentType || "application/octet-stream",
    contentId: att.contentId ? String(att.contentId).replace(/^<|>$/g, "") : null,
    size: att.size || (att.content ? att.content.length : 0),
    content: att.content || Buffer.alloc(0),
    isInline: !!att.contentId,
    contentDisposition: att.contentDisposition || null,
  }));

  return {
    messageId: parsed.messageId ? String(parsed.messageId).trim() : null,
    inReplyTo: parsed.inReplyTo ? String(parsed.inReplyTo).trim() : null,
    references,
    subject: parsed.subject ? String(parsed.subject).slice(0, 500) : null,
    subjectNorm: normalizeSubject(parsed.subject),
    from,
    to,
    cc,
    bcc,
    date: parsed.date || null,
    html: parsed.html || null,
    text: parsed.text || null,
    previewText: buildPreview({ text: parsed.text, html: parsed.html }),
    attachments,
    priority: parsed.priority || null,
    rawSize: raw.length,
  };
}

/** Danh sách người nhận (TO/CC/BCC) đã gắn type — để chèn ZTB_MAIL_RECIPIENT. */
function flattenRecipients(parsedEmail) {
  const out = [];
  for (const r of parsedEmail.to || []) out.push({ type: "TO", ...r });
  for (const r of parsedEmail.cc || []) out.push({ type: "CC", ...r });
  for (const r of parsedEmail.bcc || []) out.push({ type: "BCC", ...r });
  return out;
}

module.exports = {
  parseEmail,
  flattenRecipients,
  normalizeSubject,
  buildPreview,
};
