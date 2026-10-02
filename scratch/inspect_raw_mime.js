/**
 * CHẨN ĐOÁN (chỉ ĐỌC): tải lại 1 email từ POP3 server và phân tích cấu trúc MIME thật.
 *
 * Dùng khi nghi ngờ phần đính kèm bị mất/bị coi là inline.
 * Chạy: node scratch/inspect_raw_mime.js <MESSAGE_ID>
 *   MESSAGE_ID = ID trong ZTB_MAIL_MESSAGE (không phải POP3 msg number).
 *
 * ⚠️ KHÔNG ghi gì vào DB. Chỉ đọc credential đã mã hoá để đăng nhập POP3.
 */
const fs = require("fs");
const path = require("path");
const mailRepo = require("../services/mail/mailRepository");
const { Pop3Client } = require("../services/mail/mailPop3Client");
const { resolvePop3Credential } = require("../services/mail/mailIngest");
const { simpleParser } = require("mailparser");

const MESSAGE_ID = Number(process.argv[2]);
if (!Number.isInteger(MESSAGE_ID) || MESSAGE_ID <= 0) {
  console.error("Thiếu MESSAGE_ID. Ví dụ: node scratch/inspect_raw_mime.js 30654");
  process.exit(1);
}

(async () => {
  const msg = await mailRepo.queryOne(
    `SELECT ID, MAIL_ACCOUNT_ID, UIDL, MESSAGE_ID AS MIME_MESSAGE_ID, SUBJECT, SIZE_BYTES, ATTACHMENT_COUNT
     FROM ZTB_MAIL_MESSAGE WHERE ID = @ID`,
    { ID: MESSAGE_ID }
  );
  if (!msg) {
    console.error(`Không tìm thấy message #${MESSAGE_ID}`);
    process.exit(1);
  }
  console.log("Message trong DB:", JSON.stringify(msg));

  const account = await mailRepo.getAccountWithCredentials(msg.MAIL_ACCOUNT_ID);
  const cred = resolvePop3Credential(account);
  console.log(`POP3: ${cred.host}:${cred.port} secure=${cred.secure} user=${cred.username}`);

  const client = new Pop3Client({ ...cred, timeoutMs: 60000, rejectUnauthorized: false, log: () => undefined });
  await client.connect();
  await client.auth();
  console.log("Đăng nhập POP3 OK");

  const uidlMap = await client.uidl();
  let targetNo = null;
  for (const [no, uidl] of uidlMap.entries()) {
    if (uidl === msg.UIDL) { targetNo = no; break; }
  }
  if (!targetNo) {
    console.error("⚠️ Không tìm thấy UIDL này trên server (email đã bị xoá khỏi server?)");
    await client.quit().catch(() => undefined);
    process.exit(2);
  }
  const sizeMap = await client.list().catch(() => new Map());
  console.log(`Tìm thấy msgNo=${targetNo}, size theo LIST = ${sizeMap.get(targetNo)} byte`);

  // Tải với giới hạn lớn (nhưng KHÔNG vượt MAIL_MAX_EMAIL_BYTES đang cấu hình - in ra để so sánh).
  console.log(`MAIL_MAX_EMAIL_BYTES = ${process.env.MAIL_MAX_EMAIL_BYTES || "(mặc định 50MB)"}`);
  const raw = await client.retr(targetNo, { maxBytes: 100 * 1024 * 1024 });
  await client.quit().catch(() => undefined);
  console.log(`Đã tải raw = ${raw.length} byte`);

  const outPath = path.join(__dirname, `_raw_${MESSAGE_ID}.eml`);
  fs.writeFileSync(outPath, raw);
  console.log(`Đã lưu raw: ${outPath}`);

  const parsed = await simpleParser(raw);
  console.log(`\n--- simpleParser: ${parsed.attachments.length} attachment(s) ---`);
  parsed.attachments.forEach((att, index) => {
    console.log(
      `  [${index}] file="${att.filename}" type=${att.contentType} size=${att.size}` +
        ` disposition=${att.contentDisposition} cid=${att.contentId || "-"}`
    );
  });

  // Liệt kê các phần MIME theo header thô (không phụ thuộc mailparser).
  const text = raw.toString("binary");
  const headerEnd = text.indexOf("\r\n\r\n");
  console.log("\n--- Header gốc (200 ký tự đầu) ---");
  console.log(text.slice(0, headerEnd > 0 ? Math.min(headerEnd, 200) : 200).replace(/\r\n/g, " | "));
  const cte = [...text.matchAll(/Content-Type:\s*([^\r\n;]+)/gi)].map((m) => m[1].trim());
  const cds = [...text.matchAll(/Content-Disposition:\s*([^\r\n;]+)/gi)].map((m) => m[1].trim());
  const names = [...text.matchAll(/name\*?=\s*"?([^"\r\n;]+)"?/gi)].map((m) => m[1].trim());
  console.log("Content-Type các phần :", JSON.stringify(cte));
  console.log("Content-Disposition    :", JSON.stringify(cds));
  console.log("Tên file (name=/name*=) :", JSON.stringify(names.slice(0, 20)));
  const cids = [...text.matchAll(/Content-ID:\s*<?([^>\r\n]+)>?/gi)].map((m) => m[1].trim());
  console.log("Content-ID             :", JSON.stringify(cids.slice(0, 20)));

  console.log("\n--- Kiểm tra truncation ---");
  console.log(`Kết thúc raw bằng 60 ký tự cuối: ${JSON.stringify(text.slice(-60))}`);
  console.log(`Có kết thúc bằng "--" (đóng MIME) hay không: ${/--\s*$/.test(text)}`);
  process.exit(0);
})().catch((error) => {
  console.error("Lỗi:", error);
  process.exit(1);
});
