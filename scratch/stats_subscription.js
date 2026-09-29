/** Thống kê subscription: trạng thái, có kèm owner (emplNo) hay không. */
const { openConnection, closePool } = require("../config/database");

(async () => {
  const pool = await openConnection();

  const byStatus = (
    await pool.query(
      `SELECT SUB_STATUS, COUNT(*) AS CNT FROM ZTB_SUBSCRIPTION_TB GROUP BY SUB_STATUS`
    )
  ).recordset;
  console.log("Theo SUB_STATUS:", JSON.stringify(byStatus));

  const withOwner = (
    await pool.query(
      `SELECT COUNT(*) AS CNT FROM ZTB_SUBSCRIPTION_TB WHERE SUBSCRIPTION LIKE '%emplNo%'`
    )
  ).recordset[0];
  console.log("Row có owner (emplNo):", withOwner.CNT);

  const ownedRows = (
    await pool.query(
      `SELECT TOP 20 CTR_CD, SUB_STATUS, SUBSCRIPTION FROM ZTB_SUBSCRIPTION_TB
       WHERE SUBSCRIPTION LIKE '%emplNo%'`
    )
  ).recordset;
  ownedRows.forEach((row) => {
    let owner = "?";
    try {
      owner = String(JSON.parse(row.SUBSCRIPTION)?.emplNo || "");
    } catch (error) {
      owner = "(parse-fail)";
    }
    console.log(`  owned ctr=${row.CTR_CD} status=${row.SUB_STATUS} owner=${JSON.stringify(owner)}`);
  });

  const matching = (
    await pool.query(
      `SELECT COUNT(*) AS CNT FROM ZTB_SUBSCRIPTION_TB WHERE SUB_STATUS = '1'`
    )
  ).recordset[0];
  console.log("Row khớp bộ lọc của service (SUB_STATUS='1'):", matching.CNT);

  await closePool();
})();
