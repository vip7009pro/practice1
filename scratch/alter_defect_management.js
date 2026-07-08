const { queryDB } = require("../config/database");

async function run() {
  console.log("Starting database migration for DEFECT_MANAGEMENT table...");
  
  const col = "PART_CODE_OTHERS";
  console.log(`Adding column ${col} to DEFECT_MANAGEMENT if not exists...`);
  const checkAndAddQuery = `
    IF NOT EXISTS (
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID('DEFECT_MANAGEMENT') AND name = '${col}'
    )
    BEGIN
      ALTER TABLE DEFECT_MANAGEMENT ADD ${col} varchar(1000) NULL;
    END
  `;
  const res = await queryDB(checkAndAddQuery);
  console.log(`Migration result for adding ${col}:`, res);
  
  console.log("Migration finished. Exiting...");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
