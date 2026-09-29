/**
 * Xem vài tin nhắn mới nhất của 1 phòng (kiểm chứng luồng chia sẻ).
 *   node scratch/inspect_conversation_messages.js "Tên phòng"
 */
const { openConnection, closePool } = require("../config/database");

async function main() {
  const title = process.argv[2] || "Nhóm có avatar";
  const pool = await openConnection();

  const conversation = (
    await pool.query(
      `SELECT TOP 1 CONVERSATION_ID, CONV_TYPE, TITLE FROM ZTB_CHAT_CONVERSATION
        WHERE TITLE = @TITLE ORDER BY CONVERSATION_ID DESC`,
      { TITLE: title }
    )
  ).recordset[0];

  if (!conversation) {
    console.log(`Không tìm thấy phòng "${title}"`);
    await closePool();
    return;
  }

  console.log(`Phòng ${conversation.CONVERSATION_ID} (${conversation.CONV_TYPE}) ${conversation.TITLE}`);

  const messages = await pool.query(
    `SELECT TOP 4 MESSAGE_ID, SENDER_EMPL_NO, MSG_TYPE, CONTENT, CREATED_AT
       FROM ZTB_CHAT_MESSAGE WHERE CONVERSATION_ID = @ID ORDER BY MESSAGE_ID DESC`,
    { ID: conversation.CONVERSATION_ID }
  );
  console.table(messages.recordset);

  const attachments = await pool.query(
    `SELECT TOP 4 ATTACHMENT_ID, MESSAGE_ID, ORIGINAL_NAME, MIME_TYPE, FILE_SIZE, DELETED_AT
       FROM ZTB_CHAT_ATTACHMENT WHERE CONVERSATION_ID = @ID ORDER BY ATTACHMENT_ID DESC`,
    { ID: conversation.CONVERSATION_ID }
  );
  console.table(attachments.recordset);

  await closePool();
}

main().catch(async (error) => {
  console.error("[inspect] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
