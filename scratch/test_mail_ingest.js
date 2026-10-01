/**
 * Test Phase 1 — Email ingestion.
 *
 * Không cần mail server thật: dựng 1 POP3 server GIẢ trong tiến trình rồi chạy
 * trọn pipeline syncMailbox → parse → dedup → lưu DB + NAS.
 *
 * Chạy: node scratch/test_mail_ingest.js
 * Tự dọn dữ liệu + file test sau khi xong.
 */
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const crypto = require("crypto");

// Cấu hình test TRƯỚC khi require module (đọc env lúc load).
const TEST_STORE = path.join(os.tmpdir(), `erp-mail-test-${Date.now()}`);
process.env.MAIL_CRED_KEY = crypto.randomBytes(32).toString("hex");
process.env.MAIL_STORAGE_PATH = TEST_STORE;
process.env.MAIL_WORKER_ENABLED = "false";

const mailCrypto = require("../services/mail/mailCrypto");
const mailStorage = require("../services/mail/mailStorage");
const mailRepo = require("../services/mail/mailRepository");
const msgRepo = require("../services/mail/mailMessageRepository");
const { parseEmail, flattenRecipients } = require("../services/mail/mailParserService");
const { Pop3Client } = require("../services/mail/mailPop3Client");
const { syncMailbox } = require("../services/mail/mailIngest");
const { reconcile } = require("../services/mail/mailReconcile");
const { openConnection } = require("../config/database");

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass += 1; console.log(`  ✔ ${name}`); }
  else { fail += 1; console.log(`  ✘ ${name} ${extra}`); }
}

/* ---------------- Fake POP3 server ---------------- */

