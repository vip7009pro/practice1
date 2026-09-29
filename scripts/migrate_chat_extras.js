/**
 * Migration BỔ SUNG cho chat: reaction cảm xúc, ẩn tin theo từng user,
 * và dấu vết chuyển tiếp tin nhắn.
 *
 * Idempotent — chạy lại nhiều lần không lỗi, không ghi đè dữ liệu.
 * Chạy: node scripts/migrate_chat_extras.js
 */
const { openConnection } = require("../config/database");

const STATEMENTS = [
  {
    name: "ZTB_CHAT_REACTION",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_REACTION')
BEGIN
  CREATE TABLE ZTB_CHAT_REACTION (
    MESSAGE_ID  INT           NOT NULL,
    EMPL_NO     NVARCHAR(20)  NOT NULL,
    CTR_CD      NVARCHAR(20)  NOT NULL,
    REACTION    NVARCHAR(12)  NOT NULL,   -- LIKE | LOVE | HAHA | WOW | SAD | ANGRY
    CREATED_AT  DATETIME      NOT NULL CONSTRAINT DF_CHAT_RX_CREATED DEFAULT (GETDATE()),
    CONSTRAINT PK_CHAT_REACTION PRIMARY KEY (MESSAGE_ID, EMPL_NO)
  );
  PRINT 'Created ZTB_CHAT_REACTION';
END`,
  },
  {
    name: "ZTB_CHAT_MESSAGE_HIDDEN",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_MESSAGE_HIDDEN')
BEGIN
  CREATE TABLE ZTB_CHAT_MESSAGE_HIDDEN (
    MESSAGE_ID  INT           NOT NULL,
    EMPL_NO     NVARCHAR(20)  NOT NULL,
    HIDDEN_AT   DATETIME      NOT NULL CONSTRAINT DF_CHAT_HID_HIDDEN DEFAULT (GETDATE()),
    CONSTRAINT PK_CHAT_MESSAGE_HIDDEN PRIMARY KEY (MESSAGE_ID, EMPL_NO)
  );
  PRINT 'Created ZTB_CHAT_MESSAGE_HIDDEN';
END`,
  },
  {
    name: "ZTB_CHAT_MESSAGE.FORWARDED_FROM_MESSAGE_ID",
    sql: `IF NOT EXISTS (
         SELECT * FROM sys.columns
         WHERE object_id = OBJECT_ID('ZTB_CHAT_MESSAGE') AND name = 'FORWARDED_FROM_MESSAGE_ID')
BEGIN
  ALTER TABLE ZTB_CHAT_MESSAGE ADD FORWARDED_FROM_MESSAGE_ID INT NULL;
  PRINT 'Added FORWARDED_FROM_MESSAGE_ID';
END`,
  },
  {
    name: "ZTB_CHAT_REACTION.RX_COUNT",
    sql: `IF NOT EXISTS (
         SELECT * FROM sys.columns
         WHERE object_id = OBJECT_ID('ZTB_CHAT_REACTION') AND name = 'RX_COUNT')
BEGIN
  -- Số lần thả cùng một cảm xúc (cho phép "like tim vô hạn").
  ALTER TABLE ZTB_CHAT_REACTION ADD RX_COUNT INT NOT NULL
    CONSTRAINT DF_CHAT_RX_COUNT DEFAULT 1 WITH VALUES;
  PRINT 'Added RX_COUNT';
END`,
  },
  {
    name: "IDX_CHAT_REACTION_MSG",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_REACTION_MSG')
  CREATE INDEX IDX_CHAT_REACTION_MSG ON ZTB_CHAT_REACTION (MESSAGE_ID);`,
  },
  {
    name: "IDX_CHAT_HIDDEN_EMPL",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_HIDDEN_EMPL')
  CREATE INDEX IDX_CHAT_HIDDEN_EMPL ON ZTB_CHAT_MESSAGE_HIDDEN (EMPL_NO, MESSAGE_ID);`,
  },
];

async function main() {
  const pool = await openConnection();
  console.log(`[chat-extras] Chạy ${STATEMENTS.length} bước...`);

  for (const statement of STATEMENTS) {
    try {
      await pool.query(statement.sql);
      console.log(`[chat-extras] OK: ${statement.name}`);
    } catch (error) {
      console.error(`[chat-extras] LỖI ở ${statement.name}:`, error?.message || error);
      throw error;
    }
  }

  const verify = await pool.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME IN ('ZTB_CHAT_REACTION','ZTB_CHAT_MESSAGE_HIDDEN')
    ORDER BY TABLE_NAME`);
  console.log("[chat-extras] Bảng:", (verify.recordset || []).map((r) => r.TABLE_NAME));
  console.log("[chat-extras] HOÀN THÀNH");
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
