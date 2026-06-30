const { queryDB } = require("../config/database");

async function run() {
  console.log("Starting database migration...");
  
  const columns = ["KEO_KEO", "BOC_TACH", "DIEN_TRO", "TINH_DIEN", "FTIR", "TACK"];
  
  for (const col of columns) {
    console.log(`Adding column ${col} if not exists...`);
    const checkAndAddQuery = `
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('ZTB_MATERIAL_TB') AND name = '${col}'
      )
      BEGIN
        ALTER TABLE ZTB_MATERIAL_TB ADD ${col} varchar(1) NOT NULL DEFAULT 'Y';
      END
    `;
    const res = await queryDB(checkAndAddQuery);
    console.log(`Result for ${col}:`, res);
  }

  console.log("Updating existing records to 'Y'...");
  const updateQuery = `
    UPDATE ZTB_MATERIAL_TB 
    SET 
      KEO_KEO = 'Y', 
      BOC_TACH = 'Y', 
      DIEN_TRO = 'Y', 
      TINH_DIEN = 'Y', 
      FTIR = 'Y', 
      TACK = 'Y'
    WHERE 
      KEO_KEO IS NULL OR
      BOC_TACH IS NULL OR
      DIEN_TRO IS NULL OR
      TINH_DIEN IS NULL OR
      FTIR IS NULL OR
      TACK IS NULL
  `;
  const resUpdate = await queryDB(updateQuery);
  console.log("Update result:", resUpdate);
  
  console.log("Migration finished. Exiting...");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
