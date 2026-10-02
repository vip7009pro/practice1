/**
 * Test GỬI email (Phase 3) — dùng SMTP server GIẢ trong tiến trình.
 * Kiểm: emailSend qua HTTP → SMTP nhận → lưu bản sao vào thư mục "Đã gửi" (FOLDER='SENT').
 *
 * Chạy: node scratch/test_mail_send.js
 */
const http = require("http");
const net = require("net");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();

const mailCrypto = require("../services/mail/mailCrypto");
const mailRepo = require("../services/mail/mailRepository");
const { openConnection } = require("../config/database");

const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT || 3007);
const CTR = "002";
const EMPL = "__SEND_TEST__";

let pass = 0, fail = 0;
const check = (n, c, e = "") => { if (c) { pass++; console.log(`  ✔ ${n}`); } else { fail++; console.log(`  ✘ ${n} ${e}`); } };

function api(command, DATA, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ command, DATA: { ...(DATA || {}), token_string: token, secureContext: false } });
    const req = http.request({ host: HOST, port: PORT, path: "/api", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => { let raw = ""; res.on("data", (c) => (raw += c)); res.on("end", () => resolve(JSON.parse(raw))); });
    req.on("error", reject); req.write(body); req.end();
  });
}

/** SMTP server tối giản (không TLS, không xác thực thật). Ghi lại nội dung nhận được. */
function startFakeSmtp() {
  const received = [];
  const server = net.createServer((sock) => {
    sock.write("220 fake ESMTP\r\n");
    let buf = "";
    let inData = false;
    let lines = [];
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) !== -1) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            received.push(lines.join("\n"));
            lines = [];
            sock.write("250 OK queued\r\n");
          } else lines.push(line);
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO")) sock.write("250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 HELP\r\n");
        else if (cmd.startsWith("HELO")) sock.write("250 fake\r\n");
        else if (cmd.startsWith("AUTH")) sock.write("235 OK\r\n");
        else if (cmd.startsWith("MAIL FROM")) sock.write("250 OK\r\n");
        else if (cmd.startsWith("RCPT TO")) sock.write("250 OK\r\n");
        else if (cmd.startsWith("DATA")) { inData = true; sock.write("354 End data with <CR><LF>.<CR><LF>\r\n"); }
        else if (cmd.startsWith("QUIT")) { sock.write("221 Bye\r\n"); sock.end(); }
        else sock.write("250 OK\r\n");
      }
    });
    sock.on("error", () => undefined);
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, port: server.address().port, received })));
}

async function cleanup(accountId) {
  await mailRepo.queryRows(
    `DELETE a FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID=a.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID=@ACC;
     DELETE r FROM ZTB_MAIL_RECIPIENT r JOIN ZTB_MAIL_MESSAGE m ON m.ID=r.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID=@ACC;
     DELETE m FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID=@ACC;
     DELETE FROM ZTB_MAIL_DRAFT WHERE EMPL_NO=@EMPL;
     DELETE FROM ZTB_MAIL_SYNC_LOG WHERE MAIL_ACCOUNT_ID=@ACC;
     DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID=@ACC;`, { ACC: accountId, EMPL });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: accountId });
}

