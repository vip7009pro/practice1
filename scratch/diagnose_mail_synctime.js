/**
 * So sánh các mốc "đồng bộ" để biết cái nào là UTC thật, cái nào là GETDATE() (giờ VN gắn nhãn UTC).
 * Chạy: node scratch/diagnose_mail_synctime.js
 */
const { openConnection, closePool } = require("../config/database");

async function main() {
  const pool = await openConnection();
  const acct = await pool.query(
    `SELECT TOP 5 a.ID, a.EMAIL_ADDRESS, a.LAST_SYNC_AT,
            ck.LAST_SYNC_AT AS CHECKPOINT_LAST_SYNC_AT,
            GETDATE() AS NOW_SERVER,
            DATEDIFF(MINUTE, a.LAST_SYNC_AT, GETDATE()) AS DIFF_ACC_MIN
       FROM ZTB_MAIL_ACCOUNT a
       LEFT JOIN ZTB_MAIL_SYNC_CHECKPOINT ck ON ck.MAIL_ACCOUNT_ID = a.ID
      WHERE a.LAST_SYNC_AT IS NOT NULL
      ORDER BY a.LAST_SYNC_AT DESC`
  );
  console.log("=== ZTB_MAIL_ACCOUNT.LAST_SYNC_AT vs CHECKPOINT vs NOW ===");
  for (const r of acct.recordset) {
    console.log({
      EMAIL: r.EMAIL_ADDRESS,
      ACC_LAST_SYNC_AT: r.LAST_SYNC_AT,
      CKPT_LAST_SYNC_AT: r.CHECKPOINT_LAST_SYNC_AT,
      NOW_SERVER: r.NOW_SERVER,
      DIFF_ACC_MIN: r.DIFF_ACC_MIN,
    });
  }

  const log = await pool.query(
    `SELECT TOP 5 ID, STARTED_AT, FINISHED_AT, GETDATE() AS NOW_SERVER,
            DATEDIFF(MINUTE, STARTED_AT, GETDATE()) AS DIFF_START_MIN
       FROM ZTB_MAIL_SYNC_LOG ORDER BY ID DESC`
  );
  console.log("\n=== ZTB_MAIL_SYNC_LOG ===");
  for (const r of log.recordset) {
    console.log({ ID: r.ID, STARTED_AT: r.STARTED_AT, FINISHED_AT: r.FINISHED_AT, NOW: r.NOW_SERVER, DIFF_START_MIN: r.DIFF_START_MIN });
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await closePool().catch(() => undefined); setTimeout(() => process.exit(0), 200); });
