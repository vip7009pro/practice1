/**
 * Test PHÂN LOẠI ĐÍNH KÈM vs ẢNH TRONG NỘI DUNG (`IS_INLINE`).
 *
 * BUG ĐÃ SỬA (2026-10-02)
 * -----------------------
 * Bản cũ suy ra `isInline = !!Content-ID`. Gmail gắn Content-ID cho **cả tệp đính kèm thật**
 * (`<f_muqgaxoz1>` cho `companylogo.png`, `f_…` cho PDF) ⇒ file bị coi là ảnh trong nội dung
 * ⇒ FE ẩn khỏi danh sách đính kèm ⇒ người dùng tưởng email mất đính kèm (Outlook vẫn thấy).
 *
 * Test gồm 2 phần:
 *   A. Unit: `parseEmail()` phân loại đúng theo `Content-Disposition`.
 *   B. E2E: dựng POP3 server GIẢ + chạy `syncMailbox()` ⇒ kiểm tra dòng `ZTB_MAIL_ATTACHMENT`.
 *
 * Chạy: node scratch/test_mail_attach_classify.js
 */
const fs = require("fs");
const os = require("os");
const net = require("net");
const path = require("path");
const crypto = require("crypto");

const TEST_STORE = path.join(os.tmpdir(), `erp-mail-attach-${Date.now()}`);
process.env.MAIL_CRED_KEY = crypto.randomBytes(32).toString("hex");
process.env.MAIL_STORAGE_PATH = TEST_STORE;
process.env.MAIL_WORKER_ENABLED = "false";

const mailCrypto = require("../services/mail/mailCrypto");
const mailRepo = require("../services/mail/mailRepository");
const { parseEmail, classifyInlinePart } = require("../services/mail/mailParserService");
const { Pop3Client } = require("../services/mail/mailPop3Client");
const { syncMailbox } = require("../services/mail/mailIngest");

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

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

/** Email kiểu GMAIL: text + ảnh dán trong nội dung (cid ii_) + TỆP ĐÍNH KÈM cũng có Content-ID (cid f_). */
const GMAIL_RAW =
  'From: "Page Hung" <pagehungnguyen@gmail.com>\r\n' +
  "To: nvh1903@cmsbando.com\r\n" +
  "Subject: test gui cho mail bando\r\n" +
  "Message-ID: <gmail-attach-case@mail.gmail.com>\r\n" +
  "Date: Fri, 02 Oct 2026 11:16:27 +0700\r\n" +
  "MIME-Version: 1.0\r\n" +
  'Content-Type: multipart/mixed; boundary="MIX-BOUND"\r\n' +
  "\r\n" +
  "--MIX-BOUND\r\n" +
  'Content-Type: multipart/related; boundary="REL-BOUND"\r\n' +
  "\r\n" +
  "--REL-BOUND\r\n" +
  'Content-Type: multipart/alternative; boundary="ALT-BOUND"\r\n' +
  "\r\n" +
  "--ALT-BOUND\r\n" +
  "Content-Type: text/plain; charset=\"utf-8\"\r\n" +
  "\r\n" +
  "noi dung thu\r\n" +
  "--ALT-BOUND\r\n" +
  'Content-Type: text/html; charset="utf-8"\r\n' +
  "\r\n" +
  '<html><body><p>noi dung thu</p><img src="cid:ii_muqgamzs0"></body></html>\r\n' +
  "--ALT-BOUND--\r\n" +
  "--REL-BOUND\r\n" +
  'Content-Type: image/png; name="image.png"\r\n' +
  'Content-Disposition: inline; filename="image.png"\r\n' +
  "Content-Transfer-Encoding: base64\r\n" +
  "Content-ID: <ii_muqgamzs0>\r\n" +
  "\r\n" +
  `${PNG_BASE64}\r\n` +
  "--REL-BOUND--\r\n" +
  "--MIX-BOUND\r\n" +
  'Content-Type: image/png; name="companylogo.png"\r\n' +
  'Content-Disposition: attachment; filename="companylogo.png"\r\n' +
  "Content-Transfer-Encoding: base64\r\n" +
  "Content-ID: <f_muqgaxoz1>\r\n" +
  "\r\n" +
  `${PNG_BASE64}\r\n` +
  "--MIX-BOUND--\r\n";

