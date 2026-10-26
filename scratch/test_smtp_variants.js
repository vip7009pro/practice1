const nodemailer = require("nodemailer");
const mailRepo = require("../services/mail/mailRepository");
const mailCrypto = require("../services/mail/mailCrypto");

async function test(port, secure) {
  const account = await mailRepo.getAccountWithCredentials(7);
  const pass = mailCrypto.decryptSecret(account.SMTP_CRED_ENC || account.POP3_CRED_ENC);

  console.log(`\nTesting SMTP port=${port}, secure=${secure}...`);
  const transporter = nodemailer.createTransport({
    host: "mail.cmsbando.com",
    port: port,
    secure: secure,
    auth: { user: "nvh1903@cmsbando.com", pass: pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.verify();
    console.log(`SMTP port=${port}, secure=${secure} => SUCCESS!`);
  } catch (err) {
    console.log(`SMTP port=${port}, secure=${secure} => FAILED: ${err.message}`);
  }
}

async function run() {
  await test(25, false);
  await test(465, true);
  await test(587, false);
  await test(25, true);
  process.exit(0);
}

run();