async function main() {
  console.log("\n=== TEST GỬI EMAIL (Phase 3) ===\n");
  const smtp = await startFakeSmtp();

  // Mailbox test: POP3 trỏ vào cổng chết (để worker lỗi nhanh), SMTP trỏ vào server giả.
  const accountId = await mailRepo.insertAccount({
    ctrCd: CTR,
    emplNo: EMPL,
    emailAddress: `sendtest-${Date.now()}@test.local`,
    displayName: "Send Test",
    pop3Host: "127.0.0.1",
    pop3Port: 1, // đóng ⇒ kết nối lỗi ngay
    pop3Secure: false,
    pop3Username: "u",
    pop3CredEnc: mailCrypto.encryptSecret("p"),
    smtpHost: "127.0.0.1",
    smtpPort: smtp.port,
    smtpSecure: false,
    smtpUsername: "u",
    isActive: true,
  });
  await mailRepo.ensureCheckpoint(accountId);

  const token = jwt.sign({ payload: JSON.stringify([{ EMPL_NO: EMPL, CTR_CD: CTR }]) }, "nguyenvanhung", { expiresIn: "1h" });

  console.log("[1] emailSend");
  const send = await api("emailSend", {
    TO: "nguoinhan@test.local, nguoinhan2@test.local",
    CC: "cc@test.local",
    SUBJECT: "Thử gửi từ ERP",
    BODY_HTML: "<p>Xin chào, đây là email <b>thử nghiệm</b>.</p>",
  }, token);
  check("tk_status OK", send.tk_status === "OK", JSON.stringify(send).slice(0, 250));
  check("server SMTP đã nhận 1 email", smtp.received.length === 1, `(=${smtp.received.length})`);
  const raw = smtp.received[0] || "";
  check("có người nhận", /nguoinhan@test\.local/.test(raw));
  check("có Cc", /cc@test\.local/.test(raw));
  // Tiêu đề trong raw bị MIME-encode ⇒ kiểm tra ở bản lưu trong DB.
  const sentAfterSend = await mailRepo.queryRows(
    `SELECT SUBJECT FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID=@ACC AND FOLDER='SENT'`, { ACC: accountId });
  check("tiêu đề lưu đúng", sentAfterSend[0]?.SUBJECT === "Thử gửi từ ERP", `(=${sentAfterSend[0]?.SUBJECT})`);

  console.log("[2] Lưu bản sao vào 'Đã gửi'");
  const sentRows = await mailRepo.queryRows(
    `SELECT ID, FOLDER, SUBJECT, FROM_ADDRESS FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID=@ACC AND FOLDER='SENT'`,
    { ACC: accountId }
  );
  check("DB có 1 email FOLDER=SENT", sentRows.length === 1, `(=${sentRows.length})`);
  check("đúng người gửi", sentRows[0]?.FROM_ADDRESS?.includes("sendtest-"), `(=${sentRows[0]?.FROM_ADDRESS})`);

  console.log("[3] emailReply (trả lời email gốc)");
  const originalId = sentRows[0]?.ID;
  const reply = await api("emailReply", { ID: originalId, BODY_HTML: "<p>Đã nhận, cảm ơn.</p>" }, token);
  check("tk_status OK", reply.tk_status === "OK", JSON.stringify(reply).slice(0, 220));
  check("SMTP nhận thêm 1 email", smtp.received.length === 2, `(=${smtp.received.length})`);
  const sentReply = await mailRepo.queryRows(
    `SELECT SUBJECT FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID=@ACC AND FOLDER='SENT' AND SUBJECT LIKE 'Re:%'`, { ACC: accountId });
  check("bản lưu có tiêu đề Re:", sentReply.length === 1, `(=${sentReply.length})`);

  console.log("[4] emailForward");
  const fwd = await api("emailForward", { ID: originalId, TO: "chuyentiep@test.local", BODY_HTML: "<p>Chuyển cho bạn.</p>" }, token);
  check("tk_status OK", fwd.tk_status === "OK", JSON.stringify(fwd).slice(0, 220));
  check("SMTP nhận thêm 1 email", smtp.received.length === 3, `(=${smtp.received.length})`);
  const sentFwd = await mailRepo.queryRows(
    `SELECT SUBJECT FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID=@ACC AND FOLDER='SENT' AND SUBJECT LIKE 'Fwd:%'`, { ACC: accountId });
  check("bản lưu có tiêu đề Fwd:", sentFwd.length === 1, `(=${sentFwd.length})`);

  console.log("[5] Bản nháp: lưu / đọc / xoá");
  const draft = await api("emailSaveDraft", { TO: "abc@test.local", SUBJECT: "Nháp thử", BODY_HTML: "<p>nội dung nháp</p>" }, token);
  check("lưu nháp OK", draft.tk_status === "OK" && !!draft.data?.id, JSON.stringify(draft).slice(0, 160));
  const draftId = draft.data?.id;
  const got = await api("emailDraftGet", { ID: draftId }, token);
  check("đọc lại nháp đúng", got.tk_status === "OK" && got.data?.subject === "Nháp thử", JSON.stringify(got).slice(0, 160));
  const del = await api("emailDeleteDraft", { ID: draftId }, token);
  check("xoá nháp OK", del.tk_status === "OK");

  console.log("[6] Gửi khi chưa cấu hình mailbox ⇒ báo lỗi rõ");
  const otherToken = jwt.sign({ payload: JSON.stringify([{ EMPL_NO: "__NO_MAIL__", CTR_CD: CTR }]) }, "nguyenvanhung", { expiresIn: "1h" });
  const noAcc = await api("emailSend", { TO: "x@test.local", SUBJECT: "x", BODY_HTML: "<p>x</p>" }, otherToken);
  check("trả NG + code NO_ACCOUNT", noAcc.tk_status === "NG" && noAcc.code === "NO_ACCOUNT", JSON.stringify(noAcc).slice(0, 160));

  console.log("[7] Chuyển tiếp GIỮ ẢNH INLINE (cid:) của thư gốc");
  // Tạo 1 thư gốc có ảnh nhúng (Content-ID) + body tham chiếu cid.
  const pngBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const phys = require("../services/mail/mailStorage").writePhysicalFile(pngBytes, ".png");
  const inlineOriginalId = await mailRepo.withTransaction(async (tx) => {
    const mid = await require("../services/mail/mailMessageRepository").insertMessage(tx, {
      mailAccountId: accountId,
      folder: "INBOX",
      messageId: `<inline-orig-${Date.now()}@test.local>`,
      fromAddress: "nguoigui@test.local",
      fromName: "Người gửi",
      subject: "Thư có ảnh nhúng",
      bodyInline: '<p>Xem ảnh bên dưới:</p><p><img src="cid:img-1" alt="anh"/></p>',
      sentAt: new Date(),
      receivedAt: new Date(),
      previewText: "Xem ảnh bên dưới",
    });
    const pid = await require("../services/mail/mailMessageRepository").ensurePhysicalFileTx(tx, {
      hash: phys.hash,
      storagePath: phys.storagePath,
      size: phys.size,
    });
    await require("../services/mail/mailMessageRepository").insertAttachment(tx, {
      messageId: mid,
      fileName: "anh-nhung.png",
      contentType: "image/png",
      fileSize: phys.size,
      contentId: "img-1",
      isInline: true,
      fileHash: phys.hash,
      physicalFileId: pid,
      status: "READY",
    });
    return mid;
  });

  const beforeCount = smtp.received.length;
  const fwd2 = await api("emailForward", { ID: inlineOriginalId, TO: "nguoinhan3@test.local", BODY_HTML: "<p>Chuyển ảnh.</p>" }, token);
  check("chuyển tiếp OK", fwd2.tk_status === "OK", JSON.stringify(fwd2).slice(0, 200));
  const fwdRaw = smtp.received[beforeCount] || "";
  check("raw SMTP có Content-ID của ảnh gốc", /Content-ID:\s*<img-1>/i.test(fwdRaw), fwdRaw.slice(0, 120));
  check("phần trích dẫn còn tham chiếu cid:img-1", /cid:img-1/i.test(fwdRaw) || /Xem ảnh bên dưới/i.test(fwdRaw));
  const sentInline = await mailRepo.queryRows(
    `SELECT a.CONTENT_ID, a.IS_INLINE FROM ZTB_MAIL_ATTACHMENT a
     JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID
     WHERE m.MAIL_ACCOUNT_ID = @ACC AND m.FOLDER = 'SENT' AND a.CONTENT_ID = 'img-1'`,
    { ACC: accountId }
  );
  check("bản lưu 'Đã gửi' có ảnh inline (để xem lại được)", sentInline.length >= 1, `(=${sentInline.length})`);

  console.log("[8] Chuyển tiếp ảnh dạng data: ⇒ chuyển thành đính kèm cid:");
  const dataImgOriginalId = await mailRepo.withTransaction(async (tx) => {
    const mid = await require("../services/mail/mailMessageRepository").insertMessage(tx, {
      mailAccountId: accountId,
      folder: "INBOX",
      messageId: `<dataimg-${Date.now()}@test.local>`,
      fromAddress: "sender2@test.local",
      subject: "Thư có ảnh data URI",
      bodyInline: '<p>Anh:</p><p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="/></p>',
      sentAt: new Date(),
      receivedAt: new Date(),
      previewText: "Anh data uri",
    });
    return mid;
  });
  const beforeCount2 = smtp.received.length;
  const fwd3 = await api("emailForward", { ID: dataImgOriginalId, TO: "nguoinhan4@test.local", BODY_HTML: "<p>Chuyển tiếp.</p>" }, token);
  check("chuyển tiếp OK", fwd3.tk_status === "OK", JSON.stringify(fwd3).slice(0, 200));
  const fwd3Raw = smtp.received[beforeCount2] || "";
  check("KHÔNG còn data:image trong mail gửi đi", !/data:image\//i.test(fwd3Raw), "vẫn còn data: URI");
  check("ảnh được gửi dạng Content-ID (cid)", /Content-ID:\s*<erp-img-/i.test(fwd3Raw), fwd3Raw.slice(0, 120));
  check("HTML tham chiếu cid:erp-img-", /cid:erp-img-/i.test(fwd3Raw));

  console.log("\n[9] Gửi thư CHỈ có ảnh dán trong nội dung (không có chữ):");
  const before9 = smtp.received.length;
  const onlyImg = await api(
    "emailSend",
    {
      TO: "nguoinhan5@test.local",
      SUBJECT: "Chỉ có ảnh",
      BODY_HTML:
        '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="></p>',
    },
    token
  );
  check("gửi OK (không cần chữ)", onlyImg.tk_status === "OK", JSON.stringify(onlyImg).slice(0, 200));
  check("báo đã nhúng 1 ảnh", onlyImg.data?.inlineImagesEmbedded === 1, JSON.stringify(onlyImg.data).slice(0, 160));
  check("không có ảnh nào bị bỏ", !onlyImg.data?.inlineImagesSkipped, String(onlyImg.data?.inlineImagesSkipped));
  const raw9 = smtp.received[before9] || "";
  check("mail gửi đi có ảnh nhúng Content-ID", /Content-ID:\s*<erp-img-/i.test(raw9), raw9.slice(0, 120));
  check("mail gửi đi KHÔNG còn data:image", !/data:image\//i.test(raw9));
  check("HTML tham chiếu cid:erp-img-", /cid:erp-img-/i.test(raw9));

  console.log("\n[CLEANUP]");
  await cleanup(accountId);
  smtp.server.close();
  try { (await openConnection()).close(); } catch { /* bỏ qua */ }

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("[test] lỗi:", e); process.exit(1); });
