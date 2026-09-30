/** Xoá trạng thái tắt thông báo còn sót sau khi test. Chạy: node scratch/reset_chat_mute.js */
const { openConnection, closePool } = require("../config/database");

(async () => {
  const pool = await openConnection();
  const result = await pool.query(
    `UPDATE ZTB_CHAT_PARTICIPANT SET MUTED_UNTIL = NULL WHERE MUTED_UNTIL IS NOT NULL`
  );
  console.log("Đã bật lại thông báo cho", result.rowsAffected[0], "participant");
  await closePool();
})();
