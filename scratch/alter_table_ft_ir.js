const { queryDB } = require("../config/database");

async function run() {
  console.log("Renaming FTIR column to FT_IR in database with constraint dropping...");
  
  const query = `
    DECLARE @ConstraintName nvarchar(200)
    SELECT @ConstraintName = Name FROM sys.default_constraints
    WHERE parent_object_id = object_id('ZTB_MATERIAL_TB')
    AND parent_column_id = (SELECT column_id FROM sys.columns WHERE object_id = object_id('ZTB_MATERIAL_TB') AND name = 'FTIR')

    IF @ConstraintName IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE ZTB_MATERIAL_TB DROP CONSTRAINT ' + @ConstraintName)
    END

    IF EXISTS (
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID('ZTB_MATERIAL_TB') AND name = 'FTIR'
    )
    BEGIN
      ALTER TABLE ZTB_MATERIAL_TB DROP COLUMN FTIR;
    END

    IF NOT EXISTS (
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID('ZTB_MATERIAL_TB') AND name = 'FT_IR'
    )
    BEGIN
      ALTER TABLE ZTB_MATERIAL_TB ADD FT_IR varchar(1) NOT NULL DEFAULT 'Y';
    END
  `;
  const res = await queryDB(query);
  console.log("Migration result:", res);

  console.log("Updating existing records for FT_IR to 'Y'...");
  const updateQuery = `
    UPDATE ZTB_MATERIAL_TB 
    SET FT_IR = 'Y' 
    WHERE FT_IR IS NULL
  `;
  const resUpdate = await queryDB(updateQuery);
  console.log("Update result:", resUpdate);

  console.log("Migration finished.");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
