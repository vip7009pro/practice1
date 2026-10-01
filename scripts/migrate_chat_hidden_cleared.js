/**
 * Migration: ẩn phòng chat chưa bắt đầu + xoá phòng chat theo từng người.
 *
 * 1) `ZTB_CHAT_PARTICIPANT.HIDDEN`
 *    - Tạo phòng DIRECT khi CHƯA gõ tin nào ⇒ chỉ người tạo thấy phòng trong danh sách;
 *      người còn lại KHÔNG thấy cho tới khi có tin nhắn đầu tiên.
 *    - HIDDEN = 1 ⇒ ẩn khỏi danh sách của chính người đó; tin nhắn đầu tiên sẽ mở lại cho mọi người.
 *
 * 2) `ZTB_CHAT_PARTICIPANT.CLEARED_BEFORE_MESSAGE_ID`
 *    - "Xoá phòng chat" (khác "rời nhóm") = chỉ xoá LỊCH SỬ phía người dùng: các tin có
 *      MESSAGE_ID <= mốc này bị ẩn, phòng biến mất khỏi danh sách cho tới khi có tin MỚI hơn.
 *    - 0 = chưa từng xoá.
 *
 * Idempotent — chạy lại nhiều lần không lỗi, KHÔNG ghi đè dữ liệu hiện có.
 * Chạy: node scripts/migrate_chat_hidden_cleared.js
 */
const { openConnection } = require("../config/database");

const STATEMENTS = [
  {
    name: "ZTB_CHAT_PARTICIPANT.HIDDEN",
    sql: `IF NOT EXISTS (
           SELECT * FROM sys.columns
           WHERE object_id = OBJECT_ID('ZTB_CHAT_PARTICIPANT') AND name = 'HIDDEN')
BEGIN
  ALTER TABLE ZTB_CHAT_PARTICIPANT
    ADD HIDDEN BIT NOT NULL CONSTRAINT DF_CHAT_PARTICIPANT_HIDDEN DEFAULT 0 WITH VALUES;
  PRINT 'Added HIDDEN';
END`,
  },
  {
    name: "ZTB_CHAT_PARTICIPANT.CLEARED_BEFORE_MESSAGE_ID",
    sql: `IF NOT EXISTS (
           SELECT * FROM sys.columns
           WHERE object_id = OBJECT_ID('ZTB_CHAT_PARTICIPANT') AND name = 'CLEARED_BEFORE_MESSAGE_ID')
BEGIN
  ALTER TABLE ZTB_CHAT_PARTICIPANT
    ADD CLEARED_BEFORE_MESSAGE_ID INT NOT NULL
        CONSTRAINT DF_CHAT_PARTICIPANT_CLEARED DEFAULT 0 WITH VALUES;
  PRINT 'Added CLEARED_BEFORE_MESSAGE_ID';
END`,
  },
  {
    name: "IDX_CHAT_PARTICIPANT_HIDDEN",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_PARTICIPANT_HIDDEN')
  CREATE INDEX IDX_CHAT_PARTICIPANT_HIDDEN
    ON ZTB_CHAT_PARTICIPANT (CTR_CD, EMPL_NO, HIDDEN);`,
  },
];

async function main() {
  const pool = await openConnection();
  console.log(`[chat-hidden-cleared] Chạy ${STATEMENTS.length} bước...`);

  for (const statement of STATEMENTS) {
    try {
      await pool.query(statement.sql);
      console.log(`[chat-hidden-cleared] OK: ${statement.name}`);
    } catch (error) {
      console.error(`[chat-hidden-cleared] LỖI ở ${statement.name}:`, error?.message || error);
      throw error;
    }
  }

  const verify = await pool.query(`
    SELECT c.name AS COLUMN_NAME
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('ZTB_CHAT_PARTICIPANT')
      AND c.name IN ('HIDDEN', 'CLEARED_BEFORE_MESSAGE_ID')`);
  console.log(
    "[chat-hidden-cleared] Cột:",
    (verify.recordset || []).map((r) => r.COLUMN_NAME)
  );
  console.log("[chat-hidden-cleared] HOÀN THÀNH");
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