/** Email kiểu GMAIL đính kèm PDF (cũng bị gắn Content-ID). */
const GMAIL_PDF_RAW =
  'From: "Hung CMS" <hungcmsvn@gmail.com>\r\n' +
  "To: nvh1903@cmsbando.com\r\n" +
  "Subject: CMS VINA_SUNGIL PO20261002-01\r\n" +
  "Message-ID: <gmail-pdf-case@mail.gmail.com>\r\n" +
  "Date: Fri, 02 Oct 2026 11:14:16 +0700\r\n" +
  "MIME-Version: 1.0\r\n" +
  'Content-Type: multipart/mixed; boundary="MIX-PDF"\r\n' +
  "\r\n" +
  "--MIX-PDF\r\n" +
  'Content-Type: text/html; charset="utf-8"\r\n' +
  "\r\n" +
  "<html><body>Gui PO</body></html>\r\n" +
  "--MIX-PDF\r\n" +
  'Content-Type: application/pdf; name="PO.pdf"\r\n' +
  'Content-Disposition: attachment; filename="PO.pdf"\r\n' +
  "Content-Transfer-Encoding: base64\r\n" +
  "Content-ID: <f_muqg5civ0>\r\n" +
  "\r\n" +
  "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+\n" +
  "--MIX-PDF--\r\n";

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
  console.log("\n=== TEST PHÂN LOẠI ĐÍNH KÈM vs ẢNH NỘI DUNG ===\n");

  console.log("[A1] Quy tắc thuần (`classifyInlinePart`)");
  check(
    "disposition=attachment + có CID ⇒ TỆP ĐÍNH KÈM",
    classifyInlinePart({ contentType: "image/png", contentId: "<f_x>", contentDisposition: "attachment" }).isInline === false
  );
  check(
    "disposition=inline + CID ⇒ ảnh trong nội dung",
    classifyInlinePart({ contentType: "image/png", contentId: "<ii_x>", contentDisposition: "inline" }).isInline === true
  );
  check(
    "không disposition + CID + ảnh ⇒ ảnh trong nội dung",
    classifyInlinePart({ contentType: "image/jpeg", contentId: "<a>" }).isInline === true
  );
  check(
    "không disposition + CID + KHÔNG phải ảnh ⇒ tệp đính kèm",
    classifyInlinePart({ contentType: "application/pdf", contentId: "<a>" }).isInline === false
  );
  check(
    "disposition=inline nhưng KHÔNG có CID ⇒ tệp đính kèm",
    classifyInlinePart({ contentType: "image/png", contentDisposition: "inline" }).isInline === false
  );

  console.log("[A2] Parse email Gmail (text + ảnh dán + tệp đính kèm có Content-ID)");
  const gmail = await parseEmail(Buffer.from(GMAIL_RAW, "binary"));
  check("có 2 phần nội dung/đính kèm", gmail.attachments.length === 2, `(=${gmail.attachments.length})`);
  const inlineImg = gmail.attachments.find((a) => a.fileName === "image.png");
  const fileAtt = gmail.attachments.find((a) => a.fileName === "companylogo.png");
  check("ảnh dán trong nội dung ⇒ isInline=true", inlineImg?.isInline === true, JSON.stringify(inlineImg && { i: inlineImg.isInline, c: inlineImg.contentId }));
  check("TỆP ĐÍNH KÈM có Content-ID ⇒ isInline= FALSE", fileAtt?.isInline === false, JSON.stringify(fileAtt && { i: fileAtt.isInline, c: fileAtt.contentId }));
  check("giữ nguyên Content-ID của tệp đính kèm (để tra cứu)", fileAtt?.contentId === "f_muqgaxoz1", `(${fileAtt?.contentId})`);
  check("attachmentCount = 1 (chỉ tệp đính kèm thật)", gmail.attachmentCount === 1, `(=${gmail.attachmentCount})`);
  check("inlineCount = 1", gmail.inlineCount === 1, `(=${gmail.inlineCount})`);

  console.log("[A3] Parse email Gmail đính kèm PDF (có Content-ID)");
  const pdf = await parseEmail(Buffer.from(GMAIL_PDF_RAW, "binary"));
  check("PDF ⇒ isInline=false", pdf.attachments[0]?.isInline === false, JSON.stringify(pdf.attachments.map((a) => ({ f: a.fileName, i: a.isInline }))));
  check("attachmentCount = 1", pdf.attachmentCount === 1, `(=${pdf.attachmentCount})`);

  console.log("[B] E2E qua POP3 giả + syncMailbox (kiểm tra DB)");
  const fake = await startFakePop3([
    { uidl: "UIDL-GMAIL-IMG", raw: GMAIL_RAW },
    { uidl: "UIDL-GMAIL-PDF", raw: GMAIL_PDF_RAW },
  ]);
  const ctrCd = "CMS";
  const accountId = await mailRepo.insertAccount({
    ctrCd,
    emplNo: "__MAIL_TEST__",
    emailAddress: `attach-test-${Date.now()}@test.local`,
    pop3Host: "127.0.0.1",
    pop3Port: fake.port,
    pop3Secure: false,
    pop3Username: "u",
    pop3CredEnc: mailCrypto.encryptSecret("p"),
    isActive: true,
  });
  await mailRepo.ensureCheckpoint(accountId);

  try {
    const result = await syncMailbox(accountId, { log: () => undefined });
    check("sync OK, import 2 email", result.ok && result.imported === 2, JSON.stringify(result));
    check("attachCount = 2 (chỉ tệp đính kèm thật)", result.attachCount === 2, `(=${result.attachCount})`);

    const rows = await mailRepo.queryRows(
      `SELECT a.FILE_NAME, a.IS_INLINE, a.CONTENT_ID, a.CONTENT_TYPE, m.HAS_ATTACHMENT, m.ATTACHMENT_COUNT
       FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID
       WHERE m.MAIL_ACCOUNT_ID = @ACC ORDER BY a.FILE_NAME`,
      { ACC: accountId }
    );
    const companyLogo = rows.find((r) => r.FILE_NAME === "companylogo.png");
    const inlineImage = rows.find((r) => r.FILE_NAME === "image.png");
    const pdfRow = rows.find((r) => r.FILE_NAME === "PO.pdf");
    check("DB: companylogo.png có IS_INLINE=0 (HIỆN trong danh sách đính kèm)", companyLogo && companyLogo.IS_INLINE === false, JSON.stringify(companyLogo));
    check("DB: image.png (dán trong nội dung) vẫn IS_INLINE=1", inlineImage && inlineImage.IS_INLINE === true, JSON.stringify(inlineImage));
    check("DB: PO.pdf có IS_INLINE=0", pdfRow && pdfRow.IS_INLINE === false, JSON.stringify(pdfRow));
    check("DB: email ảnh có ATTACHMENT_COUNT=1", companyLogo && Number(companyLogo.ATTACHMENT_COUNT) === 1, `(=${companyLogo?.ATTACHMENT_COUNT})`);
    check("DB: email ảnh HAS_ATTACHMENT=1", companyLogo && (companyLogo.HAS_ATTACHMENT === true || companyLogo.HAS_ATTACHMENT === 1));

    const files = rows.filter((r) => r.IS_INLINE === false).map((r) => r.FILE_NAME).sort();
    check("Danh sách tệp đính kèm THẬT = [PO.pdf, companylogo.png]", JSON.stringify(files) === JSON.stringify(["PO.pdf", "companylogo.png"]), JSON.stringify(files));
  } finally {
    await cleanup(accountId);
    fake.server.close();
  }

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Lỗi test:", error);
  process.exit(1);
});
