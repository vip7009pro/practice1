/** Kiểm tra EMPL_IMAGE của những người đang có phòng DIRECT (phục vụ avatar phòng 1-1). */
const { openConnection, closePool } = require("../config/database");

async function main() {
  const pool = await openConnection();
  const result = await pool.query(
    `SELECT c.CONVERSATION_ID,
            LTRIM(RTRIM(p.EMPL_NO)) AS EMPL_NO,
            e.EMPL_IMAGE
       FROM ZTB_CHAT_CONVERSATION c
       INNER JOIN ZTB_CHAT_PARTICIPANT p ON p.CONVERSATION_ID = c.CONVERSATION_ID
       LEFT JOIN ZTBEMPLINFO e ON e.CTR_CD = p.CTR_CD AND e.EMPL_NO = p.EMPL_NO
      WHERE c.CONV_TYPE = 'DIRECT' AND c.DELETED_AT IS NULL AND p.LEFT_AT IS NULL
      ORDER BY c.CONVERSATION_ID, EMPL_NO`
  );
  console.table(result.recordset);
  await closePool();
}

main().catch(async (error) => {
  console.error("[inspect-direct] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
