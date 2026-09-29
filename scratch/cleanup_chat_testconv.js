/**
 * Dọn các phòng chat tạo ra trong lúc kiểm thử (Đợt 22.7):
 *  - Nhóm có tiêu đề chỉ định.
 *  - Hội thoại 1-1 với các mã nhân viên chỉ định.
 *
 *   node scratch/cleanup_chat_testconv.js
 */
const { openConnection, closePool } = require("../config/database");

const TITLES = ["Nhóm kiểm thử tag tên", "Nhóm kiểm thử bộ lọc"];
const EMPL_KEYS = ["TKD1605"];

async function main() {
  const pool = await openConnection();

  const params = {};
  const conditions = [];
  TITLES.forEach((title, index) => {
    params[`T${index}`] = title;
    conditions.push(`TITLE = @T${index}`);
  });
  EMPL_KEYS.forEach((key, index) => {
    params[`K${index}`] = `%${key}%`;
    conditions.push(`DIRECT_KEY LIKE @K${index}`);
  });

  const rows = (
    await pool.query(
      `SELECT CONVERSATION_ID, CONV_TYPE, TITLE, DIRECT_KEY
         FROM ZTB_CHAT_CONVERSATION
        WHERE (${conditions.join(" OR ")}) AND DELETED_AT IS NULL`,
      params
    )
  ).recordset;

  if (rows.length === 0) {
    console.log("[cleanup-testconv] không có phòng nào cần dọn");
    await closePool();
    return;
  }

  for (const conversation of rows) {
    const id = conversation.CONVERSATION_ID;
    await pool.query(
      `UPDATE ZTB_CHAT_ATTACHMENT SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @ID AND DELETED_AT IS NULL`,
      { ID: id }
    );
    await pool.query(
      `UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @ID AND DELETED_AT IS NULL`,
      { ID: id }
    );
    await pool.query(
      `UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @ID`,
      { ID: id }
    );
    console.log(`[cleanup-testconv] đã dọn phòng ${id} (${conversation.CONV_TYPE}) ${conversation.TITLE || conversation.DIRECT_KEY || ""}`);
  }

  await closePool();
}

main().catch(async (error) => {
  console.error("[cleanup-testconv] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
