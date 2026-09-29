/**
 * Tạo dữ liệu để kiểm chứng trực quan: 1 tin nhắn có ảnh + 1 tin trả lời có trích dẫn
 * + 1 reaction, giữa tài khoản đang mở trên trình duyệt và một đồng nghiệp.
 *
 * Chạy: node scratch/seed_visual_chat.js [CMS_ID_trinh_duyet] [CMS_ID_doi_tac]
 */
const fs = require("fs");
const path = require("path");
const { openConnection, closePool } = require("../config/database");
const repo = require("../services/chat/chatRepository");
const roomService = require("../services/chat/chatRoomService");

const normalize = (value) => String(value || "").trim().toUpperCase();
const captured = [];
const res = { send: (payload) => captured.push(payload) };
const last = () => captured[captured.length - 1];

async function main() {
  const meCmsId = process.argv[2] || "CMS1179";
  const peerCmsId = process.argv[3] || "CMS0001";

  const pool = await openConnection();
  const employeeRows = (
    await pool.query(
      `SELECT EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME, CMS_ID FROM ZTBEMPLINFO
       WHERE CMS_ID IN (@A, @B)`,
      { A: meCmsId, B: peerCmsId }
    )
  ).recordset;
  const me = employeeRows.find((row) => row.CMS_ID === meCmsId);
  let peer = employeeRows.find((row) => row.CMS_ID === peerCmsId);
  if (!me || !peer) {
    // Fallback: chọn một nhân viên đang làm việc khác để làm đối tác test.
    const fallback = (
      await pool.query(
        `SELECT TOP 5 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME, CMS_ID FROM ZTBEMPLINFO
         WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 AND EMPL_NO <> @EMPL_NO AND CMS_ID IS NOT NULL
         ORDER BY CMS_ID`,
        { EMPL_NO: me ? normalize(me.EMPL_NO) : "" }
      )
    ).recordset;
    peer = fallback[0];
  }
  if (!me || !peer) throw new Error("Không tìm thấy nhân viên theo CMS_ID");

  const ctrCd = String(me.CTR_CD).trim();
  const meNo = normalize(me.EMPL_NO);
  const peerNo = normalize(peer.EMPL_NO);
  console.log(`me=${meNo}(${meCmsId}) peer=${peerNo}(${peerCmsId})`);

  // 1) Mở hội thoại 1-1
  await roomService.chatGetOrCreateDirect(
    { payload_data: { ...me, EMPL_NO: meNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, otherEmplNo: peerNo }
  );
  const conversationId = last().data.CONVERSATION_ID;
  console.log(`conversationId=${conversationId}`);

  // 2) Dùng 1 file ảnh THẬT đang có trong kho chatfiles
  const folder = path.join(__dirname, "..", "outbinary", "chatfiles");
  const files = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((name) => /\.(png|jpg|jpeg)$/i.test(name))
    : [];
  if (files.length === 0) throw new Error("Không có file ảnh nào trong outbinary/chatfiles");

  const fileName = files[0];
  const storagePath = path.join(folder, fileName);
  const size = fs.statSync(storagePath).size;

  const attachment = await repo.insertAttachment({
    conversationId,
    ctrCd,
    originalName: fileName,
    storedName: fileName,
    storagePath,
    mimeType: /\.png$/i.test(fileName) ? "image/png" : "image/jpeg",
    fileSize: size,
    uploadedBy: peerNo,
  });

  // 3) Tin nhắn có ẢNH (không kèm chữ) — gửi từ phía đồng nghiệp
  await roomService.chatSendMessage(
    { payload_data: { ...peer, EMPL_NO: peerNo, CTR_CD: ctrCd } },
    res,
    {
      CTR_CD: ctrCd,
      conversationId,
      content: "",
      clientMessageId: `seed-img-${Date.now()}`,
      attachmentIds: [attachment.ATTACHMENT_ID],
    }
  );
  const imageMessage = last();
  if (imageMessage.tk_status !== "OK") throw new Error(imageMessage.message);
  console.log(
    `Ảnh: MSG_TYPE=${imageMessage.data.message.MSG_TYPE} attachments=${imageMessage.data.message.ATTACHMENTS.length} id=${imageMessage.data.message.MESSAGE_ID}`
  );

  // 4) Tin trả lời có trích dẫn
  await roomService.chatSendMessage(
    { payload_data: { ...me, EMPL_NO: meNo, CTR_CD: ctrCd } },
    res,
    {
      CTR_CD: ctrCd,
      conversationId,
      content: "[seed] Đã nhận ảnh, để tôi kiểm tra nhé",
      replyToMessageId: imageMessage.data.message.MESSAGE_ID,
      clientMessageId: `seed-reply-${Date.now()}`,
    }
  );
  console.log(`Reply: ${last().tk_status}`);

  // 5) Thả cảm xúc lên tin ảnh
  await roomService.chatReact(
    { payload_data: { ...me, EMPL_NO: meNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, conversationId, messageId: imageMessage.data.message.MESSAGE_ID, reaction: "LOVE" }
  );
  console.log(`Reaction: ${last().tk_status}`);

  console.log("=> Mở trình duyệt, vào hội thoại này để kiểm tra hiển thị.");
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("FAIL:", error?.message || error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
