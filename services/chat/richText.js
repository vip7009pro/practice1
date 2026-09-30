/**
 * Tiện ích cho tin nhắn RICHTEXT (MSG_TYPE = 'RICH').
 *
 * Client đã sanitize theo allowlist trước khi gửi, nhưng API có thể bị gọi trực tiếp
 * ⇒ đây là lớp chặn thứ hai ở server. Không phụ thuộc module nào để tránh require vòng.
 */

/** Thẻ bị xoá CẢ nội dung (không chỉ bỏ thẻ). */
const DANGEROUS_TAGS = "script|style|iframe|object|embed|applet|link|meta|form|base|svg|math";
const DANGEROUS_BLOCK = new RegExp(`<\\s*(${DANGEROUS_TAGS})[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi");
const DANGEROUS_OPEN = new RegExp(`<\\s*(${DANGEROUS_TAGS})[^>]*>`, "gi");
const EVENT_HANDLER = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /(href|src)\s*=\s*(?:"|')?\s*javascript:[^"'>\s]*(?:"|')?/gi;

/**
 * Lọc nội dung richtext trước khi lưu DB.
 * Không phải allowlist đầy đủ (client làm việc đó) — mục tiêu là chặn mọi vector XSS phổ biến.
 */
function sanitizeRichContent(html) {
  return String(html || "")
    .replace(DANGEROUS_BLOCK, "")
    .replace(DANGEROUS_OPEN, "")
    .replace(EVENT_HANDLER, "")
    .replace(JS_URL, "")
    .trim();
}

/** Chuyển HTML richtext thành văn bản thuần (preview/thông báo/trích dẫn). */
function richToPlainText(html) {
  return String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|blockquote|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = { sanitizeRichContent, richToPlainText };