function startFakePop3(messages) {
  const server = net.createServer((socket) => {
    let buf = "";
    socket.write("+OK fake POP3 ready\r\n");
    socket.on("data", (d) => {
      buf += d.toString("latin1");
      let idx;
      while ((idx = buf.indexOf("\r\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        handle(line);
      }
    });
    socket.on("error", () => undefined);

    function handle(line) {
      const [cmdRaw, arg] = line.split(" ");
      const cmd = (cmdRaw || "").toUpperCase();
      if (cmd === "USER") socket.write("+OK\r\n");
      else if (cmd === "PASS") socket.write("+OK logged in\r\n");
      else if (cmd === "STAT") {
        const size = messages.reduce((s, m) => s + m.raw.length, 0);
        socket.write(`+OK ${messages.length} ${size}\r\n`);
      } else if (cmd === "UIDL") {
        socket.write("+OK\r\n");
        messages.forEach((m, i) => socket.write(`${i + 1} ${m.uidl}\r\n`));
        socket.write(".\r\n");
      } else if (cmd === "LIST") {
        socket.write("+OK\r\n");
        messages.forEach((m, i) => socket.write(`${i + 1} ${m.raw.length}\r\n`));
        socket.write(".\r\n");
      } else if (cmd === "RETR") {
        const m = messages[Number(arg) - 1];
        socket.write("+OK\r\n");
        socket.write(m.raw);
        socket.write("\r\n.\r\n");
      } else if (cmd === "QUIT") {
        socket.write("+OK bye\r\n");
        socket.end();
      } else {
        socket.write("-ERR unknown command\r\n");
      }
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

/* ---------------- Mẫu email ---------------- */

const RAW_EMAIL =
  "From: \"Nguyen Van A\" <a@test.local>\r\n" +
  "To: \"Nguyen Van B\" <b@test.local>\r\n" +
  "Cc: c@test.local\r\n" +
  "Subject: Bao cao san xuat thang 9\r\n" +
  "Message-ID: <ingest-test-1@test.local>\r\n" +
  "Date: Mon, 01 Sep 2025 10:00:00 +0700\r\n" +
  "MIME-Version: 1.0\r\n" +
  'Content-Type: multipart/mixed; boundary="BOUND-TEST"\r\n' +
  "\r\n" +
  "--BOUND-TEST\r\n" +
  'Content-Type: text/html; charset="utf-8"\r\n' +
  "\r\n" +
  "<html><body><b>Xin chao</b> — day la email test.</body></html>\r\n" +
  "--BOUND-TEST\r\n" +
  'Content-Type: text/plain; name="note.txt"\r\n' +
  'Content-Disposition: attachment; filename="note.txt"\r\n' +
  "\r\n" +
  "noi-dung-dinh-kem-1234567890\r\n" +
  "--BOUND-TEST--\r\n";

/* ---------------- Cleanup ---------------- */

async function cleanup(accountId) {
  try {
    await mailRepo.queryRows(
      `DELETE a FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID = @ACC;
       DELETE r FROM ZTB_MAIL_RECIPIENT r JOIN ZTB_MAIL_MESSAGE m ON m.ID = r.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID = @ACC;
       DELETE pf FROM ZTB_MAIL_PHYSICAL_FILE pf WHERE pf.ID NOT IN (SELECT PHYSICAL_FILE_ID FROM ZTB_MAIL_ATTACHMENT WHERE PHYSICAL_FILE_ID IS NOT NULL);
       DELETE m FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID = @ACC;
       DELETE t FROM ZTB_MAIL_THREAD t WHERE t.ID NOT IN (SELECT THREAD_ID FROM ZTB_MAIL_MESSAGE WHERE THREAD_ID IS NOT NULL);
       DELETE FROM ZTB_MAIL_SYNC_LOG WHERE MAIL_ACCOUNT_ID = @ACC;
       DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @ACC;`,
      { ACC: accountId }
    );
    await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: accountId });
  } catch (e) {
    console.log("  (cleanup DB bỏ qua:", e.message, ")");
  }
  try { fs.rmSync(TEST_STORE, { recursive: true, force: true }); } catch { /* bỏ qua */ }
}

/* ---------------- Main ---------------- */

async function main() {
  console.log("\n=== PHASE 1 TEST: mail ingest ===\n");

  // 1. Crypto
  console.log("[1] Crypto AES-256-GCM");
  const secret = "P@ssw0rd-한국어-✓";
  const enc = mailCrypto.encryptSecret(secret);
  check("mã hoá trả chuỗi v1:...", /^v1:/.test(enc || ""));
  check("không chứa plaintext", !String(enc).includes("P@ssw0rd"));
  check("giải mã khớp bản gốc", mailCrypto.decryptSecret(enc) === secret);

  // 2. Storage
  console.log("[2] Storage (NAS layout + dedup + traversal)");
  const root = mailStorage.resolveMailRoot();
  check("root là thư mục test", root.startsWith(TEST_STORE));
  const dir = mailStorage.buildMessageDir({ ctrCd: "CMS", sentAt: new Date("2025-09-01T10:00:00Z"), mailboxKey: "a@test.local", messageRef: "ref1" });
  check("layout <ctr>/<yyyy>/<mm>", dir.includes("CMS") && dir.includes("2025") && dir.includes("09"));
  const bodyPath = mailStorage.writeBody("<p>hi</p>", dir);
  check("ghi body thành file", fs.existsSync(bodyPath));
  const buf = Buffer.from("dedup-content-abc");
  const f1 = mailStorage.writePhysicalFile(buf, ".txt");
  const f2 = mailStorage.writePhysicalFile(buf, ".txt");
  check("hash SHA-256 ổn định", f1.hash === f2.hash);
  check("ghi lần 2 nhận diện đã tồn tại", f2.existed === true);
  let traversalBlocked = false;
  try { mailStorage.assertInsideRoot(path.join(root, "..", "..", "evil.txt")); } catch { traversalBlocked = true; }
  check("chặn path traversal", traversalBlocked);

  // 3. Parser
  console.log("[3] Parser");
  const parsed = await parseEmail(Buffer.from(RAW_EMAIL));
  check("đọc subject", parsed.subject === "Bao cao san xuat thang 9");
  check("đọc From address", parsed.from.address === "a@test.local");
  check("đọc Message-ID", parsed.messageId === "<ingest-test-1@test.local>");
  check("có 1 đính kèm", parsed.attachments.length === 1, `(=${parsed.attachments.length})`);
  check("đính kèm nội dung đúng", parsed.attachments[0]?.content?.includes(Buffer.from("noi-dung-dinh-kem")));
  check("flatten recipients = 2 (to+cc)", flattenRecipients(parsed).length === 2);

  // 4. POP3 client với server giả
  console.log("[4] POP3 client");
  const fake = await startFakePop3([{ uidl: "UIDL-1", raw: RAW_EMAIL }]);
  const client = new Pop3Client({ host: "127.0.0.1", port: fake.port, secure: false, username: "u", password: "p", timeoutMs: 5000 });
  await client.connect();
  await client.auth();
  const stat = await client.stat();
  check("STAT đếm đúng 1 email", stat.count === 1);
  const uidls = await client.uidl();
  check("UIDL trả UIDL-1", uidls.get(1) === "UIDL-1");
  const raw = await client.retr(1);
  check("RETR trả raw chứa header", raw.toString("utf8").includes("Message-ID: <ingest-test-1@test.local>"));
  check("RETR bỏ dot-stuffing/tách đúng block", !raw.toString("utf8").includes("\r\n.\r\n"));
  await client.quit();

  // 5. Full ingest vào DB
  console.log("[5] Ingest trọn pipeline (DB + NAS)");
  const ctrCd = "CMS";
  const accountId = await mailRepo.insertAccount({
    ctrCd,
    emplNo: "__MAIL_TEST__",
    emailAddress: `ingest-test-${Date.now()}@test.local`,
    pop3Host: "127.0.0.1",
    pop3Port: fake.port,
    pop3Secure: false,
    pop3Username: "u",
    pop3CredEnc: mailCrypto.encryptSecret("p"),
    isActive: true,
  });
  await mailRepo.ensureCheckpoint(accountId);

  const r1 = await syncMailbox(accountId, { log: () => undefined });
  check("sync lần 1 OK + connected", r1.ok && r1.connected, JSON.stringify(r1));
  check("import 1 email", r1.imported === 1, `(imported=${r1.imported})`);

  const rows = await mailRepo.queryRows(
    `SELECT ID, SUBJECT, FROM_ADDRESS, HAS_ATTACHMENT, ATTACHMENT_COUNT, PREVIEW_TEXT, BODY_INLINE, BODY_STORAGE_PATH
     FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ACC`,
    { ACC: accountId }
  );
  check("DB có đúng 1 message", rows.length === 1, `(=${rows.length})`);
  const messageId = rows[0]?.ID;
  check("subject lưu đúng", rows[0]?.SUBJECT === "Bao cao san xuat thang 9");
  check("đánh dấu có đính kèm", rows[0]?.HAS_ATTACHMENT === true || rows[0]?.HAS_ATTACHMENT === 1);

  const atts = await msgRepo.listAttachmentsByMessage(messageId);
  check("có 1 attachment READY", atts.length === 1 && atts[0].STATUS === "READY", JSON.stringify(atts.map((a) => a.STATUS)));
  check("attachment có file vật lý trên NAS", atts[0]?.STORAGE_PATH && fs.existsSync(atts[0].STORAGE_PATH));

  const counts = await msgRepo.countUnread({ accountIds: [accountId], emplNo: "__MAIL_TEST__" });
  check("unread count = 1", counts === 1, `(=${counts})`);

  // 6. Dedup: chạy lại không tạo trùng
  console.log("[6] Dedup (chạy lại)");
  const r2 = await syncMailbox(accountId, { log: () => undefined });
  check("sync lần 2 không import thêm", r2.imported === 0, `(imported=${r2.imported})`);
  const rows2 = await mailRepo.queryRows(`SELECT COUNT(*) AS C FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ACC`, { ACC: accountId });
  check("vẫn chỉ 1 message trong DB", Number(rows2[0].C) === 1, `(=${rows2[0].C})`);

  // 7. Reconcile sạch
  console.log("[7] Reconcile");
  const rec = await reconcile({ limit: 50 });
  check("reconcile chạy không lỗi", typeof rec.ms === "number");

  // 8. Idempotent DB check: sync log ghi lại
  const logs = await mailRepo.listSyncLogs({ accountId, limit: 10 });
  check("có >= 2 dòng sync log", logs.length >= 2, `(=${logs.length})`);

  // Cleanup
  console.log("\n[CLEANUP]");
  await cleanup(accountId);
  fake.server.close();
  try { const pool = await openConnection(); await pool.close(); } catch { /* bỏ qua */ }

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\n[test] lỗi:", error);
  process.exit(1);
});
