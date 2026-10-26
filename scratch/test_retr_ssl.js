const { openConnection } = require("../config/database");
const mailRepo = require("../services/mail/mailRepository");
const mailCrypto = require("../services/mail/mailCrypto");
const { Pop3Client } = require("../services/mail/mailPop3Client");

async function run() {
  const account = await mailRepo.getAccountWithCredentials(7);
  const password = mailCrypto.decryptSecret(account.POP3_CRED_ENC);

  console.log("Connecting via PORT 995 (SSL/TLS)...");
  const client = new Pop3Client({
    host: account.POP3_HOST,
    port: 995,
    secure: true,
    rejectUnauthorized: false,
    username: account.POP3_USERNAME || account.EMAIL_ADDRESS,
    password: password,
    timeoutMs: 20000,
    log: (msg) => console.log("[POP3-SSL]", msg),
  });

  try {
    await client.connect();
    await client.auth();
    console.log("Auth OK via SSL!");

    console.log("Testing RETR #383 via SSL...");
    const t0 = Date.now();
    const raw = await client.retr(383, { maxBytes: 50 * 1024 * 1024 });
    console.log(`RETR 383 SUCCESS via SSL in ${Date.now() - t0}ms! Length: ${raw.length}`);
  } catch (err) {
    console.error("SSL RETR 383 FAILED:", err.message || err);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

run();
