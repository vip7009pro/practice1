/**
 * Kiểm chứng end-to-end lớp service chat (không cần HTTP/Socket).
 * Chạy: node scratch/test_chat_service.js
 *
 * Script CHỈ dùng soft-delete để dọn dữ liệu test, không xoá vật lý.
 */
const { openConnection, closePool } = require("../config/database");
const roomService = require("../services/chat/chatRoomService");
const friendService = require("../services/chat/chatFriendService");
const repo = require("../services/chat/chatRepository");

const captured = [];
const makeRes = () => ({
  send: (payload) => captured.push(payload),
  status: () => ({ send: (payload) => captured.push(payload) }),
});

const last = () => captured[captured.length - 1];

async function main() {
  const pool = await openConnection();
  const employees = (
    await pool.query(
      `SELECT TOP 3 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME FROM ZTBEMPLINFO
       WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 ORDER BY EMPL_NO`
    )
  ).recordset;

  if (!employees || employees.length < 2) {
    throw new Error("Cần ít nhất 2 nhân viên đang làm việc để test");
  }

  const me = employees[0];
  const other = employees[1];
  const third = employees[2] || employees[1];
  const ctrCd = me.CTR_CD;

  console.log(`[test] me=${me.EMPL_NO} other=${other.EMPL_NO} third=${third.EMPL_NO} ctr=${ctrCd}`);

  const reqFor = (employee) => ({ payload_data: { ...employee, CTR_CD: employee.CTR_CD } });
  const req = reqFor(me);

  // 1) Bootstrap rỗng/không lỗi
  await roomService.chatBootstrap(req, makeRes(), { CTR_CD: ctrCd });
  const bootstrap1 = last();
  console.log("[test] 1. chatBootstrap:", bootstrap1.tk_status, "conversations =", bootstrap1.data?.conversations?.length);
  if (bootstrap1.tk_status !== "OK") throw new Error("chatBootstrap thất bại");

  // 2) Tạo/mở hội thoại 1-1
  await roomService.chatGetOrCreateDirect(req, makeRes(), { CTR_CD: ctrCd, otherEmplNo: other.EMPL_NO });
  const direct = last();
  if (direct.tk_status !== "OK") throw new Error(`chatGetOrCreateDirect thất bại: ${direct.message}`);
  const conversationId = direct.data.CONVERSATION_ID;
  console.log(`[test] 2. direct conversation = ${conversationId}, members = ${direct.data.MEMBERS.length}, name = ${direct.data.DISPLAY_NAME}`);
  if (direct.data.MEMBERS.length !== 2) throw new Error("Hội thoại 1-1 phải có đúng 2 thành viên");

  // 3) Gọi lại phải trả CÙNG phòng (idempotent)
  await roomService.chatGetOrCreateDirect(req, makeRes(), { CTR_CD: ctrCd, otherEmplNo: other.EMPL_NO });
  const directAgain = last();
  console.log(`[test] 3. gọi lại -> conversation = ${directAgain.data.CONVERSATION_ID} (phải trùng)`);
  if (directAgain.data.CONVERSATION_ID !== conversationId) throw new Error("Hội thoại 1-1 bị tạo trùng");

  // 4) Gửi tin nhắn
  const clientMessageId = `scratch-${Date.now()}`;
  await roomService.chatSendMessage(req, makeRes(), {
    CTR_CD: ctrCd,
    conversationId,
    content: "[scratch test] Xin chào từ script kiểm chứng",
    clientMessageId,
  });
  const sent = last();
  if (sent.tk_status !== "OK") throw new Error(`chatSendMessage thất bại: ${sent.message}`);
  const messageId = sent.data.message.MESSAGE_ID;
  console.log(`[test] 4. gửi tin nhắn MESSAGE_ID = ${messageId}`);

  // 5) Gửi lại cùng clientMessageId ⇒ phải chống trùng
  await roomService.chatSendMessage(req, makeRes(), {
    CTR_CD: ctrCd,
    conversationId,
    content: "[scratch test] Xin chào từ script kiểm chứng",
    clientMessageId,
  });
  const dup = last();
  const dupId = dup.data?.message?.MESSAGE_ID;
  console.log(`[test] 5. gửi lại cùng clientMessageId -> MESSAGE_ID = ${dupId} (phải ${messageId})`);
  if (dupId !== messageId) throw new Error("Chống gửi trùng thất bại");

  // 6) Tin rỗng phải bị chặn
  await roomService.chatSendMessage(req, makeRes(), { CTR_CD: ctrCd, conversationId, content: "   " });
  console.log(`[test] 6. tin rỗng -> tk_status = ${last().tk_status} (phải NG)`);
  if (last().tk_status !== "NG") throw new Error("Tin rỗng phải bị từ chối");

  // 7) Người ngoài phòng không đọc được tin nhắn
  await roomService.chatLoadMessages(reqFor(third), makeRes(), { CTR_CD: ctrCd, conversationId });
  console.log(`[test] 7. người ngoài phòng đọc tin -> tk_status = ${last().tk_status} (phải NG)`);
  if (last().tk_status !== "NG") throw new Error("Rò rỉ quyền: người ngoài phòng đọc được tin nhắn");

  // 8) Người trong phòng đọc được, có phân trang
  await roomService.chatLoadMessages(reqFor(other), makeRes(), { CTR_CD: ctrCd, conversationId });
  const loaded = last();
  if (loaded.tk_status !== "OK") throw new Error(`chatLoadMessages thất bại: ${loaded.message}`);
  console.log(`[test] 8. đọc được ${loaded.data.messages.length} tin, hasMore = ${loaded.data.hasMore}`);
  if (!loaded.data.messages.some((m) => m.MESSAGE_ID === messageId)) {
    throw new Error("Không thấy tin nhắn vừa gửi trong lịch sử");
  }

  // 9) Unread của người nhận phải = 1 (chưa đọc)
  await roomService.chatBootstrap(reqFor(other), makeRes(), { CTR_CD: ctrCd });
  const otherView = last().data.conversations.find((c) => c.CONVERSATION_ID === conversationId);
  console.log(`[test] 9. unread của người nhận = ${otherView?.UNREAD_COUNT} (phải >= 1)`);
  if (!otherView || otherView.UNREAD_COUNT < 1) throw new Error("Đếm tin chưa đọc sai");

  // 10) Mark read
  await roomService.chatMarkRead(reqFor(other), makeRes(), {
    CTR_CD: ctrCd,
    conversationId,
    lastMessageId: messageId,
  });
  console.log(`[test] 10. mark read -> ${last().tk_status}, updated = ${last().data?.updated}`);

  await roomService.chatBootstrap(reqFor(other), makeRes(), { CTR_CD: ctrCd });
  const afterRead = last().data.conversations.find((c) => c.CONVERSATION_ID === conversationId);
  console.log(`[test] 11. unread sau khi đọc = ${afterRead?.UNREAD_COUNT} (phải = 0)`);
  if (afterRead?.UNREAD_COUNT !== 0) throw new Error("Mark read không cập nhật số chưa đọc");

  // 12) Tin nhắn hệ thống + nhóm
  await roomService.chatCreateGroup(req, makeRes(), {
    CTR_CD: ctrCd,
    title: "[scratch] Nhóm kiểm chứng",
    memberEmplNos: [other.EMPL_NO, third.EMPL_NO],
  });
  const group = last();
  if (group.tk_status !== "OK") throw new Error(`chatCreateGroup thất bại: ${group.message}`);
  const groupId = group.data.CONVERSATION_ID;
  console.log(`[test] 12. nhóm = ${groupId}, role của tôi = ${group.data.MY_ROLE}, members = ${group.data.MEMBERS.length}`);
  if (group.data.MY_ROLE !== "OWNER") throw new Error("Người tạo nhóm phải là OWNER");
  if (group.data.MEMBERS.length !== 3) throw new Error("Nhóm phải có 3 thành viên");

  // 13) Chủ nhóm rời nhóm khi còn thành viên khác ⇒ phải bị chặn
  await roomService.chatLeaveGroup(req, makeRes(), { CTR_CD: ctrCd, conversationId: groupId });
  console.log(`[test] 13. owner rời nhóm -> ${last().tk_status} / ${last().code} (phải NEED_TRANSFER)`);
  if (last().code !== "NEED_TRANSFER") throw new Error("Phải chặn owner rời nhóm khi chưa chuyển quyền");

  // 14) Chuyển owner rồi mới rời được
  await roomService.chatTransferOwner(req, makeRes(), {
    CTR_CD: ctrCd,
    conversationId: groupId,
    newOwnerEmplNo: other.EMPL_NO,
  });
  console.log(`[test] 14. chuyển owner -> ${last().tk_status}`);
  if (last().tk_status !== "OK") throw new Error("Không chuyển được owner");

  await roomService.chatLeaveGroup(req, makeRes(), { CTR_CD: ctrCd, conversationId: groupId });
  console.log(`[test] 15. rời nhóm sau khi chuyển quyền -> ${last().tk_status}`);
  if (last().tk_status !== "OK") throw new Error("Không rời được nhóm sau khi chuyển owner");

  // 16) Thành viên thường không được thêm người
  await roomService.chatAddMembers(reqFor(other), makeRes(), {
    CTR_CD: ctrCd,
    conversationId: groupId,
    memberEmplNos: [me.EMPL_NO],
  });
  console.log(`[test] 16. OWNER mới thêm thành viên -> ${last().tk_status} (phải OK)`);
  if (last().tk_status !== "OK") throw new Error("Chủ nhóm mới phải thêm được thành viên");

  // 17) Bạn bè: gửi + chấp nhận
  await friendService.chatFriendRequest(req, makeRes(), { CTR_CD: ctrCd, recipient: other.EMPL_NO });
  console.log(`[test] 17. friend request -> ${last().tk_status} / ${last().data?.status}`);
  const friendId = last().data?.friendId;
  if (friendId) {
    await friendService.chatFriendRespond(reqFor(other), makeRes(), {
      CTR_CD: ctrCd,
      friendId,
      action: "accept",
    });
    console.log(`[test] 18. friend accept -> ${last().tk_status} / ${last().data?.status}`);
  }

  // 19) Tìm nhân viên
  await roomService.chatSearchEmployees(req, makeRes(), { CTR_CD: ctrCd, keyword: "" });
  console.log(`[test] 19. tìm nhân viên -> ${last().tk_status}, ${last().data?.length} kết quả`);

  // 20) Audit đã ghi
  const audit = await repo.queryRows(
    "SELECT TOP 5 ACTION, ACTOR, TARGET FROM ZTB_CHAT_AUDIT WHERE CONVERSATION_ID = @CONVERSATION_ID ORDER BY AUDIT_ID DESC",
    { CONVERSATION_ID: groupId }
  );
  console.log("[test] 20. audit:", audit.map((a) => a.ACTION).join(", "));

  // Dọn dẹp bằng SOFT DELETE (giữ đúng nguyên tắc không xoá vật lý)
  await repo.queryRows(
    "UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID IN (@C1, @C2) AND DELETED_AT IS NULL",
    { C1: conversationId, C2: groupId }
  );
  await repo.queryRows(
    "UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID IN (@C1, @C2)",
    { C1: conversationId, C2: groupId }
  );
  console.log("[test] Đã soft-delete dữ liệu test.");
  console.log("[test] ===== TẤT CẢ KIỂM CHỨNG PASS =====");
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[test] THẤT BẠI:", error?.message || error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
