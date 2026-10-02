/**
 * Thống kê đính kèm đang bị đánh dấu inline — phân loại để quyết định cách sửa.
 * Chạy: node scratch/inspect_inline_breakdown.js
 */
const mailRepo = require("../services/mail/mailRepository");

(async () => {
  const rows = await mailRepo.queryRows(
    `SELECT
        SUM(CASE WHEN IS_INLINE = 1 THEN 1 ELSE 0 END) AS INLINE_TOTAL,
        SUM(CASE WHEN IS_INLINE = 1 AND CONTENT_TYPE NOT LIKE 'image/%' THEN 1 ELSE 0 END) AS INLINE_KHONG_PHAI_ANH,
        SUM(CASE WHEN IS_INLINE = 1 AND CONTENT_TYPE LIKE 'image/%'
                  AND FILE_NAME NOT LIKE 'image[0-9]%' THEN 1 ELSE 0 END) AS INLINE_ANH_TEN_LA,
        SUM(CASE WHEN IS_INLINE = 1 AND CONTENT_TYPE LIKE 'image/%'
                  AND FILE_NAME LIKE 'image[0-9]%' THEN 1 ELSE 0 END) AS INLINE_ANH_TEN_CHUAN
     FROM ZTB_MAIL_ATTACHMENT`
  );
  console.log("Tổng quan:", JSON.stringify(rows[0], null, 2));

  const detail = await mailRepo.queryRows(
    `SELECT TOP 30 a.ID, a.MESSAGE_ID, a.FILE_NAME, a.CONTENT_TYPE, a.CONTENT_ID, m.SUBJECT, m.RECEIVED_AT
     FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID
     WHERE a.IS_INLINE = 1 AND a.CONTENT_TYPE NOT LIKE 'image/%'
     ORDER BY a.ID DESC`
  );
  console.log(`\n--- Inline nhưng KHÔNG phải ảnh (${detail.length} dòng đầu) ---`);
  for (const a of detail) {
    console.log(`  #${a.ID} msg#${a.MESSAGE_ID} ${a.FILE_NAME} | ${a.CONTENT_TYPE} | cid=${a.CONTENT_ID} | ${String(a.SUBJECT || "").slice(0, 45)}`);
  }

  const names = await mailRepo.queryRows(
    `SELECT TOP 30 a.ID, a.MESSAGE_ID, a.FILE_NAME, a.CONTENT_TYPE, a.CONTENT_ID, m.SUBJECT
     FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID
     WHERE a.IS_INLINE = 1 AND a.CONTENT_TYPE LIKE 'image/%' AND a.FILE_NAME NOT LIKE 'image[0-9]%'
     ORDER BY a.ID DESC`
  );
  console.log(`\n--- Inline ảnh có tên KHÁC kiểu imageNNN (${names.length} dòng đầu) ---`);
  for (const a of names) {
    console.log(`  #${a.ID} msg#${a.MESSAGE_ID} ${a.FILE_NAME} | ${a.CONTENT_TYPE} | cid=${a.CONTENT_ID} | ${String(a.SUBJECT || "").slice(0, 45)}`);
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
