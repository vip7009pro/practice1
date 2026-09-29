/** Dọn dữ liệu test chat bằng SOFT-DELETE (giữ nguyên nguyên tắc không xoá vật lý). */
const { openConnection, closePool } = require("../config/database");

(async () => {
  const pool = await openConnection();
  const conversations = await pool.query("SELECT CONVERSATION_ID FROM ZTB_CHAT_CONVERSATION");
  const ids = (conversations.recordset || []).map((row) => row.CONVERSATION_ID);
  console.log("conversations:", ids.join(",") || "(none)");

  await pool.query("UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE() WHERE DELETED_AT IS NULL");
  await pool.query("UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE DELETED_AT IS NULL");
  await pool.query("UPDATE ZTB_CHAT_PARTICIPANT SET LEFT_AT = GETDATE() WHERE LEFT_AT IS NULL");
  await pool.query("UPDATE ZTB_CHAT_FRIEND SET STATUS = 'CANCELLED' WHERE STATUS = 'PENDING'");
  console.log("đã soft-delete dữ liệu test");
  await closePool();
})();
