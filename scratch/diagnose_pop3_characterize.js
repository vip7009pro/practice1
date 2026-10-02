/**
 * Phân biệt 3 tình huống POP3 trên MAILNARA/MDaemon:
 *   (a) user không tồn tại  -> thông báo gì?
 *   (b) sai mật khẩu        -> thông báo gì?
 *   (c) ntt1408 (user báo)  -> "not allowed ip"
 * => để khẳng định đây là lỗi IP-restriction hay sai tài khoản.
 *
 * KHÔNG xoá mail. Chạy: node scratch/diagnose_pop3_characterize.js
 */
const { Pop3Client } = require("../services/mail/mailPop3Client");

const HOST = "mail.cmsbando.com";

async function tryAuth(username, password) {
  const client = new Pop3Client({
    host: HOST, port: 110, secure: false, username, password,
    timeoutMs: 12000, rejectUnauthorized: false, log: () => {},
  });
  try {
    await client.connect();
    await client._cmd(`USER ${username}`);
    await client._cmd(`PASS ${password}`);
    return "AUTH OK";
  } catch (e) {
    return e.pop3Response || e.message;
  } finally {
    client.destroy();
  }
}

async function main() {
  const cases = [
    ["(a) user KHÔNG tồn tại", "zzz-khong-ton-tai-99999@cmsbando.com", "whatever123"],
    ["(b) sai mật khẩu (nth1106)", "nth1106@cmsbando.com", "sai-mat-khau-xyz-000"],
    ["(c) ntt1408 (đúng pass theo user cung cấp)", "ntt1408@cmsbando.com", "cmsbd2514!"],
    ["(d) ntt1408 (pass rỗng)", "ntt1408@cmsbando.com", ""],
  ];
  for (const [label, u, p] of cases) {
    const r = await tryAuth(u, p);
    console.log(`${label.padEnd(46)} → ${r}`);
  }
}

main().finally(() => setTimeout(() => process.exit(0), 200));
