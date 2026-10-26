const { openConnection } = require("../config/database");
const mailRepo = require("../services/mail/mailRepository");
const msgRepo = require("../services/mail/mailMessageRepository");

async function run() {
  const pool = await openConnection();
  try {
    const acc = await pool.query(`
      SELECT ID, CTR_CD, EMPL_NO, EMAIL_ADDRESS, DISPLAY_NAME,
             POP3_HOST, POP3_PORT, POP3_SECURE, POP3_USERNAME,
             SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USERNAME,
             IS_ACTIVE, IS_SHARED, SYNC_FROM_DATE, SYNC_TO_DATE,
             LAST_SYNC_AT, LAST_SYNC_STATUS, LAST_ERROR
      FROM ZTB_MAIL_ACCOUNT
      WHERE EMAIL_ADDRESS LIKE '%nvh1903%'
    `);
    console.log("=== ACCOUNT ===");
    console.log(JSON.stringify(acc.recordset, null, 2));

    if (acc.recordset.length > 0) {
      const accountId = acc.recordset[0].ID;

      const checkpoint = await pool.query(`
        SELECT * FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = ${accountId}
      `);
      console.log("=== CHECKPOINT ===");
      console.log(JSON.stringify(checkpoint.recordset, null, 2));

      const countMsg = await pool.query(`
        SELECT COUNT(*) as TOTAL_MESSAGES,
               MIN(SENT_AT) as MIN_SENT_AT,
               MAX(SENT_AT) as MAX_SENT_AT
        FROM ZTB_MAIL_MESSAGE
        WHERE MAIL_ACCOUNT_ID = ${accountId}
      `);
      console.log("=== MESSAGES STATS ===");
      console.log(JSON.stringify(countMsg.recordset, null, 2));

      const skips = await pool.query(`
        SELECT COUNT(*) as TOTAL_SKIPS,
               SKIP_REASON,
               COUNT(*) as CNT
        FROM ZTB_MAIL_SYNC_SKIP
        WHERE MAIL_ACCOUNT_ID = ${accountId}
        GROUP BY SKIP_REASON
      `);
      console.log("=== SKIPS STATS ===");
      console.log(JSON.stringify(skips.recordset, null, 2));

      const recentLogs = await pool.query(`
        SELECT TOP 5 *
        FROM ZTB_MAIL_SYNC_LOG
        WHERE MAIL_ACCOUNT_ID = ${accountId}
        ORDER BY ID DESC
      `);
      console.log("=== RECENT LOGS ===");
      console.log(JSON.stringify(recentLogs.recordset, null, 2));

      // Lấy 5 message mới nhất
      const topMsgs = await pool.query(`
        SELECT TOP 5 ID, UIDL, SUBJECT, SENT_AT, RECEIVED_AT
        FROM ZTB_MAIL_MESSAGE
        WHERE MAIL_ACCOUNT_ID = ${accountId}
        ORDER BY SENT_AT DESC
      `);
      console.log("=== TOP 5 LATEST MESSAGES IN DB ===");
      console.log(JSON.stringify(topMsgs.recordset, null, 2));
    }
  } catch (err) {
    console.error("Lỗi:", err);
  } finally {
    process.exit(0);
  }
}

run();
