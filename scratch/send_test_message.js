/**
 * Gửi 1 tin nhắn từ nhân viên khác tới tài khoản đang mở trên trình duyệt
 * (mặc định CMS1179) để kiểm chứng realtime mà KHÔNG cần F5.
 *
 * Chạy: node scratch/send_test_message.js [CMS_ID_cua_trinh_duyet]
 */
const { openConnection, closePool } = require("../config/database");
const roomService = require("../services/chat/chatRoomService");

const run = async () => {
  const targetCmsId = process.argv[2] || "CMS1179";
  const pool = await openConnection();

  const target = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, CMS_ID FROM ZTBEMPLINFO
       WHERE CMS_ID = @CMS_ID AND ISNULL(WORK_STATUS_CODE,0) <> 0`,
      { CMS_ID: targetCmsId }
    )
  ).recordset[0];

  if (!target) throw new Error(`Không tìm thấy nhân viên với CMS_ID=${targetCmsId}`);
  const targetEmplNo = String(target.EMPL_NO).trim().toUpperCase();

  const sender = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME, CMS_ID FROM ZTBEMPLINFO
       WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 AND EMPL_NO <> @EMPL_NO
         AND EMPL_NO <> 'TKD1605' AND EMPL_NO <> 'ANH1304'
       ORDER BY EMPL_NO`,
      { EMPL_NO: target.EMPL_NO }
    )
  ).recordset[0];
  if (!sender) throw new Error("Không tìm được người gửi phù hợp");
  const senderEmplNo = String(sender.EMPL_NO).trim().toUpperCase();

  console.log(`[send] người nhận=${targetEmplNo} (${targetCmsId}) | người gửi=${senderEmplNo}`);

  const captured = [];
  const res = { send: (p) => captured.push(p) };
  const ctrCd = target.CTR_CD;

  // 1) Mở hội thoại 1-1 giữa 2 người (phía người gửi)
  await roomService.chatGetOrCreateDirect(
    { payload_data: { ...sender, CTR_CD: ctrCd, EMPL_NO: senderEmplNo } },
    res,
    { CTR_CD: ctrCd, otherEmplNo: targetEmplNo }
  );
  const conv = captured[captured.length - 1];
  if (conv.tk_status !== "OK") throw new Error(`Không mở được hội thoại: ${conv.message}`);
  const conversationId = conv.data.CONVERSATION_ID;

  // 2) Gửi tin nhắn qua luồng HTTP command (đúng đường fallback khi socket chưa nối)
  await roomService.chatSendMessage(
    { payload_data: { ...sender, CTR_CD: ctrCd, EMPL_NO: senderEmplNo } },
    res,
    {
      CTR_CD: ctrCd,
      conversationId,
      content: `[realtime-test] ${new Date().toLocaleTimeString("vi-VN")} — kiểm chứng không cần F5`,
      clientMessageId: `rt-live-${Date.now()}`,
    }
  );
  const sent = captured[captured.length - 1];
  if (sent.tk_status !== "OK") throw new Error(`Gửi thất bại: ${sent.message}`);

  console.log(`[send] OK conversationId=${conversationId} messageId=${sent.data.message.MESSAGE_ID}`);
  console.log("[send] Yêu cầu: kiểm tra trình duyệt của người nhận — badge chat phải tăng mà KHÔNG reload.");
};

run()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[send] THẤT BẠI:", error?.message || error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
