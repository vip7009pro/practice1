/**
 * Kiểm tra nhanh: body HTML đã lưu có tham chiếu ảnh `cid:` hay không.
 * Chạy: node scratch/inspect_body_cid.js <MESSAGE_ID>
 */
const fs = require("fs");
const mailRepo = require("../services/mail/mailRepository");

const ID = Number(process.argv[2]) || 30446;

(async () => {
  const m = await mailRepo.queryOne(
    `SELECT ID, SUBJECT, BODY_INLINE, BODY_STORAGE_PATH, LEN(BODY_INLINE) AS INLINE_LEN
     FROM ZTB_MAIL_MESSAGE WHERE ID = @ID`,
    { ID }
  );
  console.log("Message:", { ID: m.ID, subject: m.SUBJECT, storage: m.BODY_STORAGE_PATH, inlineLen: m.INLINE_LEN });

  let html = m.BODY_INLINE || "";
  if (!html && m.BODY_STORAGE_PATH) {
    try {
      html = fs.readFileSync(m.BODY_STORAGE_PATH, "utf8");
      console.log(`Đọc body từ NAS: ${html.length} ký tự`);
    } catch (error) {
      console.log(`KHÔNG đọc được body NAS: ${error.message}`);
    }
  } else {
    console.log(`Body inline: ${html.length} ký tự`);
  }

  const cidRefs = [...html.matchAll(/cid:[^\s"'<>]+/gi)].map((x) => x[0]);
  console.log("Số tham chiếu cid trong body:", cidRefs.length);
  console.log("10 tham chiếu đầu:", JSON.stringify([...new Set(cidRefs)].slice(0, 10)));

  const imgSrcs = [...html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((x) => x[1]);
  console.log("Số thẻ <img>:", imgSrcs.length);
  console.log("10 src đầu:", JSON.stringify([...new Set(imgSrcs)].slice(0, 10)));

  const atts = await mailRepo.queryRows(
    `SELECT ID, FILE_NAME, CONTENT_ID, IS_INLINE FROM ZTB_MAIL_ATTACHMENT WHERE MESSAGE_ID = @ID`,
    { ID }
  );
  console.log(`\nĐính kèm (${atts.length}):`);
  for (const a of atts.slice(0, 5)) {
    const cid = String(a.CONTENT_ID || "");
    console.log(
      `  #${a.ID} ${a.FILE_NAME} cid=${cid} inline=${a.IS_INLINE} → body có 'cid:${cid}'? ${html.toLowerCase().includes(`cid:${cid.toLowerCase()}`)}`
    );
  }
  console.log("\n120 ký tự đầu body:", JSON.stringify(html.slice(0, 120)));
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
