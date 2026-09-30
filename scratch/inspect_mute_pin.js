/** Kiểm tra nhanh trạng thái mute/pin trong DB. Chạy: node scratch/inspect_mute_pin.js */
const { openConnection, closePool } = require("../config/database");

(async () => {
  const pool = await openConnection();
  const muted = await pool.query(
    `SELECT p.CONVERSATION_ID, LTRIM(RTRIM(p.EMPL_NO)) AS EMPL_NO, p.MUTED_UNTIL,
            c.CONV_TYPE, c.TITLE
       FROM ZTB_CHAT_PARTICIPANT p
       JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = p.CONVERSATION_ID
      WHERE p.MUTED_UNTIL IS NOT NULL`
  );
  console.log("--- MUTED ---");
  console.table(muted.recordset);

  const pinned = await pool.query(
    `SELECT TOP 10 MESSAGE_ID, CONVERSATION_ID, PINNED_AT, LTRIM(RTRIM(PINNED_BY)) AS PINNED_BY, MSG_TYPE,
            LEFT(CONTENT, 40) AS PREVIEW
       FROM ZTB_CHAT_MESSAGE
      WHERE PINNED_AT IS NOT NULL
      ORDER BY PINNED_AT DESC`
  );
  console.log("--- PINNED ---");
  console.table(pinned.recordset);

  const reads = await pool.query(
    `SELECT TOP 10 CONVERSATION_ID, LTRIM(RTRIM(EMPL_NO)) AS EMPL_NO, LAST_READ_MESSAGE_ID
       FROM ZTB_CHAT_PARTICIPANT
      WHERE LAST_READ_MESSAGE_ID IS NOT NULL
      ORDER BY LAST_READ_MESSAGE_ID DESC`
  );
  console.log("--- READS ---");
  console.table(reads.recordset);

  await closePool();
})();
