/**
 * Dọn tin nhắn test trong 1 phòng chat (xoá VẬT LÝ — chỉ dùng cho dữ liệu rác do test sinh ra).
 *
 * Chạy: node scratch/cleanup_chat_test_messages.js <CONVERSATION_ID> "<LIKE_PATTERN>"
 * Ví dụ: node scratch/cleanup_chat_test_messages.js 6 "tin nhan test auto-open%"
 */
const { openConnection, closePool } = require("../config/database");
const repo = require("../services/chat/chatRepository");

async function main() {
  const conversationId = Number(process.argv[2]);
  const pattern = process.argv[3] || "tin nhan test%";
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    throw new Error("Thiếu CONVERSATION_ID hợp lệ");
  }

  const pool = await openConnection();
  const found = await pool.query(
    `SELECT MESSAGE_ID, MSG_TYPE, LEFT(CONTENT, 70) AS PREVIEW, DELETED_AT
       FROM ZTB_CHAT_MESSAGE
      WHERE CONVERSATION_ID = @ID AND CONTENT LIKE @PATTERN`,
    { ID: conversationId, PATTERN: pattern }
  );
  console.log(`[cleanup] Khớp ${found.recordset.length} tin trong phòng #${conversationId}:`);
  console.table(found.recordset);
  if (found.recordset.length === 0) {
    await closePool();
    return;
  }

  const ids = found.recordset.map((r) => r.MESSAGE_ID);
  const list = ids.join(",");
  // Dùng lại transaction của repository để khớp API mssql (commit/rollback).
  await repo.withTransaction(async ({ query }) => {
    await query(`DELETE FROM ZTB_CHAT_REACTION WHERE MESSAGE_ID IN (${list})`);
    await query(`DELETE FROM ZTB_CHAT_MESSAGE_HIDDEN WHERE MESSAGE_ID IN (${list})`);
    await query(`DELETE FROM ZTB_CHAT_ATTACHMENT WHERE MESSAGE_ID IN (${list})`);
    await query(`DELETE FROM ZTB_CHAT_MESSAGE WHERE MESSAGE_ID IN (${list})`);
    // Tin cuối bị xoá ⇒ cập nhật lại con trỏ phòng cho đúng.
    await query(
      `UPDATE ZTB_CHAT_CONVERSATION
          SET LAST_MESSAGE_ID = (
                SELECT MAX(MESSAGE_ID) FROM ZTB_CHAT_MESSAGE
                 WHERE CONVERSATION_ID = @ID AND DELETED_AT IS NULL),
              LAST_MESSAGE_AT = (
                SELECT MAX(CREATED_AT) FROM ZTB_CHAT_MESSAGE
                 WHERE CONVERSATION_ID = @ID AND DELETED_AT IS NULL)
        WHERE CONVERSATION_ID = @ID`,
      { ID: conversationId }
    );
  });
  console.log(`[cleanup] Đã xoá ${ids.length} tin.`);

  await closePool();
}

main().catch(async (error) => {
  console.error("[cleanup] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
