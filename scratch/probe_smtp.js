/**
 * Dò cổng SMTP cho mailbox thật (không in mật khẩu).
 * Chạy: node scratch/probe_smtp.js [EMPL_NO]
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();

const mailRepo = require("../services/mail/mailRepository");
const mailCrypto = require("../services/mail/mailCrypto");
const send = require("../services/mail/mailSendService");
const { openConnection } = require("../config/database");

async function main() {
  const empl = (process.argv[2] || "NHU1903").trim().toUpperCase();
  const rows = await mailRepo.queryRows(
    `SELECT ID, EMAIL_ADDRESS, POP3_HOST, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USERNAME, IS_ACTIVE
     FROM ZTB_MAIL_ACCOUNT WHERE LTRIM(RTRIM(EMPL_NO)) = @E ORDER BY ID`,
    { E: empl }
  );
  if (rows.length === 0) {
    console.log(`Không tìm thấy mailbox cho ${empl}`);
    return;
  }
  for (const row of rows) {
    console.log(`\n=== Mailbox #${row.ID} ${row.EMAIL_ADDRESS} (active=${row.IS_ACTIVE}) ===`);
    const full = await mailRepo.getAccountWithCredentials(row.ID);
    const host = String(row.SMTP_HOST || row.POP3_HOST || "").trim();
    const username = String(row.SMTP_USERNAME || full.POP3_USERNAME || row.EMAIL_ADDRESS).trim();
    const password = full.SMTP_CRED_ENC
      ? mailCrypto.decryptSecret(full.SMTP_CRED_ENC)
      : full.POP3_CRED_ENC
        ? mailCrypto.decryptSecret(full.POP3_CRED_ENC)
        : "";
    console.log(`SMTP host=${host} · đang cấu hình port=${row.SMTP_PORT} secure=${row.SMTP_SECURE} · user=${username} · có mật khẩu: ${password ? "có" : "KHÔNG"}`);

    const probe = await send.probeSmtp ? await send.probeSmtp({ host, username, password, timeoutMs: 8000 }) : null;
    if (!probe) { console.log("  (không gọi được probeSmtp)"); continue; }
    for (const r of probe.results) {
      console.log(`  ${r.ok ? "✔" : "✘"} ${r.label} — ${r.message}`);
    }
    console.log(probe.recommended ? `  ⇒ NÊN DÙNG: port ${probe.recommended.port} (secure=${probe.recommended.secure})` : "  ⇒ KHÔNG cổng nào kết nối được");
  }
}

main()
  .catch((e) => { console.error("lỗi:", e?.message || e); process.exitCode = 1; })
  .finally(async () => { try { (await openConnection()).close(); } catch { /* bỏ qua */ } });
