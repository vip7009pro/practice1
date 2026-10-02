/** Kiểm tra 1 email: ảnh là cid:/data:/remote, và có attachment inline không. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();
const mailRepo = require("../services/mail/mailRepository");
const { openConnection } = require("../config/database");

async function main() {
  const rows = await mailRepo.queryRows(
    `SELECT TOP 5 ID, SUBJECT, LEN(ISNULL(BODY_INLINE,'')) AS BODY_LEN, BODY_STORAGE_PATH, HAS_ATTACHMENT, ATTACHMENT_COUNT,
            CASE WHEN ISNULL(BODY_INLINE,'') LIKE '%data:image%' THEN 1 ELSE 0 END AS HAS_DATA_IMG,
            CASE WHEN ISNULL(BODY_INLINE,'') LIKE '%cid:%' THEN 1 ELSE 0 END AS HAS_CID_IMG,
            CASE WHEN ISNULL(BODY_INLINE,'') LIKE '%<img%' THEN 1 ELSE 0 END AS HAS_IMG_TAG
     FROM ZTB_MAIL_MESSAGE
     WHERE FOLDER='INBOX' AND (ISNULL(BODY_INLINE,'') LIKE '%<img%')
     ORDER BY RECEIVED_AT DESC`
  );
  console.table(rows);

  if (rows[0]) {
    const atts = await mailRepo.queryRows(
      `SELECT ID, FILE_NAME, CONTENT_TYPE, IS_INLINE, CONTENT_ID, STATUS FROM ZTB_MAIL_ATTACHMENT WHERE MESSAGE_ID=@ID`,
      { ID: rows[0].ID }
    );
    console.log(`\nAttachments của message #${rows[0].ID}:`);
    console.table(atts);
  }

  const stat = await mailRepo.queryRows(
    `SELECT COUNT(*) AS TOTAL,
            SUM(CASE WHEN IS_INLINE=1 THEN 1 ELSE 0 END) AS INLINE_CNT,
            SUM(CASE WHEN CONTENT_ID IS NOT NULL THEN 1 ELSE 0 END) AS WITH_CID
     FROM ZTB_MAIL_ATTACHMENT`
  );
  console.log("\nTổng quan attachment:");
  console.table(stat);
}

main().catch((e) => { console.error(e?.message || e); process.exitCode = 1; })
  .finally(async () => { try { (await openConnection()).close(); } catch { /* bỏ qua */ } });
