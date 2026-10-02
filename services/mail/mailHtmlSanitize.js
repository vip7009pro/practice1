/**
 * Làm sạch HTML TRƯỚC KHI GỬI email (Phase 9 — security hardening).
 *
 * Vì sao cần: client (MailComposer) đã lọc bằng sanitizer phía FE, nhưng API là kênh mở —
 * một client khác hoàn toàn có thể gửi `BODY_HTML` chứa `<script>`, `onerror=`, `javascript:`
 * ⇒ thư gửi đi sẽ mang mã độc tới người nhận (uy tín công ty). Lớp này lọc lần cuối ở server.
 *
 * Nguyên tắc: CHỈ chặn vector nguy hiểm, KHÔNG viết lại cấu trúc HTML (bảng/ảnh/định dạng
 * của người dùng phải giữ nguyên — khác với sanitizer phía FE vốn có allowlist chặt).
 */

const DANGEROUS_BLOCK = /<\s*(script|iframe|object|embed|applet|form|base|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SELF_CLOSING = /<\s*(iframe|object|embed|applet|base|meta|link|script)\b[^>]*\/?>/gi;
/** Thuộc tính sự kiện: onclick, onerror, onload… (dùng \s thay cho dấu cách để tránh ký tự ẩn) */
const EVENT_ATTR = /\son[a-z]{3,}\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
/** URL nguy hiểm trong href/src/action/background/style. */
const DANGEROUS_URL = /\b(javascript|vbscript|livescript|mocha)\s*:/gi;
const DATA_TEXT_HTML = /data\s*:\s*text\s*\/\s*html/gi;
/** CSS expression()/behavior (IE) và url(javascript:). */
const STYLE_EXPRESSION = /(expression|behavior)\s*\(/gi;

/**
 * Lọc HTML thư gửi đi.
 * @param {string} html
 * @returns {{ html: string, removed: { blocks: number, events: number, urls: number } }}
 */
function sanitizeOutboundHtml(html) {
  let output = String(html || "");
  const removed = { blocks: 0, events: 0, urls: 0 };

  output = output.replace(DANGEROUS_BLOCK, (match) => {
    removed.blocks += 1;
    return "";
  });
  output = output.replace(DANGEROUS_SELF_CLOSING, (match) => {
    // Giữ <link>/<meta> ngoài document body là vô nghĩa trong email ⇒ bỏ luôn.
    removed.blocks += 1;
    return "";
  });
  output = output.replace(EVENT_ATTR, (match) => {
    removed.events += 1;
    return "";
  });
  output = output.replace(DANGEROUS_URL, (match) => {
    removed.urls += 1;
    return "blocked:";
  });
  output = output.replace(DATA_TEXT_HTML, (match) => {
    removed.urls += 1;
    return "blocked:";
  });
  output = output.replace(STYLE_EXPRESSION, (match) => {
    removed.events += 1;
    return "blocked(";
  });

  return { html: output, removed };
}

module.exports = { sanitizeOutboundHtml };
