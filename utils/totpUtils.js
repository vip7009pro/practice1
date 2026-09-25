const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Mã hóa Buffer thành chuỗi Base32 RFC 4648 (không padding để tương thích tốt với Google Authenticator)
 */
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Giải mã chuỗi Base32 RFC 4648 thành Buffer
 */
function base32Decode(base32Str) {
  const cleaned = base32Str.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Ký tự Base32 không hợp lệ: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Tạo secret key Base32 ngẫu nhiên an toàn (20 bytes = 160 bits entropy)
 */
function generateSecret(length = 20) {
  const randomBytes = crypto.randomBytes(length);
  return base32Encode(randomBytes);
}

/**
 * Sinh mã OTP 6 chữ số theo thuật toán TOTP RFC 6238
 * @param {string} secret - Khóa bí mật dạng Base32
 * @param {number} timeMs - Timestamp thời gian (mặc định Date.now())
 * @param {number} step - Khoảng thời gian chu kỳ (mặc định 30 giây)
 * @param {number} digits - Số lượng chữ số (mặc định 6)
 */
function generateTOTP(secret, timeMs = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(timeMs / 1000 / step);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const keyBuffer = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", keyBuffer).update(counterBuffer).digest();

  // Dynamic Truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binary % Math.pow(10, digits)).toString().padStart(digits, "0");
  return otp;
}

/**
 * Xác thực mã OTP với dung sai window (chống lệch giờ client/server)
 * @param {string} token - Mã 6 số do user nhập
 * @param {string} secret - Khóa bí mật Base32 của user
 * @param {number} window - Số chu kỳ cho phép lệch trước/sau (mặc định 1 bước = ±30s)
 * @returns {boolean}
 */
function verifyTOTP(token, secret, window = 1, step = 30, digits = 6) {
  if (!token || !secret) return false;
  const cleanToken = String(token).trim().replace(/\s+/g, "");
  if (cleanToken.length !== digits || !/^\d+$/.test(cleanToken)) return false;

  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const testTime = now + i * step * 1000;
    const generated = generateTOTP(secret, testTime, step, digits);
    if (generated === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Sinh danh sách mã cứu hộ dự phòng (Backup Codes)
 * @param {number} count - Số lượng mã (mặc định 8)
 * @returns {string[]} Mảng các mã như ['A1B2-C3D4', ...]
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Bỏ 0, 1, I, O để tránh nhầm lẫn

  for (let i = 0; i < count; i++) {
    let codePart1 = "";
    let codePart2 = "";
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 4; j++) {
      codePart1 += chars[bytes[j] % chars.length];
      codePart2 += chars[bytes[j + 4] % chars.length];
    }
    codes.push(`${codePart1}-${codePart2}`);
  }

  return codes;
}

/**
 * Tạo URL chuẩn otpauth:// để render mã QR Code
 */
function generateOtpAuthUri(accountName, issuer, secret) {
  const cleanIssuer = encodeURIComponent(issuer || "CMS_ERP");
  const cleanAccount = encodeURIComponent(accountName || "user");
  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  generateOtpAuthUri,
};
