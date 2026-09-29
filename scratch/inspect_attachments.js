/** Kiểm tra attachment đã gắn MESSAGE_ID chưa và tin nhắn tương ứng có hiển thị được không. */
const { openConnection, closePool } = require("../config/database");

(async () => {
  const pool = await openConnection();

  const attachments = (
    await pool.query(
      `SELECT ATTACHMENT_ID, MESSAGE_ID, CONVERSATION_ID, ORIGINAL_NAME, MIME_TYPE, FILE_SIZE,
              UPLOADED_BY, STORAGE_PATH, DELETED_AT
       FROM ZTB_CHAT_ATTACHMENT`
    )
  ).recordset;
  console.log("ATTACHMENTS:");
  attachments.forEach((row) =>
    console.log(
      `  id=${row.ATTACHMENT_ID} messageId=${row.MESSAGE_ID} conv=${row.CONVERSATION_ID} name=${row.ORIGINAL_NAME} size=${row.FILE_SIZE} by=${JSON.stringify(row.UPLOADED_BY)} deleted=${row.DELETED_AT}`
    )
  );

  const messages = (
    await pool.query(
      `SELECT TOP 10 MESSAGE_ID, CONVERSATION_ID, SENDER_EMPL_NO, MSG_TYPE,
              LEFT(ISNULL(CONTENT,''), 40) AS CONTENT, CLIENT_MESSAGE_ID, DELETED_AT
       FROM ZTB_CHAT_MESSAGE ORDER BY MESSAGE_ID DESC`
    )
  ).recordset;
  console.log("MESSAGES (mới nhất):");
  messages.forEach((row) =>
    console.log(
      `  id=${row.MESSAGE_ID} conv=${row.CONVERSATION_ID} from=${JSON.stringify(row.SENDER_EMPL_NO)} type=${row.MSG_TYPE} content=${JSON.stringify(row.CONTENT)} clientId=${row.CLIENT_MESSAGE_ID} deleted=${row.DELETED_AT}`
    )
  );

  await closePool();
})();
