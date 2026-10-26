const { openConnection } = require("../config/database");
const mailRepo = require("../services/mail/mailRepository");
const mailCrypto = require("../services/mail/mailCrypto");
const { Pop3Client } = require("../services/mail/mailPop3Client");

async function run() {
  const account = await mailRepo.getAccountWithCredentials(7);
  const password = mailCrypto.decryptSecret(account.POP3_CRED_ENC);

  const client = new Pop3Client({
    host: account.POP3_HOST,
    port: account.POP3_PORT,
    secure: false,
    username: account.POP3_USERNAME || account.EMAIL_ADDRESS,
    password: password,
    timeoutMs: 15000,
    log: (msg) => console.log("[POP3]", msg),
  });

  try {
    await client.connect();
    await client.auth();
    console.log("Auth OK");

    const uidlMap = await client.uidl();
    const sizeMap = await client.list();

    // Test thử các email: 384, 385, 386, 387, 388, 389, 390
    for (const no of [384, 385, 386, 387, 388, 389, 390, 440, 441, 442]) {
      console.log(`\n--- Testing msg #${no} (size: ${sizeMap.get(no)}, uidl: ${uidlMap.get(no)}) ---`);
      const t0 = Date.now();
      try {
        const top0 = await client.top(no, 0);
        console.log(`TOP 0 ok (${Date.now() - t0}ms), header len: ${top0.length}`);
        
        // Trích xuất Subject & Date
        const text = top0.toString("utf8");
        const sub = text.match(/(?:^|\r?\n)Subject:[ \t]*([^\r\n]*)/i);
        const date = text.match(/(?:^|\r?\n)Date:[ \t]*([^\r\n]*)/i);
        console.log(`Subject: ${sub ? sub[1] : "(none)"}`);
        console.log(`Date: ${date ? date[1] : "(none)"}`);

        const t1 = Date.now();
        const raw = await client.retr(no, { maxBytes: 50 * 1024 * 1024 });
        console.log(`RETR OK! size: ${raw.length} bytes in ${Date.now() - t1}ms`);
      } catch (err) {
        console.error(`FAILED for msg #${no}:`, err.message || err);
        break; // socket có thể đã hỏng nếu timeout
      }
    }
  } catch (err) {
    console.error("Run error:", err);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

run();
