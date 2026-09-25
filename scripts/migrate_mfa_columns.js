const { queryDB_New } = require("../config/database");

async function runMigration() {
  console.log("Starting MFA columns migration for table ZTBEMPLINFO...");

  const migrationQueries = [
    {
      col: "MFA_ENABLED",
      sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ZTBEMPLINFO') AND name = 'MFA_ENABLED')
            BEGIN
                ALTER TABLE ZTBEMPLINFO ADD MFA_ENABLED BIT NOT NULL DEFAULT 0 WITH VALUES;
                PRINT 'Added MFA_ENABLED column';
            END
            ELSE
            BEGIN
                PRINT 'MFA_ENABLED column already exists';
            END`,
    },
    {
      col: "MFA_SECRET",
      sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ZTBEMPLINFO') AND name = 'MFA_SECRET')
            BEGIN
                ALTER TABLE ZTBEMPLINFO ADD MFA_SECRET VARCHAR(100) NULL;
                PRINT 'Added MFA_SECRET column';
            END
            ELSE
            BEGIN
                PRINT 'MFA_SECRET column already exists';
            END`,
    },
    {
      col: "MFA_BACKUP_CODES",
      sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ZTBEMPLINFO') AND name = 'MFA_BACKUP_CODES')
            BEGIN
                ALTER TABLE ZTBEMPLINFO ADD MFA_BACKUP_CODES NVARCHAR(1000) NULL;
                PRINT 'Added MFA_BACKUP_CODES column';
            END
            ELSE
            BEGIN
                PRINT 'MFA_BACKUP_CODES column already exists';
            END`,
    },
    {
      col: "MFA_SETUP_DATE",
      sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ZTBEMPLINFO') AND name = 'MFA_SETUP_DATE')
            BEGIN
                ALTER TABLE ZTBEMPLINFO ADD MFA_SETUP_DATE DATETIME NULL;
                PRINT 'Added MFA_SETUP_DATE column';
            END
            ELSE
            BEGIN
                PRINT 'MFA_SETUP_DATE column already exists';
            END`,
    },
  ];

  for (const item of migrationQueries) {
    try {
      console.log(`Checking/Adding column ${item.col}...`);
      const result = await queryDB_New(item.sql, {});
      console.log(`Result for ${item.col}:`, result.tk_status);
    } catch (err) {
      console.error(`Error migrating column ${item.col}:`, err);
    }
  }

  // Xác minh lại các cột trong bảng ZTBEMPLINFO
  const verifyQuery = `
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'ZTBEMPLINFO' AND COLUMN_NAME IN ('MFA_ENABLED', 'MFA_SECRET', 'MFA_BACKUP_CODES', 'MFA_SETUP_DATE');
  `;
  const verifyResult = await queryDB_New(verifyQuery, {});
  console.log("Verified MFA columns in ZTBEMPLINFO:", verifyResult.data);
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
