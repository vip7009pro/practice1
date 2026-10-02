/**
 * Kết nối NAS (SMB/UNC) có xác thực.
 *
 * VÌ SAO CẦN: Node.js KHÔNG truyền được username/password SMB khi đọc/ghi file.
 * Quyền truy cập thư mục mạng do TÀI KHOẢN WINDOWS đang chạy PM2 quyết định.
 * ⇒ Ta dùng `net use` để thiết lập kết nối có credential TRƯỚC khi worker ghi file.
 *
 * Cấu hình trong `.ENV` (chỉ cần khi NAS yêu cầu đăng nhập):
 *   MAIL_NAS_UNC=\\192.168.1.55\erp_mail     # đường dẫn chia sẻ
 *   MAIL_NAS_USER=erpuser                     # tài khoản NAS
 *   MAIL_NAS_PASS=********                    # mật khẩu (lưu plaintext như DB_PASS)
 *   MAIL_NAS_DOMAIN=                          # tuỳ chọn: tên miền/máy NAS
 *   MAIL_NAS_DRIVE=Z:                         # tuỳ chọn: gán vào ổ đĩa (nếu MAIL_STORAGE_PATH dùng ổ đĩa)
 *   MAIL_STORAGE_PATH=Z:\                      # dùng ổ đĩa đã gán, hoặc chính UNC ở trên
 *
 * Nếu KHÔNG cấu hình MAIL_NAS_* (ví dụ NAS đã cache credential sẵn trên máy chủ),
 * module bỏ qua và để hệ điều hành xử lý như bình thường.
 */
const { execFile } = require("child_process");
const fs = require("fs");

const isWindows = process.platform === "win32";

function netUse(args) {
  return new Promise((resolve) => {
    execFile("net", ["use", ...args], { windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code, stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

/**
 * Đảm bảo NAS đã được kết nối (idempotent).
 * @returns {Promise<{attempted:boolean, ok:boolean, message:string}>}
 */
async function ensureNasMount() {
  const unc = String(process.env.MAIL_NAS_UNC || "").trim();
  if (!unc) {
    return { attempted: false, ok: true, message: "Không cấu hình MAIL_NAS_UNC — bỏ qua mount NAS" };
  }
  if (!isWindows) {
    return { attempted: false, ok: true, message: "Không phải Windows — bỏ qua net use" };
  }

  const user = String(process.env.MAIL_NAS_USER || "").trim();
  const pass = String(process.env.MAIL_NAS_PASS || "");
  const domain = String(process.env.MAIL_NAS_DOMAIN || "").trim();
  const drive = String(process.env.MAIL_NAS_DRIVE || "").trim();
  const target = drive || unc;

  const args = [];
  if (drive) args.push(drive);
  args.push(unc);
  if (pass) args.push(pass);
  if (user) args.push(`/user:${domain ? `${domain}\\${user}` : user}`);
  args.push("/persistent:yes");

  const result = await netUse(args);
  const combined = `${result.stdout}\n${result.stderr}`;

  // 1219 = đã có kết nối tới server này bằng credential khác; 85 = đã tồn tại.
  const already = /1219|85|Multiple connections|already/i.test(combined);
  if (result.ok || already) {
    const ok = verifyStorageReachable();
    return {
      attempted: true,
      ok,
      message: ok
        ? `NAS đã kết nối: ${target}`
        : `net use báo OK nhưng KHÔNG truy cập được MAIL_STORAGE_PATH (kiểm tra quyền/quota): ${combined.trim()}`,
    };
  }

  return {
    attempted: true,
    ok: false,
    message: `net use thất bại cho ${target}: ${combined.trim() || result.code}`,
  };
}

/** Kiểm tra MAIL_STORAGE_PATH có thực sự đọc/ghi được sau khi mount. */
function verifyStorageReachable() {
  const storagePath = String(process.env.MAIL_STORAGE_PATH || "").trim();
  if (!storagePath) return true; // chưa cấu hình ⇒ để mailStorage tự chọn fallback
  try {
    fs.accessSync(storagePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = { ensureNasMount, verifyStorageReachable };
