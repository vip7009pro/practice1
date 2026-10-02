/**
 * Xác nhận SMTP AUTH từ IP này OK với account bình thường (nth1106) nhưng bị chặn với ntt1408.
 * + Kiểm tra mailbox ntt1408 có trong DB ERP không.
 * KHÔNG gửi mail, KHÔNG xoá mail.
 *
 * Chạy: node scratch/diagnose_smtp_compare.js
 */
const sendService = require("../services/mail/mailSendService");
const { openConnection, closePool } = require("../config/database");
const mailCrypto = require("../services/mail/mailCrypto");

const HOST = "mail.cmsbando.com";

async function smtpAuth(user, pass) {
  const r = await sendService.testSmtpConfig(
    { host: HOST, port: 25, secure: false, rejectUnauthorized: false, username: user, password: pass },
    { timeoutMs: 10000 }
  );
  return r.ok ? "OK" : r.message;
}

async function main() {
  const pool = await openConnection();
  const row = (
    await pool.query(
      `SELECT TOP 1 EMAIL_ADDRESS, POP3_USERNAME, POP3_CRED_ENC FROM ZTB_MAIL_ACCOUNT
        WHERE EMAIL_ADDRESS = @E ORDER BY ID DESC`,
      { E: "nth1106@cmsbando.com" }
    )
  ).recordset[0];
  const pass = row ? mailCrypto.decryptSecret(row.POP3_CRED_ENC) : null;

  console.log("--- SMTP AUTH cổng 25 (plaintext/STARTTLS) ---");
  console.log(`  nth1106@cmsbando.com  → ${row ? await smtpAuth(row.POP3_USERNAME || row.EMAIL_ADDRESS, pass) : "(không có trong DB)"}`);
  console.log(`  ntt1408@cmsbando.com  → ${await smtpAuth("ntt1408@cmsbando.com", "cmsbd2514!")}`);

  console.log("\n--- Kiểm tra DB ERP ---");
  const acc = (
    await pool.query(`SELECT ID, EMAIL_ADDRESS, EMPL_NO, IS_ACTIVE, POP3_HOST, POP3_PORT, SMTP_HOST, SMTP_PORT FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @E`, { E: "ntt1408@cmsbando.com" })
  ).recordset;
  console.log("  ZTB_MAIL_ACCOUNT:", acc.length ? JSON.stringify(acc[0]) : "(chưa có)");
  const emp = (
    await pool.query(`SELECT TOP 1 EMPL_NO, LTRIM(RTRIM(MIDLAST_NAME + ' ' + FIRST_NAME)) AS NAME, WORK_STATUS_CODE FROM ZTBEMPLINFO WHERE EMPL_NO = 'NTT1408'`)
  ).recordset;
  console.log("  Nhân sự NTT1408:", emp.length ? JSON.stringify(emp[0]) : "(không có)");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await closePool().catch(() => undefined); setTimeout(() => process.exit(0), 200); });
