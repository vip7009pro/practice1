/**
 * Test CHỐNG ĐỒNG BỘ TRÙNG LẶP + TRẠNG THÁI ĐỒNG BỘ.
 *
 * Kịch bản:
 *  - Mailbox giả có 2 email: 1 có Message-ID, 1 KHÔNG có Message-ID.
 *  - Sync 3 lần liên tiếp  ⇒ DB vẫn đúng 2 email (không nhân bản).
 *  - Server lại phục vụ email #1 với UIDL KHÁC (Message-ID trùng) ⇒ vẫn 2.
 *  - Email không Message-ID đổi UIDL ⇒ dedup bằng hash nội dung, vẫn 2.
 *  - Thêm email thứ 3 ⇒ sync tiếp ⇒ 3 email, trạng thái serverTotal=3/imported=3/pending=0.
 *
 * Chạy: node scratch/test_mail_dedup.js
 */
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const crypto = require("crypto");

const TEST_STORE = path.join(os.tmpdir(), `erp-mail-dedup-${Date.now()}`);
process.env.MAIL_CRED_KEY = crypto.randomBytes(32).toString("hex");
process.env.MAIL_STORAGE_PATH = TEST_STORE;
process.env.MAIL_WORKER_ENABLED = "false";

const mailCrypto = require("../services/mail/mailCrypto");
const mailRepo = require("../services/mail/mailRepository");
const msgRepo = require("../services/mail/mailMessageRepository");
const { syncMailbox } = require("../services/mail/mailIngest");
const { openConnection } = require("../config/database");

let pass = 0, fail = 0;
const check = (n, c, e = "") => { if (c) { pass++; console.log(`  ✔ ${n}`); } else { fail++; console.log(`  ✘ ${n} ${e}`); } };

function startFakePop3(getMessages) {
  const server = net.createServer((socket) => {
    let buf = "";
    socket.write("+OK ready\r\n");
    socket.on("data", (d) => {
      buf += d.toString("latin1");
      let i;
      while ((i = buf.indexOf("\r\n")) !== -1) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        handle(line);
      }
    });
    socket.on("error", () => undefined);
    function handle(line) {
      const [cmdRaw, arg] = line.split(" ");
      const cmd = (cmdRaw || "").toUpperCase();
      const msgs = getMessages();
      if (cmd === "USER") socket.write("+OK\r\n");
      else if (cmd === "PASS") socket.write("+OK\r\n");
      else if (cmd === "STAT") socket.write(`+OK ${msgs.length} ${msgs.reduce((s, m) => s + m.raw.length, 0)}\r\n`);
      else if (cmd === "UIDL") { socket.write("+OK\r\n"); msgs.forEach((m, i) => socket.write(`${i + 1} ${m.uidl}\r\n`)); socket.write(".\r\n"); }
      else if (cmd === "LIST") { socket.write("+OK\r\n"); msgs.forEach((m, i) => socket.write(`${i + 1} ${m.raw.length}\r\n`)); socket.write(".\r\n"); }
      else if (cmd === "RETR") { const m = msgs[Number(arg) - 1]; socket.write("+OK\r\n"); socket.write(m.raw); socket.write("\r\n.\r\n"); }
      else if (cmd === "QUIT") { socket.write("+OK\r\n"); socket.end(); }
      else socket.write("-ERR unknown\r\n");
    }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, port: server.address().port })));
}

const mkEmail = (mid, subject) =>
  `From: "Sender ${subject}" <s@test.local>\r\n` +
  `To: someone@test.local\r\n` +
  `Subject: ${subject}\r\n` +
  (mid ? `Message-ID: ${mid}\r\n` : "") +
  `Date: Mon, 01 Sep 2025 10:00:00 +0700\r\n` +
  `Content-Type: text/plain; charset="utf-8"\r\n\r\n` +
  `Noi dung ${subject}\r\n`;

async function countMessages(accountId) {
  const rows = await mailRepo.queryRows(
    `SELECT COUNT(*) AS C FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ACC`, { ACC: accountId }
  );
  return Number(rows[0].C);
}

