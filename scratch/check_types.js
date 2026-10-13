const { queryDB } = require("../config/database_mssql");

async function checkTypes() {
  const r1 = await queryDB("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ZTBPOTable' AND COLUMN_NAME IN ('PO_QTY', 'PO_ID')");
  console.log("ZTBPOTable:", r1.data);
  const r2 = await queryDB("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'RP_KD_PO_BALANCE_WEEKLY'");
  console.log("RP_KD_PO_BALANCE_WEEKLY:", r2.data);
}

checkTypes().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
