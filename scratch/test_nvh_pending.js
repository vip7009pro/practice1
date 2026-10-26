const { openConnection } = require("../config/database");
const mailRepo = require("../services/mail/mailRepository");
const msgRepo = require("../services/mail/mailMessageRepository");
const mailCrypto = require("../services/mail/mailCrypto");
const { Pop3Client } = require("../services/mail/mailPop3Client");

async function run() {
  const account = await mailRepo.getAccountWithCredentials(7);
  console.log("Account:", account.EMAIL_ADDRESS, account.POP3_HOST, account.POP3_PORT);
  
  const password = mailCrypto.decryptSecret(account.POP3_CRED_ENC);
  const client = new Pop3Client({
    host: account.POP3_HOST,
    port: account.POP3_PORT,
    secure: account.POP3_SECURE === true || account.POP3_SECURE === 1,
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
    console.log(`Total UIDLs: ${uidlMap.size}`);

    const existing = await msgRepo.listExistingUidls(account.ID);
    console.log(`Existing UIDLs in DB: ${existing.size}`);

    const numbers = [...uidlMap.keys()].sort((a, b) => a - b);
    const pending = numbers.filter((no) => {
      const uidl = uidlMap.get(no);
      return !existing.has(uidl);
    });

    console.log(`Pending count: ${pending.length}`);
    console.log(`Pending numbers (first 10):`, pending.slice(0, 10));

    const sizeMap = await client.list();
    for (const no of pending.slice(0, 5)) {
      console.log(`Msg #${no}: UIDL=${uidlMap.get(no)}, Size=${sizeMap.get(no)} bytes`);
    }

    if (pending.length > 0) {
      const firstPending = pending[0];
      console.log(`\nTesting TOP 0 for first pending #${firstPending}...`);
      try {
        const top0 = await client.top(firstPending, 0);
        console.log(`TOP 0 success! Length: ${top0.length}`);
        console.log("Header sample:\n", top0.toString("utf8").slice(0, 500));
      } catch (e) {
        console.error(`TOP 0 failed:`, e);
      }

      console.log(`\nTesting RETR for first pending #${firstPending}...`);
      const t0 = Date.now();
      try {
        const raw = await client.retr(firstPending, { maxBytes: 50 * 1024 * 1024 });
        console.log(`RETR success in ${Date.now() - t0}ms! Length: ${raw.length}`);
      } catch (e) {
        console.error(`RETR failed in ${Date.now() - t0}ms:`, e.message || e);
      }
    }
  } catch (err) {
    console.error("General error:", err);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

run();
