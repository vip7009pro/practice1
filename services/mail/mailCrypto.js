/**
 * Mã hoá credential mailbox (POP3/SMTP) — AES-256-GCM.
 *
 * KHÔNG bao giờ lưu mật khẩu plaintext. Master key lấy từ env `MAIL_CRED_KEY`:
 *  - 64 ký tự hex           ⇒ dùng trực tiếp làm khoá 32 byte.
 *  - base64 giải ra 32 byte ⇒ dùng trực tiếp.
 *  - chuỗi bất kỳ khác      ⇒ dẫn xuất bằng scrypt (salt tĩnh theo phiên bản).
 *
 * Định dạng bản mã (lưu ở cột `*_CRED_ENC`):  `v1:<ivB64>:<tagB64>:<cipherB64>`
 *
 * ⚠️ Đổi `MAIL_CRED_KEY` ⇒ MỌI credential cũ không giải mã được nữa.
 */
const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM khuyến nghị 96-bit
const VERSION = "v1";
const SALT = "erp-mail-cred-v1";

let cachedKey = null;
let cachedKeySource = null;

function deriveKey(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  // 64 hex ⇒ khoá thô
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  // base64 32 byte ⇒ khoá thô
  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    /* không phải base64 hợp lệ ⇒ dẫn xuất */
  }

  // còn lại: passphrase ⇒ scrypt
  return crypto.scryptSync(value, SALT, 32);
}

/** Lấy khoá master (cache theo giá trị env). Trả null nếu chưa cấu hình. */
function getMasterKey() {
  const raw = process.env.MAIL_CRED_KEY;
  if (cachedKey && cachedKeySource === raw) return cachedKey;
  const key = deriveKey(raw);
  cachedKey = key;
  cachedKeySource = raw;
  return key;
}

/** Đã cấu hình khoá chưa? Dùng để cảnh báo sớm lúc khởi động worker. */
function isConfigured() {
  return !!getMasterKey();
}

function requireKey() {
  const key = getMasterKey();
  if (!key) {
    throw new Error(
      "Thiếu MAIL_CRED_KEY — không thể mã hoá/giải mã credential mailbox. Thêm biến này vào outbinary/.ENV"
    );
  }
  return key;
}

/**
 * Mã hoá 1 chuỗi bí mật. Trả null nếu đầu vào rỗng.
 * @param {string} plaintext
 * @returns {string|null}
 */
function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "") return null;
  const key = requireKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/**
 * Giải mã chuỗi đã mã hoá bằng encryptSecret.
 * @param {string} payload
 * @returns {string|null}
 */
function decryptSecret(payload) {
  if (!payload) return null;
  const parts = String(payload).split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Bản mã credential không đúng định dạng");
  }
  const key = requireKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

/** Che credential khi log — chỉ giữ vài ký tự đầu/cuối. */
function maskSecret(value) {
  const s = String(value || "");
  if (s.length <= 4) return "****";
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
}

module.exports = {
  isConfigured,
  encryptSecret,
  decryptSecret,
  maskSecret,
};
