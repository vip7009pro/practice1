/** Cập nhật cấu hình SMTP cho mailbox của 1 nhân sự (mặc định NHU1903) — dùng sau khi dò cổng. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();
const mailRepo = require("../services/mail/mailRepository");
const { openConnection } = require("../config/database");

async function main() {
  const empl = (process.argv[2] || "NHU1903").trim().toUpperCase();
  const port = Number(process.argv[3] || 25);
  const secure = String(process.argv[4] || "false") === "true";

  const acc = null;
  // Lấy trực tiếp theo EMPL_NO (getAccountByEmpl cần ctrCd nên không dùng ở script này).
  const row = (await mailRepo.queryRows(
    `SELECT TOP 1 ID, EMAIL_ADDRESS, SMTP_HOST, POP3_HOST, SMTP_USERNAME FROM ZTB_MAIL_ACCOUNT WHERE LTRIM(RTRIM(EMPL_NO)) = @E ORDER BY ID`,
    { E: empl }
  ))[0];
  if (!row) { console.log(`Không thấy mailbox cho ${empl}`); return; }

  await mailRepo.updateAccount(row.ID, {
    smtpHost: row.SMTP_HOST || row.POP3_HOST,
    smtpPort: port,
    smtpSecure: secure,
    smtpUsername: row.SMTP_USERNAME || row.EMAIL_ADDRESS,
  });
  console.log(`✔ Đã cập nhật mailbox #${row.ID} (${row.EMAIL_ADDRESS}): SMTP port=${port}, secure=${secure}`);
}

main().catch((e) => { console.error(e?.message || e); process.exitCode = 1; })
  .finally(async () => { try { (await openConnection()).close(); } catch { /* bỏ qua */ } });
