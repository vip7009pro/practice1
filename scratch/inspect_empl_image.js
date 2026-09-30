/** Khảo sát nhanh cờ EMPL_IMAGE phục vụ tính năng avatar phòng chat 1-1. */
const { openConnection, closePool } = require("../config/database");

async function main() {
  const pool = await openConnection();

  const byFlag = await pool.query(
    `SELECT ISNULL(EMPL_IMAGE, '(NULL)') AS EMPL_IMAGE, COUNT(1) AS N
       FROM ZTBEMPLINFO GROUP BY EMPL_IMAGE ORDER BY N DESC`
  );
  console.log("== Phân bố EMPL_IMAGE trong ZTBEMPLINFO ==");
  console.table(byFlag.recordset);

  const participants = await pool.query(
    `SELECT TOP 15 p.EMPL_NO, e.EMPL_IMAGE,
            CASE WHEN e.EMPL_IMAGE = 'Y' THEN '/Picture_NS/NS_' + LTRIM(RTRIM(p.EMPL_NO)) + '.jpg' ELSE NULL END AS AVATAR
       FROM ZTB_CHAT_PARTICIPANT p
       LEFT JOIN ZTBEMPLINFO e ON e.CTR_CD = p.CTR_CD AND e.EMPL_NO = p.EMPL_NO
      WHERE p.LEFT_AT IS NULL`
  );
  console.log("== Mẫu participant ==");
  console.table(participants.recordset);

  const directs = await pool.query(
    `SELECT TOP 10 c.CONVERSATION_ID, c.CONV_TYPE, c.TITLE, c.AVATAR,
            STUFF((SELECT ',' + LTRIM(RTRIM(p2.EMPL_NO))
                     FROM ZTB_CHAT_PARTICIPANT p2
                    WHERE p2.CONVERSATION_ID = c.CONVERSATION_ID AND p2.LEFT_AT IS NULL
                    FOR XML PATH('')), 1, 1, '') AS MEMBERS
       FROM ZTB_CHAT_CONVERSATION c
      WHERE c.CONV_TYPE = 'DIRECT' AND c.DELETED_AT IS NULL`
  );
  console.log("== Phòng DIRECT ==");
  console.table(directs.recordset);

  await closePool();
}

main().catch(async (error) => {
  console.error("[inspect] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
