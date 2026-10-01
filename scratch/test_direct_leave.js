/**
 * Kiểm chứng: chat DIRECT 1-1 cũng "rời" được như nhóm thường.
 *  - A rời hội thoại ⇒ A không còn thấy phòng; B VẪN thấy phòng và xem được tin nhắn.
 * CHỈ tạo dữ liệu trong 1 phòng DIRECT MỚI rồi XOÁ VẬT LÝ khi xong.
 * Chạy: node scratch/test_direct_leave.js
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
  return (last().data?.conversations || []).map((c) => c.CONVERSATION_ID);
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
    await roomService.chatSendMessage(reqA, makeRes(), {
      CTR_CD: ctrCd,
      conversationId,
      content: "test direct leave",
      msgType: "TEXT",
    });
    check("Chuẩn bị phòng DIRECT có tin nhắn", last().tk_status === "OK", last().message || "");

    // B rời hội thoại
    await roomService.chatLeaveGroup(reqB, makeRes(), { CTR_CD: ctrCd, conversationId });
    check("B rời hội thoại OK (không cần chuyển quyền)", last().tk_status === "OK", last().message || "");

    const listB = await syncIds(reqB, ctrCd);
    const listA = await syncIds(reqA, ctrCd);
    check("B KHÔNG còn thấy phòng", !listB.includes(conversationId));
    check("A VẪN thấy phòng", listA.includes(conversationId));

    await roomService.chatLoadMessages(reqA, makeRes(), { CTR_CD: ctrCd, conversationId });
    const msgs = last().data?.messages || [];
    check("A vẫn xem được tin nhắn trong phòng", msgs.length >= 1, `n=${msgs.length}`);
    const sys = msgs.find((m) => m.MSG_TYPE === "SYSTEM");
    check("Có tin hệ thống báo rời hội thoại", Boolean(sys) && /rời hội thoại/.test(sys.CONTENT || ""), sys?.CONTENT || "");
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
