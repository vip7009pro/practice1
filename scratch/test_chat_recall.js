/**
 * Kiểm chứng ĐIỀU KIỆN THU HỒI tin nhắn:
 *  - KHÔNG thu hồi được tin của người khác (kể cả thành viên thường).
 *  - Thu hồi được khi: đối phương CHƯA XEM, hoặc trong vòng 10 phút.
 *  - Quá 10 phút VÀ đã bị xem ⇒ bị từ chối (RECALL_EXPIRED).
 *  - Xoá hàng loạt (recall) bỏ qua các tin không đủ điều kiện (báo `skipped`).
 *
 * CHỈ tạo dữ liệu trong 1 phòng DIRECT MỚI rồi XOÁ VẬT LÝ khi xong.
 * Chạy: node scratch/test_chat_recall.js
 */
const { openConnection, closePool } = require("../config/database");
const roomService = require("../services/chat/chatRoomService");
const repo = require("../services/chat/chatRepository");

let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const captured = [];
const makeRes = () => ({ send: (payload) => captured.push(payload) });
const last = () => captured[captured.length - 1];
const reqFor = (employee) => ({
  payload_data: {
    ...employee,
    CTR_CD: employee.CTR_CD,
    MIDLAST_NAME: employee.MIDLAST_NAME,
    FIRST_NAME: employee.FIRST_NAME,
    EMPL_NO: employee.EMPL_NO,
  },
});

async function findUnusedPair(pool) {
  const emps = (
    await pool.query(
      `SELECT TOP 40 LTRIM(RTRIM(EMPL_NO)) AS EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME
         FROM ZTBEMPLINFO WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 ORDER BY EMPL_NO`
    )
  ).recordset;
  for (const a of emps) {
    for (const b of emps) {
      if (a.EMPL_NO === b.EMPL_NO || a.CTR_CD !== b.CTR_CD) continue;
      const key = repo.buildDirectKey(a.EMPL_NO, b.EMPL_NO);
      const found = await repo.findDirectConversation({ ctrCd: a.CTR_CD, directKey: key });
      if (!found) return { a, b };
    }
  }
  return null;
}

async function cleanupConversation(pool, conversationId) {
  await pool.query(`DELETE FROM ZTB_CHAT_MESSAGE_HIDDEN WHERE MESSAGE_ID IN (SELECT MESSAGE_ID FROM ZTB_CHAT_MESSAGE WHERE CONVERSATION_ID = @id)`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_REACTION WHERE MESSAGE_ID IN (SELECT MESSAGE_ID FROM ZTB_CHAT_MESSAGE WHERE CONVERSATION_ID = @id)`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_ATTACHMENT WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_MESSAGE WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_PARTICIPANT WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_AUDIT WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_CONVERSATION WHERE CONVERSATION_ID = @id`, { id: conversationId });
}

async function send(req, ctrCd, conversationId, content) {
  await roomService.chatSendMessage(req, makeRes(), {
    CTR_CD: ctrCd,
    conversationId,
    content,
    msgType: "TEXT",
  });
  const payload = last();
  if (payload.tk_status !== "OK") throw new Error(payload.message || "send failed");
  return payload.data.message.MESSAGE_ID;
}

