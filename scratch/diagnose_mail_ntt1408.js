/**
 * CHẨN ĐOÁN mailbox ntt1408@cmsbando.com
 * KHÔNG xoá mail: chỉ đọc banner, USER/PASS/STAT/QUIT (POP3) và EHLO/AUTH (SMTP).
 *
 * Chạy: node scratch/diagnose_mail_ntt1408.js
 */
const net = require("net");
const tls = require("tls");
const { Pop3Client } = require("../services/mail/mailPop3Client");
const sendService = require("../services/mail/mailSendService");

const HOST = "mail.cmsbando.com";
const USERNAME = "ntt1408@cmsbando.com";
const PASSWORD = "cmsbd2514!";

/** Đọc dòng banner đầu tiên của server. */
function readBanner(port, secure, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(value);
    };
    const onData = (chunk) => finish(chunk.toString("utf8").split(/\r?\n/).filter(Boolean).slice(0, 3).join(" | "));
    const socket = secure
      ? tls.connect({ host: HOST, port, rejectUnauthorized: false }, () => socket.write(""))
      : net.connect({ host: HOST, port }, () => {});
    socket.setTimeout(timeoutMs, () => finish("(timeout)"));
    socket.once("data", onData);
    socket.once("error", (e) => finish(`ERROR ${e.message}`));
  });
}

/* ------------------------------ POP3 ------------------------------ */
async function testPop3(port, secure) {
  const client = new Pop3Client({
    host: HOST, port, secure, username: USERNAME, password: PASSWORD,
    timeoutMs: 12000, rejectUnauthorized: false, log: () => {},
  });
  const out = { port, secure, user: null, pass: null, stat: null, error: null };
  try {
    await client.connect();
    try { await client._cmd(`USER ${USERNAME}`); out.user = "+OK"; }
    catch (e) { out.user = e.pop3Response || e.message; }
    try {
      await client._cmd(`PASS ${PASSWORD}`);
      out.pass = "+OK";
      try { const s = await client.stat(); out.stat = `${s.count} email`; }
      catch (e) { out.stat = e.pop3Response || e.message; }
    } catch (e) { out.pass = e.pop3Response || e.message; }
  } catch (e) { out.error = e.message; }
  finally { client.destroy(); }
  return out;
}

/* ------------------------------ SMTP ------------------------------ */
async function testSmtp(port, secure) {
  try {
    const r = await sendService.testSmtpConfig(
      { host: HOST, port, secure, rejectUnauthorized: false, username: USERNAME, password: PASSWORD },
      { timeoutMs: 10000 }
    );
    return { ok: r.ok, message: r.message };
  } catch (e) {
    return { ok: false, message: sendService.friendlySmtpError(e) || e.message };
  }
}

async function main() {
  console.log(`=== Chẩn đoán ${USERNAME} @ ${HOST} ===\n`);

  console.log("--- Banner máy chủ ---");
  console.log("POP3 110 :", await readBanner(110, false));
  console.log("POP3 995 :", await readBanner(995, true));
  console.log("SMTP 25  :", await readBanner(25, false));
  console.log("SMTP 465 :", await readBanner(465, true));

  console.log("\n--- POP3 (chỉ xác thực, KHÔNG xoá mail) ---");
  for (const [port, secure] of [[110, false], [995, true]]) {
    const r = await testPop3(port, secure);
    console.log(
      `POP3 ${String(port).padEnd(4)} secure=${String(secure).padEnd(5)} | USER=${r.user} | PASS=${r.pass}` +
        (r.stat ? ` | STAT=${r.stat}` : "") + (r.error ? ` | ERROR=${r.error}` : "")
    );
  }

  console.log("\n--- SMTP ---");
  for (const [port, secure] of [[25, false], [465, true], [587, false], [587, true]]) {
    const r = await testSmtp(port, secure);
    console.log(`SMTP ${String(port).padEnd(4)} secure=${String(secure).padEnd(5)} | ok=${r.ok} | ${r.message}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => setTimeout(() => process.exit(0), 200));

