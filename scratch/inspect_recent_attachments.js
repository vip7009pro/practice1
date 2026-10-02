/**
 * Chẩn đoán: liệt kê N email mới nhất (mặc định 5) kèm toàn bộ đính kèm trong DB.
 * Tìm email có/không có đính kèm, kiểm tra cờ IS_INLINE/CONTENT_ID và file trên NAS.
 *
 * Chạy: node scratch/inspect_recent_attachments.js [n]
 */
const path = require("path");
const mailRepo = require("../services/mail/mailRepository");
const mailStorage = require("../services/mail/mailStorage");

const LIMIT = Number(process.argv[2]) || 5;
const RE = /ZTEST|TEST/i;

(async () => {
  const messages = await mailRepo.queryRows(
    `SELECT TOP (@N) m.ID, m.SUBJECT, m.FROM_ADDRESS, m.RECEIVED_AT, m.HAS_ATTACHMENT,
            m.ATTACHMENT_COUNT, m.FOLDER, a.EMAIL_ADDRESS
     FROM ZTB_MAIL_MESSAGE m
     JOIN ZTB_MAIL_ACCOUNT a ON a.ID = m.MAIL_ACCOUNT_ID
     WHERE m.DELETED_AT IS NULL
     ORDER BY m.RECEIVED_AT DESC, m.ID DESC`,
    { N: LIMIT }
  );

  for (const m of messages) {
    console.log("=".repeat(100));
    console.log(`#${m.ID} [${m.FOLDER}] ${m.RECEIVED_AT?.toISOString?.() || m.RECEIVED_AT}`);
    console.log(`   From   : ${m.FROM_ADDRESS} → ${m.EMAIL_ADDRESS}`);
    console.log(`   Subject: ${String(m.SUBJECT || "").slice(0, 90)}`);
    console.log(`   HAS_ATTACHMENT=${m.HAS_ATTACHMENT} ATTACHMENT_COUNT=${m.ATTACHMENT_COUNT}`);

    const rows = await mailRepo.queryRows(
      `SELECT a.ID, a.FILE_NAME, a.CONTENT_TYPE, a.FILE_SIZE, a.CONTENT_ID, a.IS_INLINE, a.STATUS,
              pf.STORAGE_PATH
       FROM ZTB_MAIL_ATTACHMENT a
       LEFT JOIN ZTB_MAIL_PHYSICAL_FILE pf ON pf.ID = a.PHYSICAL_FILE_ID
       WHERE a.MESSAGE_ID = @ID ORDER BY a.ID`,
      { ID: m.ID }
    );
    if (rows.length === 0) console.log("   (không có dòng đính kèm nào)");
    for (const a of rows) {
      const exists = a.STORAGE_PATH ? mailStorage.exists(a.STORAGE_PATH) : false;
      console.log(
        `   - #${a.ID} ${String(a.FILE_NAME || "(no name)").slice(0, 40)} | ${a.CONTENT_TYPE} | ${a.FILE_SIZE} bytes` +
          ` | IS_INLINE=${a.IS_INLINE} | CID=${a.CONTENT_ID || "-"} | ${a.STATUS} | file=${exists ? "OK" : "THIẾU"}`
      );
      if (a.STORAGE_PATH) console.log(`       path: ${a.STORAGE_PATH}`);
    }
  }

  const stats = await mailRepo.queryOne(
    `SELECT COUNT(*) AS TOTAL,
            SUM(CASE WHEN HAS_ATTACHMENT = 1 THEN 1 ELSE 0 END) AS MSG_WITH_ATT,
            SUM(CASE WHEN ATTACHMENT_COUNT > 0 THEN 1 ELSE 0 END) AS MSG_COUNT_GT0,
            SUM(CASE WHEN HAS_ATTACHMENT = 0 AND ATTACHMENT_COUNT > 0 THEN 1 ELSE 0 END) AS LECH
     FROM ZTB_MAIL_MESSAGE`
  );
  console.log("=".repeat(100));
  console.log("Tổng hợp:", JSON.stringify(stats));

  const inlineStats = await mailRepo.queryRows(
    `SELECT IS_INLINE, COUNT(*) AS CNT FROM ZTB_MAIL_ATTACHMENT GROUP BY IS_INLINE`
  );
  console.log("IS_INLINE:", JSON.stringify(inlineStats));
  const cidStats = await mailRepo.queryOne(
    `SELECT SUM(CASE WHEN CONTENT_ID IS NOT NULL THEN 1 ELSE 0 END) AS CO_CID,
            SUM(CASE WHEN CONTENT_ID IS NOT NULL AND IS_INLINE = 0 THEN 1 ELSE 0 END) AS CID_NHUNG_ISINLINE_0,
            SUM(CASE WHEN CONTENT_ID IS NULL AND IS_INLINE = 1 THEN 1 ELSE 0 END) AS KHONG_CID_NHUNG_ISINLINE_1
     FROM ZTB_MAIL_ATTACHMENT`
  );
  console.log("CONTENT_ID vs IS_INLINE:", JSON.stringify(cidStats));
  console.log("Trùng tên nội bộ đang dùng:", RE.source, "| root NAS:", mailStorage.resolveMailRoot());
  process.exit(0);
})().catch((error) => {
  console.error("Lỗi:", error);
  process.exit(1);
});
