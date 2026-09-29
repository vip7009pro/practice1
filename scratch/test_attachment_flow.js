/**
 * Kiểm chứng ĐÍNH KÈM: gửi tin có file ⇒ payload trả về phải kèm ATTACHMENTS
 * (trước đây thiếu nên ảnh/file không hiển thị cho tới khi F5).
 *
 * Chạy: node scratch/test_attachment_flow.js
 */
const { openConnection, closePool } = require("../config/database");
const repo = require("../services/chat/chatRepository");
const roomService = require("../services/chat/chatRoomService");

const normalize = (value) => String(value || "").trim().toUpperCase();
const captured = [];
const res = { send: (payload) => captured.push(payload) };
const last = () => captured[captured.length - 1];

async function main() {
  const pool = await openConnection();
  const employees = (
    await pool.query(
      `SELECT TOP 2 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME FROM ZTBEMPLINFO
       WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 AND CMS_ID IN ('CMS1179','CMS0001')
       ORDER BY CMS_ID`
    )
  ).recordset;
  const me = employees[0];
  const other = employees[1] || employees[0];
  const ctrCd = String(me.CTR_CD).trim();
  const meNo = normalize(me.EMPL_NO);
  const otherNo = normalize(other.EMPL_NO);
  console.log(`me=${meNo} other=${otherNo}`);

  // 1) Mở hội thoại 1-1
  await roomService.chatGetOrCreateDirect(
    { payload_data: { ...me, EMPL_NO: meNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, otherEmplNo: otherNo }
  );
  const conversationId = last().data.CONVERSATION_ID;
  console.log(`conversationId=${conversationId}`);

  // 2) Giả lập upload: tạo attachment chưa gắn tin (đúng như /chatfile làm)
  const attachment = await repo.insertAttachment({
    conversationId,
    ctrCd,
    originalName: "[test] anh-minh-hoa.png",
    storedName: "test-stored.png",
    storagePath: "G:\\NODEJS\\practice1\\outbinary\\chatfiles\\test-stored.png",
    mimeType: "image/png",
    fileSize: 1234,
    uploadedBy: meNo,
  });
  console.log(`attachmentId=${attachment.ATTACHMENT_ID}`);

  // 3) Gửi tin CHỈ có file (không kèm chữ) ⇒ MSG_TYPE phải là IMAGE và có ATTACHMENTS
  await roomService.chatSendMessage(
    { payload_data: { ...me, EMPL_NO: meNo, CTR_CD: ctrCd } },
    res,
    {
      CTR_CD: ctrCd,
      conversationId,
      content: "",
      clientMessageId: `att-${Date.now()}`,
      attachmentIds: [attachment.ATTACHMENT_ID],
    }
  );
  const sent = last();
  if (sent.tk_status !== "OK") throw new Error(`Gửi thất bại: ${sent.message}`);

  const sentMessage = sent.data.message;
  console.log(
    `Gửi xong: MSG_TYPE=${sentMessage.MSG_TYPE} attachments=${sentMessage.ATTACHMENTS.length} reactions=${Object.keys(sentMessage.REACTIONS).length}`
  );
  if (sentMessage.ATTACHMENTS.length !== 1) throw new Error("Payload gửi thiếu ATTACHMENTS ⇒ ảnh sẽ không hiển thị");
  if (sentMessage.MSG_TYPE !== "IMAGE") throw new Error(`MSG_TYPE phải là IMAGE, đang là ${sentMessage.MSG_TYPE}`);

  // 4) Tải lịch sử ⇒ vẫn phải có đính kèm
  await roomService.chatLoadMessages(
    { payload_data: { ...other, EMPL_NO: otherNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, conversationId, limit: 20 }
  );
  const loaded = last();
  const found = loaded.data.messages.find((m) => m.MESSAGE_ID === sentMessage.MESSAGE_ID);
  console.log(`Lịch sử: tìm thấy tin? ${found ? "CÓ" : "KHÔNG"} attachments=${found?.ATTACHMENTS?.length ?? "?"}`);
  if (!found || found.ATTACHMENTS.length !== 1) throw new Error("Lịch sử thiếu đính kèm");

  // 5) Reaction + reply + ẩn tin
  await roomService.chatReact(
    { payload_data: { ...other, EMPL_NO: otherNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, conversationId, messageId: sentMessage.MESSAGE_ID, reaction: "LOVE" }
  );
  console.log(`chatReact: ${last().tk_status} reaction=${last().data?.reaction} removed=${last().data?.removed}`);

  await roomService.chatSendMessage(
    { payload_data: { ...other, EMPL_NO: otherNo, CTR_CD: ctrCd } },
    res,
    {
      CTR_CD: ctrCd,
      conversationId,
      content: "[test] trả lời tin có ảnh",
      replyToMessageId: sentMessage.MESSAGE_ID,
      clientMessageId: `reply-${Date.now()}`,
    }
  );
  const replied = last();
  console.log(
    `Reply: ${replied.tk_status} REPLY_TO=${JSON.stringify(replied.data?.message?.REPLY_TO?.PREVIEW)}`
  );
  if (!replied.data?.message?.REPLY_TO) throw new Error("Thiếu nội dung trích dẫn khi reply");

  // 6) Xoá phía tôi ⇒ người ẩn không thấy, người kia vẫn thấy
  await roomService.chatHideMessage(
    { payload_data: { ...other, EMPL_NO: otherNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, conversationId, messageId: sentMessage.MESSAGE_ID }
  );
  if (last().tk_status !== "OK") throw new Error("chatHideMessage thất bại");

  await roomService.chatLoadMessages(
    { payload_data: { ...other, EMPL_NO: otherNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, conversationId, limit: 50 }
  );
  const hiddenGone = !last().data.messages.some((m) => m.MESSAGE_ID === sentMessage.MESSAGE_ID);

  await roomService.chatLoadMessages(
    { payload_data: { ...me, EMPL_NO: meNo, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, conversationId, limit: 50 }
  );
  const stillVisibleForMe = last().data.messages.some((m) => m.MESSAGE_ID === sentMessage.MESSAGE_ID);

  console.log(`Xoá phía tôi: ẩn với người xoá=${hiddenGone}, vẫn thấy với người kia=${stillVisibleForMe}`);
  if (!hiddenGone || !stillVisibleForMe) throw new Error("Xoá phía tôi sai hành vi");

  // Dọn dẹp (soft-delete)
  await repo.queryRows(
    "UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @C AND DELETED_AT IS NULL",
    { C: conversationId }
  );
  await repo.queryRows(
    "UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @C",
    { C: conversationId }
  );
  console.log("[att] ===== ĐÍNH KÈM / REPLY / REACTION / XOÁ 1 PHÍA: PASS =====");
}

main()
  .then(async () => { await closePool(); process.exit(0); })
  .catch(async (error) => {
    console.error("[att] THẤT BẠI:", error?.message || error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
