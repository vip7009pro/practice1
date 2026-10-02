const { openConnection } = require("../config/database");
(async () => {
  const p = await openConnection();
  const acc = await p.query(`SELECT ID, CTR_CD, EMPL_NO, EMAIL_ADDRESS, IS_ACTIVE, LAST_SYNC_AT, LAST_SYNC_STATUS,
      LEFT(ISNULL(LAST_ERROR,''),120) AS ERR FROM ZTB_MAIL_ACCOUNT ORDER BY ID`);
  console.log("ACCOUNTS:");
  console.table(acc.recordset);
  const ck = await p.query(`SELECT MAIL_ACCOUNT_ID, SERVER_TOTAL, TOTAL_IMPORTED, IN_PROGRESS, LOCKED_AT, LAST_SYNC_AT FROM ZTB_MAIL_SYNC_CHECKPOINT ORDER BY MAIL_ACCOUNT_ID`);
  console.log("CHECKPOINTS:");
  console.table(ck.recordset);
  const cnt = await p.query(`SELECT MAIL_ACCOUNT_ID, COUNT(*) AS MSGS FROM ZTB_MAIL_MESSAGE GROUP BY MAIL_ACCOUNT_ID ORDER BY MAIL_ACCOUNT_ID`);
  console.log("MESSAGES:");
  console.table(cnt.recordset);
  await p.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