async function cleanup(accountId) {
  await mailRepo.queryRows(
    `DELETE a FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID=a.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID=@ACC;
     DELETE r FROM ZTB_MAIL_RECIPIENT r JOIN ZTB_MAIL_MESSAGE m ON m.ID=r.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID=@ACC;
     DELETE m FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID=@ACC;
     DELETE t FROM ZTB_MAIL_THREAD t WHERE t.ID NOT IN (SELECT THREAD_ID FROM ZTB_MAIL_MESSAGE WHERE THREAD_ID IS NOT NULL);
     DELETE FROM ZTB_MAIL_SYNC_LOG WHERE MAIL_ACCOUNT_ID=@ACC;
     DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID=@ACC;`, { ACC: accountId }
  );
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: accountId });
  try { fs.rmSync(TEST_STORE, { recursive: true, force: true }); } catch { /* bỏ qua */ }
}

async function main() {
  console.log("\n=== TEST CHỐNG TRÙNG LẶP ĐỒNG BỘ ===\n");

  // Trạng thái "server" (thay đổi được để mô phỏng UIDL đổi / thêm mail)
  let serverMsgs = [
    { uidl: "U-1", raw: mkEmail("<dup-1@test.local>", "Co Message-ID") },
    { uidl: "U-2", raw: mkEmail(null, "Khong Message-ID") },
  ];
  const fake = await startFakePop3(() => serverMsgs);

  const accountId = await mailRepo.insertAccount({
    ctrCd: "CMS", emplNo: "__DEDUP_TEST__",
    emailAddress: `dedup-${Date.now()}@test.local`,
    pop3Host: "127.0.0.1", pop3Port: fake.port, pop3Secure: false,
    pop3Username: "u", pop3CredEnc: mailCrypto.encryptSecret("p"), isActive: true,
  });
  await mailRepo.ensureCheckpoint(accountId);

  console.log("[1] Sync lần 1 → 2 email");
  let r = await syncMailbox(accountId, { log: () => undefined });
  check("import 2 email", r.imported === 2, `(=${r.imported})`);
  check("DB có 2 email", (await countMessages(accountId)) === 2);

  console.log("[2] Sync lần 2, 3 (không đổi gì)");
  await syncMailbox(accountId, { log: () => undefined });
  await syncMailbox(accountId, { log: () => undefined });
  check("DB VẪN 2 email (không nhân bản)", (await countMessages(accountId)) === 2, `(=${await countMessages(accountId)})`);

  console.log("[3] Server đổi UIDL nhưng cùng Message-ID/nội dung");
  serverMsgs = [
    { uidl: "U-1-NEW", raw: mkEmail("<dup-1@test.local>", "Co Message-ID") },
    { uidl: "U-2-NEW", raw: mkEmail(null, "Khong Message-ID") },
  ];
  r = await syncMailbox(accountId, { log: () => undefined });
  check("không import thêm (Message-ID trùng)", r.imported === 0, `(=${r.imported})`);
  check("DB vẫn 2 email (UIDL mới nhưng dedup theo Message-ID/hash)", (await countMessages(accountId)) === 2, `(=${await countMessages(accountId)})`);

  console.log("[4] Thêm email mới #3");
  serverMsgs = [
    ...serverMsgs,
    { uidl: "U-3", raw: mkEmail("<dup-3@test.local>", "Email moi") },
  ];
  r = await syncMailbox(accountId, { log: () => undefined });
  check("import đúng 1 email mới", r.imported === 1, `(=${r.imported})`);
  check("DB = 3 email", (await countMessages(accountId)) === 3, `(=${await countMessages(accountId)})`);

  console.log("[5] Trạng thái đồng bộ");
  const status = await mailRepo.listSyncStatus({ ctrCd: "CMS", emplNo: "__DEDUP_TEST__" });
  const row = status.find((s) => s.ACCOUNT_ID === accountId);
  check("có dòng trạng thái", !!row);
  check("SERVER_TOTAL = 3", Number(row?.SERVER_TOTAL) === 3, `(=${row?.SERVER_TOTAL})`);
  check("IMPORTED = 3", Number(row?.IMPORTED) === 3, `(=${row?.IMPORTED})`);
  check("IN_PROGRESS = 0", !(row?.IN_PROGRESS === true || row?.IN_PROGRESS === 1));

  console.log("\n[CLEANUP]");
  await cleanup(accountId);
  fake.server.close();
  try { (await openConnection()).close(); } catch { /* bỏ qua */ }

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("[test] lỗi:", e); process.exit(1); });
