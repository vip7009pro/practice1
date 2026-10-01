/**
 * Kiểm chứng các tính năng chat MỚI (không cần HTTP/Socket):
 *   1) Phòng DIRECT mới tạo nhưng CHƯA gõ tin ⇒ chỉ người tạo thấy (HIDDEN).
 *   2) Tin nhắn đầu tiên ⇒ mở phòng cho cả hai.
 *   3) "Xoá phòng chat" theo người: ẩn lịch sử + ẩn khỏi danh sách cho tới khi có tin mới.
 *   4) Xoá hàng loạt: "hide" (ẩn phía tôi) và "recall" (thu hồi 2 phía).
 *   5) Tên DIRECT hiển thị `TÊN [BỘ PHẬN]` (không còn MAINDEPT).
 *   6) Lọc "Link" trong tìm kiếm.
 *
 * ⚠️ CHỈ tạo dữ liệu test trong 1 phòng DIRECT MỚI (chưa từng tồn tại giữa 2 người được chọn)
 *    rồi XOÁ VẬT LÝ toàn bộ dữ liệu đó khi kết thúc. KHÔNG đụng dữ liệu production khác.
 *
 * Chạy: node scratch/test_chat_delete_hidden.js
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
  await pool.query(
    `DELETE FROM ZTB_CHAT_MESSAGE_HIDDEN WHERE MESSAGE_ID IN
       (SELECT MESSAGE_ID FROM ZTB_CHAT_MESSAGE WHERE CONVERSATION_ID = @id)`,
    { id: conversationId }
  );
  await pool.query(
    `DELETE FROM ZTB_CHAT_REACTION WHERE MESSAGE_ID IN
       (SELECT MESSAGE_ID FROM ZTB_CHAT_MESSAGE WHERE CONVERSATION_ID = @id)`,
    { id: conversationId }
  );
  await pool.query(`DELETE FROM ZTB_CHAT_ATTACHMENT WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_MESSAGE WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_PARTICIPANT WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_AUDIT WHERE CONVERSATION_ID = @id`, { id: conversationId });
  await pool.query(`DELETE FROM ZTB_CHAT_CONVERSATION WHERE CONVERSATION_ID = @id`, { id: conversationId });
}

async function syncIds(req, ctrCd) {
  await roomService.chatSync(req, makeRes(), { CTR_CD: ctrCd });
  const payload = last();
  return (payload.data?.conversations || []).map((c) => c.CONVERSATION_ID);
}

async function listIds(req, ctrCd, conversationId) {
  await roomService.chatLoadMessages(req, makeRes(), { CTR_CD: ctrCd, conversationId });
  return (last().data?.messages || []).map((m) => m.MESSAGE_ID);
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
    // ---- 1) Tạo DIRECT mới, chưa gõ tin ----
    await roomService.chatGetOrCreateDirect(reqA, makeRes(), { CTR_CD: ctrCd, otherEmplNo: b.EMPL_NO });
    const created = last();
    check("Tạo DIRECT thành công", created.tk_status === "OK", created.message || "");
    conversationId = created.data.CONVERSATION_ID;
    check("Tên phòng A thấy là TÊN + [BỘ PHẬN]", /\[[^\]]+\]$/.test(created.data.DISPLAY_NAME), created.data.DISPLAY_NAME);
    check("Tên KHÔNG còn 2 dấu ngoặc [X]-[Y]", !/\]\s*-\s*\[/.test(created.data.DISPLAY_NAME), created.data.DISPLAY_NAME);

    const listA1 = await syncIds(reqA, ctrCd);
    const listB1 = await syncIds(reqB, ctrCd);
    check("A THẤY phòng rỗng vừa tạo", listA1.includes(conversationId));
    check("B KHÔNG thấy phòng rỗng", !listB1.includes(conversationId));

    // ---- 2) Tin nhắn đầu tiên ⇒ mở cho cả hai ----
    await roomService.chatSendMessage(reqA, makeRes(), {
      CTR_CD: ctrCd,
      conversationId,
      content: "hello test",
      msgType: "TEXT",
    });
    check("Gửi tin đầu tiên OK", last().tk_status === "OK", last().message || "");
    const listB2 = await syncIds(reqB, ctrCd);
    check("B THẤY phòng sau tin đầu tiên", listB2.includes(conversationId));

    // ---- 5) Lọc Link ----
    await roomService.chatSendMessage(reqA, makeRes(), {
      CTR_CD: ctrCd,
      conversationId,
      content: "xem https://vnexpress.net nhe",
      msgType: "TEXT",
    });
    await roomService.chatSearchMessages(reqA, makeRes(), { CTR_CD: ctrCd, conversationId, hasLink: true });
    const links = last().data?.results || [];
    check("Lọc Link chỉ trả tin có URL", links.length === 1 && /https:\/\//.test(links[0].CONTENT || ""), `n=${links.length}`);

    // ---- 4) Xoá hàng loạt ----
    const ids = await listIds(reqA, ctrCd, conversationId);
    check("Có >= 2 tin để test xoá", ids.length >= 2, `n=${ids.length}`);
    const [first, second] = ids;

    await roomService.chatDeleteMessages(reqA, makeRes(), {
      CTR_CD: ctrCd,
      conversationId,
      messageIds: [first],
      mode: "hide",
    });
    check("chatDeleteMessages hide OK", last().tk_status === "OK", last().message || "");
    const afterHideA = await listIds(reqA, ctrCd, conversationId);
    const afterHideB = await listIds(reqB, ctrCd, conversationId);
    check("A KHÔNG còn thấy tin đã ẩn", !afterHideA.includes(first));
    check("B VẪN thấy tin đó", afterHideB.includes(first));

    await roomService.chatDeleteMessages(reqA, makeRes(), {
      CTR_CD: ctrCd,
      conversationId,
      messageIds: [second],
      mode: "recall",
    });
    check("chatDeleteMessages recall OK", last().tk_status === "OK", last().message || "");
    const afterRecallB = await listIds(reqB, ctrCd, conversationId);
    check("B thấy tin đã thu hồi (còn id, mất nội dung)",
      afterRecallB.includes(second));
    await roomService.chatLoadMessages(reqB, makeRes(), { CTR_CD: ctrCd, conversationId });
    const recalledMsg = (last().data?.messages || []).find((m) => m.MESSAGE_ID === second);
    check("Tin thu hồi có DELETED_AT", Boolean(recalledMsg?.DELETED_AT));

    // ---- 3) Xoá phòng chat theo người ----
    await roomService.chatDeleteConversation(reqA, makeRes(), { CTR_CD: ctrCd, conversationId });
    check("chatDeleteConversation OK", last().tk_status === "OK", last().message || "");
    const listA3 = await syncIds(reqA, ctrCd);
    const listB3 = await syncIds(reqB, ctrCd);
    check("A KHÔNG còn thấy phòng sau khi xoá", !listA3.includes(conversationId));
    check("B VẪN thấy phòng", listB3.includes(conversationId));
    const msgsA3 = await listIds(reqA, ctrCd, conversationId);
    check("A không xem được tin cũ (đã xoá phòng)", msgsA3.length === 0, `n=${msgsA3.length}`);

    // ---- Tin MỚI sau khi xoá ⇒ phòng hiện lại cho A ----
    await roomService.chatSendMessage(reqB, makeRes(), {
      CTR_CD: ctrCd,
      conversationId,
      content: "tin moi sau khi xoa",
      msgType: "TEXT",
    });
    const listA4 = await syncIds(reqA, ctrCd);
    check("A THẤY LẠI phòng khi có tin mới", listA4.includes(conversationId));
    const msgsA4 = await listIds(reqA, ctrCd, conversationId);
    check("A chỉ thấy tin MỚI (không thấy tin cũ)", msgsA4.length === 1, `n=${msgsA4.length}`);
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
