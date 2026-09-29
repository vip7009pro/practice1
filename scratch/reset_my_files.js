/**
 * Dọn phòng "My Files" của 1 nhân viên (dùng sau khi test):
 *  - Soft-delete mọi tin nhắn + tệp đính kèm trong phòng.
 *  - Xoá file vật lý trong outbinary/chatfiles.
 *  - Đặt lại con trỏ tin nhắn cuối để danh sách không hiện "[Hình ảnh]"/"đã thu hồi".
 *
 *   node scratch/reset_my_files.js [EMPL_NO]
 */
const fs = require("fs");
const repo = require("../services/chat/chatRepository");
const { openConnection, closePool } = require("../config/database");

async function main() {
  const emplNo = String(process.argv[2] || "NHU1903").trim().toUpperCase();
  const pool = await openConnection();
  const employee = (
    await pool.query(`SELECT TOP 1 EMPL_NO, CTR_CD FROM ZTBEMPLINFO WHERE EMPL_NO = @EMPL_NO`, {
      EMPL_NO: emplNo,
    })
  ).recordset[0];
  if (!employee) throw new Error(`Không tìm thấy ${emplNo}`);

  const ctrCd = String(employee.CTR_CD).trim();
  const conversation = await repo.ensureSelfConversation({ ctrCd, emplNo });
  const conversationId = conversation.CONVERSATION_ID;
  console.log(`[reset-my-files] phòng ${conversationId} của ${emplNo}`);

  const paths = (
    await pool.query(
      `SELECT STORAGE_PATH FROM ZTB_CHAT_ATTACHMENT
        WHERE CONVERSATION_ID = @CID AND DELETED_AT IS NULL`,
      { CID: conversationId }
    )
  ).recordset.map((row) => row.STORAGE_PATH);

  await pool.query(
    `UPDATE ZTB_CHAT_ATTACHMENT SET DELETED_AT = GETDATE()
      WHERE CONVERSATION_ID = @CID AND DELETED_AT IS NULL`,
    { CID: conversationId }
  );
  await pool.query(
    `UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE()
      WHERE CONVERSATION_ID = @CID AND DELETED_AT IS NULL`,
    { CID: conversationId }
  );
  await pool.query(
    `UPDATE ZTB_CHAT_CONVERSATION
        SET LAST_MESSAGE_ID = NULL, LAST_MESSAGE_AT = NULL, UPDATED_AT = GETDATE()
      WHERE CONVERSATION_ID = @CID`,
    { CID: conversationId }
  );

  let removed = 0;
  for (const file of paths) {
    try {
      await fs.promises.unlink(file);
      removed += 1;
    } catch {
      /* file có thể đã bị xoá trước đó */
    }
  }

  console.log(`[reset-my-files] đã đóng mềm tin nhắn/tệp, xoá ${removed}/${paths.length} file vật lý`);
  await closePool();
}

main().catch(async (error) => {
  console.error("[reset-my-files] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
