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

/** Chuẩn hoá Content-ID: bỏ dấu < > bao ngoài. */
function normalizeContentId(value) {
  return value ? String(value).replace(/^<|>$/g, "").trim() : "";
}

/**
 * Phân loại 1 phần MIME là ẢNH TRONG NỘI DUNG (`inline`) hay TỆP ĐÍNH KÈM.
 *
 * ⚠️ KHÔNG được suy ra inline chỉ từ "có Content-ID": **Gmail (và nhiều hệ thống khác)
 * gắn Content-ID cho cả tệp đính kèm thật** (ví dụ `<f_muqgaxoz1>` cho file
 * `companylogo.png` gửi kèm). Nếu coi là inline thì tệp đó sẽ biến mất khỏi danh sách
 * đính kèm ⇒ người dùng tưởng email "mất đính kèm" (dù Outlook vẫn thấy).
 *
 * Quy tắc:
 *  1. `Content-Disposition: attachment` ⇒ LUÔN là tệp đính kèm (kể cả có Content-ID).
 *  2. `Content-Disposition: inline` + có Content-ID ⇒ ảnh trong nội dung.
 *  3. Không có Disposition: có Content-ID + là ảnh ⇒ ảnh trong nội dung (hành vi phổ biến).
 *  4. Còn lại ⇒ tệp đính kèm.
 */
function classifyInlinePart(att) {
  const disposition = String(att?.contentDisposition || "").toLowerCase();
  const contentId = normalizeContentId(att?.contentId) || null;
  const type = String(att?.contentType || "").toLowerCase();
  if (disposition === "attachment") return { isInline: false, contentId };
  if (disposition === "inline") return { isInline: !!contentId, contentId };
  return { isInline: !!contentId && type.startsWith("image/"), contentId };
}

/**
 * ⚠️ KHÔNG dùng quy tắc "body không tham chiếu cid ⇒ tệp đính kèm" ở đây:
 * máy chủ mail của công ty (mailnara/spamfilter) **viết lại HTML**: ảnh `cid:` được nhúng
 * lại thành `data:` và tham chiếu `cid:` bị xoá khỏi body. Vì vậy "body không có cid"
 * KHÔNG có nghĩa phần đó là tệp đính kèm (sẽ biến logo chữ ký thành tệp rác).
 * Việc phân loại chỉ dựa vào `Content-Disposition` (+ Content-ID) như hàm dưới.
 */

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

  const attachments = (parsed.attachments || []).map((att) => {
    const { isInline, contentId } = classifyInlinePart(att);
    return {
      fileName: att.filename || null,
      contentType: att.contentType || "application/octet-stream",
      contentId,
      size: att.size || (att.content ? att.content.length : 0),
      content: att.content || Buffer.alloc(0),
      isInline,
      contentDisposition: att.contentDisposition || null,
      related: att.related === true,
    };
  });

  // `attachmentCount` = số TỆP ĐÍNH KÈM thật (không tính ảnh trong nội dung).
  const inlineCount = attachments.filter((a) => a.isInline).length;
  const attachmentCount = attachments.length - inlineCount;

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
    inlineCount,
    attachmentCount,
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
  classifyInlinePart,
  normalizeContentId,
};
