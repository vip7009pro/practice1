/**
 * Migration BỔ SUNG cho chat:
 *  - Tắt thông báo THEO TỪNG PHÒNG (mốc thời gian hết hạn ở từng participant).
 *  - Ghim tin nhắn trong phòng.
 *
 * Idempotent — chạy lại nhiều lần không lỗi, không ghi đè dữ liệu.
 * Chạy: node scripts/migrate_chat_pins_mute.js
 */
const { openConnection } = require("../config/database");

const STATEMENTS = [
  {
    name: "ZTB_CHAT_PARTICIPANT.MUTED_UNTIL",
    sql: `IF NOT EXISTS (
         SELECT * FROM sys.columns
         WHERE object_id = OBJECT_ID('ZTB_CHAT_PARTICIPANT') AND name = 'MUTED_UNTIL')
BEGIN
  -- NULL = đang nhận thông báo. Ngày trong quá khứ = đã hết hạn (coi như đang nhận).
  -- Giá trị xa trong tương lai (9999) = "cho tới khi mở lại phòng".
  ALTER TABLE ZTB_CHAT_PARTICIPANT ADD MUTED_UNTIL DATETIME2 NULL;
  PRINT 'Added MUTED_UNTIL';
END`,
  },
  {
    name: "ZTB_CHAT_MESSAGE.PINNED_AT",
    sql: `IF NOT EXISTS (
         SELECT * FROM sys.columns
         WHERE object_id = OBJECT_ID('ZTB_CHAT_MESSAGE') AND name = 'PINNED_AT')
BEGIN
  ALTER TABLE ZTB_CHAT_MESSAGE ADD PINNED_AT DATETIME2 NULL;
  PRINT 'Added PINNED_AT';
END`,
  },
  {
    name: "ZTB_CHAT_MESSAGE.PINNED_BY",
    sql: `IF NOT EXISTS (
         SELECT * FROM sys.columns
         WHERE object_id = OBJECT_ID('ZTB_CHAT_MESSAGE') AND name = 'PINNED_BY')
BEGIN
  ALTER TABLE ZTB_CHAT_MESSAGE ADD PINNED_BY NVARCHAR(20) NULL;
  PRINT 'Added PINNED_BY';
END`,
  },
  {
    name: "IX_CHAT_MESSAGE_PINNED",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CHAT_MESSAGE_PINNED')
BEGIN
  CREATE INDEX IX_CHAT_MESSAGE_PINNED
    ON ZTB_CHAT_MESSAGE (CONVERSATION_ID, PINNED_AT)
    INCLUDE (SENDER_EMPL_NO, MSG_TYPE, CONTENT, CREATED_AT, DELETED_AT);
  PRINT 'Created IX_CHAT_MESSAGE_PINNED';
END`,
  },
];

async function main() {
  const connection = await openConnection();
  try {
    for (const statement of STATEMENTS) {
      try {
        await connection.query(statement.sql);
        console.log(`[migrate] OK  — ${statement.name}`);
      } catch (error) {
        console.error(`[migrate] LỖI — ${statement.name}: ${error.message}`);
        throw error;
      }
    }
    console.log("[migrate] Hoàn tất migrate_chat_pins_mute.js");
  } finally {
    try {
      await connection.close();
    } catch {
      /* bỏ qua */
    }
  }
}

main().catch((error) => {
  console.error("[migrate] Thất bại:", error);
  process.exit(1);
});