async function main() {
  const pool = await openConnection();
  const pair = await findUnusedPair(pool);
  if (!pair) throw new Error("Không tìm được cặp nhân sự chưa từng có hội thoại 1-1");
  const { a, b } = pair;
  const ctrCd = a.CTR_CD;
  console.log(`[test] A=${a.EMPL_NO} B=${b.EMPL_NO} ctr=${ctrCd}`);

  let conversationId = null;
  const reqA = reqFor(a);
  const reqB = reqFor(b);

  try {
    await roomService.chatGetOrCreateDirect(reqA, makeRes(), { CTR_CD: ctrCd, otherEmplNo: b.EMPL_NO });
    conversationId = last().data.CONVERSATION_ID;

    // ---- 1) Không thu hồi được tin của người khác ----
    const m1 = await send(reqA, ctrCd, conversationId, "tin cua A");
    await roomService.chatDeleteMessage(reqB, makeRes(), { CTR_CD: ctrCd, conversationId, messageId: m1 });
    check("B KHÔNG thu hồi được tin của A", last().tk_status === "NG", last().message || "");

    // ---- 2) A thu hồi tin của mình khi B CHƯA XEM ----
    await roomService.chatDeleteMessage(reqA, makeRes(), { CTR_CD: ctrCd, conversationId, messageId: m1 });
    check("A thu hồi tin của mình khi chưa ai xem (OK)", last().tk_status === "OK", last().message || "");

    // ---- 3) Trong 10 phút, dù đã xem vẫn thu hồi được ----
    const m2 = await send(reqA, ctrCd, conversationId, "tin trong 10 phut");
    await roomService.chatMarkRead(reqB, makeRes(), { CTR_CD: ctrCd, conversationId, lastMessageId: m2 });
    await roomService.chatDeleteMessage(reqA, makeRes(), { CTR_CD: ctrCd, conversationId, messageId: m2 });
    check("A thu hồi trong 10 phút dù B đã xem (OK)", last().tk_status === "OK", last().message || "");

    // ---- 4) Quá 10 phút + đã xem ⇒ TỪ CHỐI ----
    const m3 = await send(reqA, ctrCd, conversationId, "tin qua 10 phut");
    await roomService.chatMarkRead(reqB, makeRes(), { CTR_CD: ctrCd, conversationId, lastMessageId: m3 });
    await pool.query(
      `UPDATE ZTB_CHAT_MESSAGE SET CREATED_AT = DATEADD(MINUTE, -11, GETDATE()) WHERE MESSAGE_ID = @id`,
      { id: m3 }
    );
    await roomService.chatDeleteMessage(reqA, makeRes(), { CTR_CD: ctrCd, conversationId, messageId: m3 });
    check(
      "Quá 10 phút & đã xem ⇒ TỪ CHỐI",
      last().tk_status === "NG" && last().code === "RECALL_EXPIRED",
      `${last().code || ""} ${last().message || ""}`
    );

    // ---- 5) Tin cũ nhưng CHƯA XEM ⇒ vẫn thu hồi được ----
    const m4 = await send(reqB, ctrCd, conversationId, "tin cu cua B");
    await pool.query(
      `UPDATE ZTB_CHAT_MESSAGE SET CREATED_AT = DATEADD(MINUTE, -30, GETDATE()) WHERE MESSAGE_ID = @id`,
      { id: m4 }
    );
    // A chưa đọc m4 ⇒ B (chủ tin) thu hồi được dù quá 30 phút
    await roomService.chatDeleteMessage(reqB, makeRes(), { CTR_CD: ctrCd, conversationId, messageId: m4 });
    check("Quá 10 phút nhưng CHƯA XEM ⇒ vẫn thu hồi được", last().tk_status === "OK", last().message || "");

    // ---- 6) Xoá hàng loạt: bỏ qua tin không đủ điều kiện ----
    const mine = await send(reqA, ctrCd, conversationId, "tin moi cua A");
    await roomService.chatDeleteMessages(reqA, makeRes(), {
      CTR_CD: ctrCd,
      conversationId,
      messageIds: [mine, m3],
      mode: "recall",
    });
    const bulk = last();
    check(
      "Xoá hàng loạt chỉ thu hồi tin đủ điều kiện (skipped > 0)",
      bulk.tk_status === "OK" && (bulk.data?.skipped || 0) >= 1,
      `recalled=${bulk.data?.recalled?.length} skipped=${bulk.data?.skipped}`
    );
  } finally {
    if (conversationId) {
      await cleanupConversation(pool, conversationId);
      console.log(`[test] Đã dọn dẹp phòng test ${conversationId}`);
    }
  }

  console.log(`\n[test] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  await closePool();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[test] LỖI:", error);
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
