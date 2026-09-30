/**
 * Lấy metadata (Open Graph) của một liên kết để hiển thị "link preview" trong chat.
 *
 * Chạy ở SERVER vì trình duyệt bị chặn CORS khi đọc HTML của trang khác.
 *
 * ⚠️ Chống SSRF:
 *  - Chỉ cho http/https.
 *  - Chặn hostname nội bộ (localhost, *.local/*.internal) và mọi IP trong dải private/loopback/link-local.
 *  - Phân giải DNS và kiểm tra TOÀN BỘ địa chỉ trả về (chống DNS trỏ về IP nội bộ).
 *  - Tự đi theo redirect (tối đa 3 hop) và kiểm tra lại URL ở MỖI hop.
 *  - Giới hạn thời gian (6s) và dung lượng đọc (256KB) để không bị treo/ngốn RAM.
 */
const dns = require("dns").promises;
const net = require("net");

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;

/** url -> { exp, data } */
const cache = new Map();

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (version === 6) {
    const value = ip.toLowerCase();
    if (value === "::1" || value === "::") return true;
    if (value.startsWith("fe80") || value.startsWith("fc") || value.startsWith("fd")) return true;
    // IPv4-mapped (::ffff:127.0.0.1)
    const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true;
}

async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL không hợp lệ");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Chỉ hỗ trợ http/https");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Địa chỉ nội bộ không được phép");
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Dải IP nội bộ không được phép");
    return parsed;
  }
  const records = await dns.lookup(hostname, { all: true }).catch(() => []);
  if (records.length === 0) throw new Error("Không phân giải được tên miền");
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error("Tên miền trỏ về dải IP nội bộ");
  }
  return parsed;
}

/** Đọc tối đa MAX_BYTES đầu của response rồi dừng (không tải cả trang). */
async function readCappedBody(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(Buffer.from(value));
        total += value.length;
        if (total >= MAX_BYTES) break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bóc tất cả thẻ <meta ...> rồi trả map { property|name: content }. */
function parseMetaTags(html) {
  const map = new Map();
  const regex = /<meta\s+([^>]+)>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    const key = attrs.match(/(?:property|name)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const content = attrs.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!key || !content) continue;
    const name = (key[1] || key[2] || key[3] || "").toLowerCase().trim();
    const value = content[1] || content[2] || content[3] || "";
    if (name && !map.has(name)) map.set(name, value);
  }
  return map;
}

function parseHtml(html, finalUrl) {
  const meta = parseMetaTags(html);
  const titleTag = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);

  const title =
    decodeEntities(meta.get("og:title") || meta.get("twitter:title") || "") ||
    decodeEntities(titleTag ? titleTag[1] : "");
  const description = decodeEntities(
    meta.get("og:description") || meta.get("twitter:description") || meta.get("description") || ""
  );

  let image = meta.get("og:image") || meta.get("og:image:url") || meta.get("twitter:image") || "";
  image = decodeEntities(image);
  if (image) {
    try {
      const resolved = new URL(image, finalUrl);
      image = resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : "";
    } catch {
      image = "";
    }
  }

  let siteName = decodeEntities(meta.get("og:site_name") || "");
  if (!siteName) {
    try {
      siteName = new URL(finalUrl).hostname.replace(/^www\./i, "");
    } catch {
      siteName = "";
    }
  }

  return {
    url: finalUrl,
    title: title.slice(0, 200),
    description: description.slice(0, 400),
    image: image || "",
    siteName: siteName.slice(0, 80),
  };
}

async function fetchWithRedirects(startUrl) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Nhiều site chặn UA lạ hoặc không trả OG cho bot.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "vi,en;q=0.8",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Chuyển hướng không hợp lệ");
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error(`Trang trả về HTTP ${response.status}`);

    const contentType = String(response.headers.get("content-type") || "");
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      throw new Error("Liên kết không phải trang HTML");
    }

    const html = await readCappedBody(response);
    return parseHtml(html, current);
  }
  throw new Error("Quá nhiều lần chuyển hướng");
}

/**
 * Lấy preview cho 1 URL (có cache 30 phút). Ném lỗi khi URL không hợp lệ/không lấy được.
 */
async function fetchLinkPreview(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) throw new Error("Thiếu URL");

  const cached = cache.get(url);
  if (cached && cached.exp > Date.now()) return cached.data;

  const result = await fetchWithRedirects(url);
  if (cache.size >= CACHE_MAX) {
    // Xoá entry cũ nhất (Map giữ thứ tự chèn).
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, { exp: Date.now() + CACHE_TTL_MS, data: result });
  return result;
}

module.exports = { fetchLinkPreview, isPrivateIp };
