const { queryDB } = require("../config/database");

async function check() {
  const r = await queryDB(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME LIKE 'RP_KD_%'
    ORDER BY TABLE_NAME, ORDINAL_POSITION;
  `);
  console.log("RP_KD columns:");
  const map = {};
  for (const row of r.data) {
    if (!map[row.TABLE_NAME]) map[row.TABLE_NAME] = [];
    map[row.TABLE_NAME].push(`${row.COLUMN_NAME} (${row.DATA_TYPE})`);
  }
  for (const [table, cols] of Object.entries(map)) {
    console.log(`\nTable ${table}:`);
    console.log(cols.join(", "));
  }
  process.exit(0);
}
check().catch(console.error);
