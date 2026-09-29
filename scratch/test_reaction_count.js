/**
 * Kiểm chứng REACTION có số đếm:
 *  - Thả cùng loại nhiều lần ⇒ count tăng (cho phép "like tim vô hạn").
 *  - Đổi loại ⇒ loại cũ mất, loại mới count = 1.
 *  - Bỏ cảm xúc (reaction = "NONE") ⇒ mất hẳn.
 *  - chatSync trả kèm onlineEmplNos.
 *
 * Chạy: node scratch/test_reaction_count.js
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
       WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 ORDER BY EMPL_NO`
    )
  ).recordset;
  const a = { ...employees[0], EMPL_NO: normalize(employees[0].EMPL_NO) };
  const b = { ...employees[1], EMPL_NO: normalize(employees[1].EMPL_NO) };
  const ctrCd = String(a.CTR_CD).trim();
  console.log(`alice=${a.EMPL_NO} bob=${b.EMPL_NO}`);

  await roomService.chatGetOrCreateDirect(
    { payload_data: { ...a, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, otherEmplNo: b.EMPL_NO }
  );
  const conversationId = last().data.CONVERSATION_ID;

  await roomService.chatSendMessage(
    { payload_data: { ...a, CTR_CD: ctrCd } },
    res,
    {
      CTR_CD: ctrCd,
      conversationId,
      content: "[rx-test] tin để thả cảm xúc",
      clientMessageId: `rx-${Date.now()}`,
    }
  );
  const messageId = last().data.message.MESSAGE_ID;
  console.log(`conversationId=${conversationId} messageId=${messageId}`);

  const react = async (employee, reaction) => {
    await roomService.chatReact({ payload_data: { ...employee, CTR_CD: ctrCd } }, res, {
      CTR_CD: ctrCd,
      conversationId,
      messageId,
      reaction,
    });
    if (last().tk_status !== "OK") throw new Error(`chatReact thất bại: ${last().message}`);
    return last().data.reactions;
  };

  // Alice thả LIKE 3 lần (vô hạn)
  await react(a, "LIKE");
  await react(a, "LIKE");
  const afterThree = await react(a, "LIKE");
  console.log(`LIKE x3 (alice) -> ${JSON.stringify(afterThree.LIKE)}`);
  if (afterThree.LIKE?.count !== 3) throw new Error(`count phải = 3, đang ${afterThree.LIKE?.count}`);
  if (!afterThree.LIKE?.users?.includes(a.EMPL_NO)) throw new Error("thiếu user đã thả");

  // Bob thả LOVE 1 lần
  const afterBob = await react(b, "LOVE");
  console.log(`+ LOVE (bob) -> LIKE=${afterBob.LIKE?.count} LOVE=${afterBob.LOVE?.count}`);
  if (afterBob.LOVE?.count !== 1) throw new Error("LOVE của bob phải = 1");
  if (afterBob.LIKE?.count !== 3) throw new Error("LIKE của alice không được đổi");

  // Alice đổi sang LOVE ⇒ LIKE mất, LOVE = 2 (alice + bob)
  const afterSwitch = await react(a, "LOVE");
  console.log(
    `alice đổi sang LOVE -> LIKE=${afterSwitch.LIKE?.count ?? 0} LOVE=${afterSwitch.LOVE?.count}`
  );
  if (afterSwitch.LIKE) throw new Error("LIKE của alice phải biến mất khi đổi loại");
  if (afterSwitch.LOVE?.count !== 2) throw new Error(`LOVE phải = 2, đang ${afterSwitch.LOVE?.count}`);

  // Alice bỏ cảm xúc
  const afterRemove = await react(a, "NONE");
  console.log(`alice bỏ -> LOVE=${afterRemove.LOVE?.count} users=${JSON.stringify(afterRemove.LOVE?.users)}`);
  if (afterRemove.LOVE?.count !== 1) throw new Error("sau khi bỏ phải còn 1 (của bob)");

  // Trong lịch sử phải thấy đúng số đếm
  await roomService.chatLoadMessages(
    { payload_data: { ...b, CTR_CD: ctrCd } },
    res,
    { CTR_CD: ctrCd, conversationId, limit: 20 }
  );
  const loaded = last().data.messages.find((m) => m.MESSAGE_ID === messageId);
  console.log(`Lịch sử: REACTIONS=${JSON.stringify(loaded?.REACTIONS)}`);
  if (loaded?.REACTIONS?.LOVE?.count !== 1) throw new Error("lịch sử trả sai số đếm");

  // chatSync có onlineEmplNos
  await roomService.chatSync({ payload_data: { ...a, CTR_CD: ctrCd } }, res, { CTR_CD: ctrCd });
  const hasOnlineKey = Object.prototype.hasOwnProperty.call(last().data, "onlineEmplNos");
  console.log(`chatSync.onlineEmplNos tồn tại = ${hasOnlineKey} (${JSON.stringify(last().data.onlineEmplNos)})`);
  if (!hasOnlineKey) throw new Error("chatSync thiếu onlineEmplNos");

  // Dọn dẹp
  await repo.queryRows(
    "UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @C AND DELETED_AT IS NULL",
    { C: conversationId }
  );
  await repo.queryRows(
    "UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @C",
    { C: conversationId }
  );
  console.log("[rx] ===== REACTION COUNT: PASS =====");
}

main()
  .then(async () => { await closePool(); process.exit(0); })
  .catch(async (error) => {
    console.error("[rx] THẤT BẠI:", error?.message || error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
