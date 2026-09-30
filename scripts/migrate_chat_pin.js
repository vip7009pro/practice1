/**
 * Migration: GHIM cuộc trò chuyện (theo từng người dùng).
 *
 * Ghim là thuộc tính RIÊNG của mỗi người trong phòng ⇒ lưu ở
 * `ZTB_CHAT_PARTICIPANT.PINNED_AT` (không phải trên bảng conversation).
 * `NULL` = không ghim; có giá trị = thời điểm ghim (dùng để sắp "ghim mới hơn lên trên").
 *
 * Idempotent — chạy lại nhiều lần không lỗi, không ghi đè dữ liệu.
 * Chạy: node scripts/migrate_chat_pin.js
 */
const { openConnection } = require("../config/database");

const STATEMENTS = [
  {
    name: "ZTB_CHAT_PARTICIPANT.PINNED_AT",
    sql: `IF NOT EXISTS (
           SELECT * FROM sys.columns
           WHERE object_id = OBJECT_ID('ZTB_CHAT_PARTICIPANT') AND name = 'PINNED_AT')
BEGIN
  ALTER TABLE ZTB_CHAT_PARTICIPANT ADD PINNED_AT DATETIME NULL;
  PRINT 'Added PINNED_AT';
END`,
  },
  {
    name: "IDX_CHAT_PARTICIPANT_PIN",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_PARTICIPANT_PIN')
  CREATE INDEX IDX_CHAT_PARTICIPANT_PIN
    ON ZTB_CHAT_PARTICIPANT (CTR_CD, EMPL_NO, PINNED_AT DESC);`,
  },
];

async function main() {
  const pool = await openConnection();
  console.log(`[chat-pin] Chạy ${STATEMENTS.length} bước...`);

  for (const statement of STATEMENTS) {
    try {
      await pool.query(statement.sql);
      console.log(`[chat-pin] OK: ${statement.name}`);
    } catch (error) {
      console.error(`[chat-pin] LỖI ở ${statement.name}:`, error?.message || error);
      throw error;
    }
  }

  const verify = await pool.query(`
    SELECT c.name AS COLUMN_NAME, t.name AS TABLE_NAME
    FROM sys.columns c
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'ZTB_CHAT_PARTICIPANT' AND c.name = 'PINNED_AT'`);
  console.log("[chat-pin] Cột:", (verify.recordset || []).map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));
  console.log("[chat-pin] HOÀN THÀNH");
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
