/**
 * Chẩn đoán SMTP thô (đọc đúng mã lỗi) + so sánh POP3 với account ĐANG chạy được.
 * KHÔNG gửi mail, KHÔNG xoá mail.
 *
 * Chạy: node scratch/diagnose_mail_smtp_raw.js
 */
const net = require("net");
const tls = require("tls");
const { openConnection, closePool } = require("../config/database");
const mailCrypto = require("../services/mail/mailCrypto");
const { Pop3Client } = require("../services/mail/mailPop3Client");

const HOST = "mail.cmsbando.com";
const TEST_USER = "ntt1408@cmsbando.com";
const TEST_PASS = "cmsbd2514!";

/* ------------------------ SMTP thô ------------------------ */
class RawSmtp {
  constructor(port, secure, timeoutMs = 10000) {
    this.port = port;
    this.secure = secure;
    this.timeoutMs = timeoutMs;
    this.buf = "";
    this.waiting = null;
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = this.secure
        ? tls.connect({ host: HOST, port: this.port, rejectUnauthorized: false })
        : net.connect({ host: HOST, port: this.port });
      this.socket.setTimeout(this.timeoutMs, () => reject(new Error("timeout")));
      this.socket.on("data", (c) => {
        this.buf += c.toString("utf8");
        if (this.waiting) this._drain();
      });
      this.socket.once("error", reject);
      this.socket.once(this.secure ? "secureConnect" : "connect", () => resolve());
    });
  }
  _extract() {
    // Trả về 1 response hoàn chỉnh (hỗ trợ nhiều dòng "250-...").
    const lines = this.buf.split(/\r?\n/);
    if (lines.length < 2) return null;
    const complete = [];
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      complete.push(line);
      if (/^\d{3}[ ]/.test(line) || /^\d{3}$/.test(line)) {
        // dòng cuối của response
        const rest = lines.slice(i + 1).join("\r\n");
        this.buf = rest;
        return complete.join("\n");
      }
    }
    return null;
  }
  _drain() {
    const resp = this._extract();
    if (resp !== null && this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve(resp);
    }
  }
  read() {
    return new Promise((resolve) => {
      this.waiting = resolve;
      this._drain();
    });
  }
  send(line) {
    this.socket.write(line + "\r\n");
  }
  close() {
    try { this.socket.write("QUIT\r\n"); } catch {}
    try { this.socket.destroy(); } catch {}
  }
}

async function smtpDialog(port, secure) {
  const out = { port, secure, steps: [] };
  const c = new RawSmtp(port, secure);
  try {
    await c.connect();
    out.steps.push(["GREETING", await c.read()]);
    c.send("EHLO cmsvina.local");
    out.steps.push(["EHLO", await c.read()]);
    // Thử AUTH LOGIN
    c.send("AUTH LOGIN");
    const a1 = await c.read();
    out.steps.push(["AUTH LOGIN", a1]);
    if (/^334/.test(a1)) {
      c.send(Buffer.from(TEST_USER).toString("base64"));
      out.steps.push(["USER(b64)", await c.read()]);
      c.send(Buffer.from(TEST_PASS).toString("base64"));
      out.steps.push(["PASS(b64)", await c.read()]);
    }
  } catch (e) {
    out.steps.push(["ERROR", e.message]);
  } finally {
    c.close();
  }
  return out;
}

/* ------------------------ POP3 so sánh ------------------------ */
async function pop3Try(username, password) {
  const client = new Pop3Client({
    host: HOST, port: 110, secure: false, username, password,
    timeoutMs: 12000, rejectUnauthorized: false, log: () => {},
  });
  try {
    await client.connect();
    await client._cmd(`USER ${username}`);
    await client._cmd(`PASS ${password}`);
    const s = await client.stat().catch(() => null);
    return { ok: true, stat: s ? `${s.count} email` : "?" };
  } catch (e) {
    return { ok: false, message: e.pop3Response || e.message };
  } finally {
    client.destroy();
  }
}

async function main() {
  console.log("=== SMTP thô ===\n");
  for (const [port, secure] of [[25, false], [465, true], [465, false]]) {
    const r = await smtpDialog(port, secure);
    console.log(`--- SMTP ${port} secure=${secure} ---`);
    r.steps.forEach(([k, v]) => console.log(`  ${k}: ${String(v).replace(/\n/g, "\n          ")}`));
    console.log();
  }

  console.log("=== POP3 so sánh account đang chạy được (giải mã từ DB) ===\n");
  const pool = await openConnection();
  const rows = (
    await pool.query(
      `SELECT TOP 3 ID, EMAIL_ADDRESS, POP3_USERNAME, POP3_CRED_ENC
         FROM ZTB_MAIL_ACCOUNT
        WHERE POP3_CRED_ENC IS NOT NULL AND IS_ACTIVE = 1 AND EMAIL_ADDRESS LIKE '%@cmsbando.com'
          AND EMAIL_ADDRESS <> @SELF
        ORDER BY ID DESC`,
      { SELF: TEST_USER }
    )
  ).recordset;
  for (const row of rows) {
    let pass = null;
    try { pass = mailCrypto.decryptSecret(row.POP3_CRED_ENC); } catch (e) { console.log(`  ${row.EMAIL_ADDRESS}: không giải mã được (${e.message})`); continue; }
    const r = await pop3Try(String(row.POP3_USERNAME || row.EMAIL_ADDRESS).trim(), pass);
    console.log(`  ${String(row.EMAIL_ADDRESS).padEnd(28)} → ${r.ok ? "OK " + r.stat : r.message}`);
  }

  console.log(`\n  ${TEST_USER.padEnd(28)} → ${JSON.stringify(await pop3Try(TEST_USER, TEST_PASS))}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    await closePool().catch(() => undefined);
    setTimeout(() => process.exit(0), 200);
  });
