/** Liệt kê phòng chat của 1 nhân viên kèm số tệp — dùng để chọn dữ liệu kiểm thử chia sẻ. */
const { openConnection, closePool } = require("../config/database");

async function main() {
  const emplNo = (process.argv[2] || "NHU1903").trim();
  const pool = await openConnection();

  const conversations = await pool.query(
    `SELECT c.CONVERSATION_ID, c.CONV_TYPE, c.TITLE, c.LAST_MESSAGE_ID
       FROM ZTB_CHAT_CONVERSATION c
      WHERE c.DELETED_AT IS NULL
        AND EXISTS (
              SELECT 1 FROM ZTB_CHAT_PARTICIPANT pt
               WHERE pt.CONVERSATION_ID = c.CONVERSATION_ID
                 AND pt.EMPL_NO = @EMPL_NO AND pt.LEFT_AT IS NULL)
      ORDER BY c.LAST_MESSAGE_ID DESC`,
    { EMPL_NO: emplNo }
  );
  console.table(conversations.recordset);

  const withFiles = await pool.query(
    `SELECT a.CONVERSATION_ID, COUNT(*) AS FILES
       FROM ZTB_CHAT_ATTACHMENT a
      WHERE a.DELETED_AT IS NULL
      GROUP BY a.CONVERSATION_ID
      ORDER BY a.CONVERSATION_ID`
  );
  console.table(withFiles.recordset);

  await closePool();
}

main().catch(async (error) => {
  console.error("[inspect] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
