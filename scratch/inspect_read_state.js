/**
 * Xem trạng thái đã đọc của người dùng trong các phòng chat (kiểm chứng badge).
 *   node scratch/inspect_read_state.js [EMPL_NO]
 */
const { openConnection, closePool } = require("../config/database");

async function main() {
  const emplNo = String(process.argv[2] || "NHU1903").trim().toUpperCase();
  const pool = await openConnection();
  const result = await pool.query(
    `SELECT c.CONVERSATION_ID,
            c.CONV_TYPE,
            p.LAST_READ_MESSAGE_ID,
            (SELECT MAX(MESSAGE_ID) FROM ZTB_CHAT_MESSAGE m
              WHERE m.CONVERSATION_ID = c.CONVERSATION_ID AND m.DELETED_AT IS NULL) AS NEWEST_MESSAGE_ID,
            (SELECT COUNT(1) FROM ZTB_CHAT_MESSAGE um
              WHERE um.CONVERSATION_ID = c.CONVERSATION_ID
                AND um.DELETED_AT IS NULL
                AND um.SENDER_EMPL_NO <> @EMPL_NO
                AND (p.LAST_READ_MESSAGE_ID IS NULL OR um.MESSAGE_ID > p.LAST_READ_MESSAGE_ID)
            ) AS UNREAD_COUNT
       FROM ZTB_CHAT_PARTICIPANT p
       INNER JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = p.CONVERSATION_ID
      WHERE p.EMPL_NO = @EMPL_NO AND c.DELETED_AT IS NULL AND p.LEFT_AT IS NULL
      ORDER BY c.CONVERSATION_ID`,
    { EMPL_NO: emplNo }
  );
  console.log(`=== ${emplNo} ===`);
  console.table(result.recordset);
  await closePool();
}

main().catch(async (error) => {
  console.error("[inspect] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
