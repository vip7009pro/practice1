/**
 * Kiểm chứng qua HTTP thật (POST /api):
 *  1. Tắt thông báo THEO TỪNG PHÒNG (chatSetConversationMute) — 10 phút / cho tới khi mở lại / bật lại.
 *  2. Ghim TIN NHẮN (chatPinMessage) + thanh ghim trong chatSync.
 *  3. Trạng thái "đã xem" của từng thành viên (LAST_READ_MESSAGE_ID) và chatMarkRead.
 *
 * Điều kiện: backend đang chạy (mặc định http://localhost:3007/api) và đã chạy
 * `node scripts/migrate_chat_pins_mute.js`.
 *
 * Chạy: node scratch/test_chat_pins_mute.js
 */
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

const API = process.env.CHAT_TEST_API || "http://localhost:3007/api";
const SECRET = "nguyenvanhung";

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

async function callApi(token, command, data = {}) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secureContext: false,
      command,
      DATA: { ...data, token_string: token, COMPANY: "CMS" },
    }),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

function makeToken(ctrCd, emplNo) {
  const payload = JSON.stringify([
    {
      CTR_CD: ctrCd,
      EMPL_NO: emplNo,
      WORK_STATUS_CODE: 1,
      FIRST_NAME: "Test",
      MIDLAST_NAME: "Pin",
    },
  ]);
  return jwt.sign({ payload }, SECRET, { expiresIn: "24h" });
}

async function syncConversations(token, ctrCd) {
  const { status, json } = await callApi(token, "chatSync", { CTR_CD: ctrCd });
  if (String(json.tk_status).toUpperCase() !== "OK") {
    throw new Error(`chatSync lỗi: ${status} ${json.message || ""}`);
  }
  return json.data.conversations || [];
}

async function main() {
  const pool = await openConnection();
  const account = await pool.query(
    `SELECT TOP 1 p.EMPL_NO, p.CTR_CD, p.CONVERSATION_ID
       FROM ZTB_CHAT_PARTICIPANT p
       INNER JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = p.CONVERSATION_ID
      WHERE p.LEFT_AT IS NULL AND c.DELETED_AT IS NULL AND p.CTR_CD = '002'
        AND EXISTS (SELECT 1 FROM ZTB_CHAT_MESSAGE m
                     WHERE m.CONVERSATION_ID = p.CONVERSATION_ID AND m.DELETED_AT IS NULL)
      ORDER BY p.EMPL_NO`
  );
  const account2 = await pool.query(
    `SELECT TOP 1 p.EMPL_NO, p.CTR_CD, p.CONVERSATION_ID
       FROM ZTB_CHAT_PARTICIPANT p
       INNER JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = p.CONVERSATION_ID
      WHERE p.LEFT_AT IS NULL AND c.DELETED_AT IS NULL AND p.CTR_CD = '002'
        AND p.CONVERSATION_ID = @CONVERSATION_ID
      ORDER BY p.EMPL_NO DESC`,
    { CONVERSATION_ID: account.recordset[0]?.CONVERSATION_ID }
  );
  if (!account.recordset[0]) throw new Error("Không tìm thấy phòng chat có tin nhắn");

  const emplNo = String(account.recordset[0].EMPL_NO).trim().toUpperCase();
  const ctrCd = String(account.recordset[0].CTR_CD).trim();
  const conversationId = account.recordset[0].CONVERSATION_ID;
  const peer = account2.recordset[0]
    ? String(account2.recordset[0].EMPL_NO).trim().toUpperCase()
    : null;
  const token = makeToken(ctrCd, emplNo);
  console.log(`[chat-pins-mute] ${emplNo} @ ${ctrCd} · phòng #${conversationId} · peer=${peer}\n`);

  const messageRow = await pool.query(
    `SELECT TOP 1 MESSAGE_ID FROM ZTB_CHAT_MESSAGE
      WHERE CONVERSATION_ID = @CONVERSATION_ID AND DELETED_AT IS NULL
      ORDER BY MESSAGE_ID DESC`,
    { CONVERSATION_ID: conversationId }
  );
  const messageId = messageRow.recordset[0]?.MESSAGE_ID;

  // Dọn trạng thái cũ.
  await pool.query(
    `UPDATE ZTB_CHAT_PARTICIPANT SET MUTED_UNTIL = NULL
      WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo }
  );
  await pool.query(
    `UPDATE ZTB_CHAT_MESSAGE SET PINNED_AT = NULL, PINNED_BY = NULL
      WHERE CONVERSATION_ID = @CONVERSATION_ID`,
    { CONVERSATION_ID: conversationId }
  );

  /* --------------------------- 1. Tắt thông báo --------------------------- */
  console.log("1) Tắt thông báo theo TỪNG phòng");
  const before = await syncConversations(token, ctrCd);
  const target = before.find((c) => c.CONVERSATION_ID === conversationId);
  check("chatSync có trường MUTED_SECONDS_LEFT", before.every((c) => "MUTED_SECONDS_LEFT" in c));
  check("Ban đầu phòng chưa tắt thông báo", target && !target.MUTED_SECONDS_LEFT, String(target?.MUTED_SECONDS_LEFT));

  const mute10 = await callApi(token, "chatSetConversationMute", {
    CTR_CD: ctrCd,
    conversationId,
    mode: "minutes",
    minutes: 10,
  });
  check("Mute 10 phút trả OK", String(mute10.json.tk_status).toUpperCase() === "OK", mute10.json.message || "");
  check(
    "mutedSecondsLeft ≈ 600",
    Math.abs(Number(mute10.json?.data?.mutedSecondsLeft) - 600) <= 5,
    String(mute10.json?.data?.mutedSecondsLeft)
  );

  const afterMute = await syncConversations(token, ctrCd);
  const mutedConv = afterMute.find((c) => c.CONVERSATION_ID === conversationId);
  check("chatSync thấy đang tắt thông báo", mutedConv.MUTED === true);
  check(
    "Số giây còn lại ~600 (không lệch múi giờ)",
    Number(mutedConv.MUTED_SECONDS_LEFT) > 500 && Number(mutedConv.MUTED_SECONDS_LEFT) <= 600,
    String(mutedConv.MUTED_SECONDS_LEFT)
  );
  check("KHÔNG phải chế độ 'cho tới khi mở lại'", mutedConv.MUTED_UNTIL_OPEN === false);

  const muteOpen = await callApi(token, "chatSetConversationMute", {
    CTR_CD: ctrCd,
    conversationId,
    mode: "untilOpen",
  });
  check("Mute 'cho tới khi mở lại' OK", String(muteOpen.json.tk_status).toUpperCase() === "OK");
  const afterOpen = (await syncConversations(token, ctrCd)).find(
    (c) => c.CONVERSATION_ID === conversationId
  );
  check("MUTED_UNTIL_OPEN = true", afterOpen.MUTED_UNTIL_OPEN === true, String(afterOpen.MUTED_SECONDS_LEFT));

  const otherConv = before.find((c) => c.CONVERSATION_ID !== conversationId);
  if (otherConv) {
    const otherAfter = afterMute.find((c) => c.CONVERSATION_ID === otherConv.CONVERSATION_ID);
    check("Phòng KHÁC không bị ảnh hưởng", !otherAfter.MUTED && !otherAfter.MUTED_SECONDS_LEFT);
  }

  const unmute = await callApi(token, "chatSetConversationMute", {
    CTR_CD: ctrCd,
    conversationId,
    mode: "off",
  });
  check("Bật lại thông báo OK", String(unmute.json.tk_status).toUpperCase() === "OK");
  const afterOff = (await syncConversations(token, ctrCd)).find(
    (c) => c.CONVERSATION_ID === conversationId
  );
  check("Đã bật lại (MUTED = false)", afterOff.MUTED === false, String(afterOff.MUTED_SECONDS_LEFT));

  /* ----------------------------- 2. Ghim tin ------------------------------ */
  console.log("\n2) Ghim tin nhắn");
  if (!messageId) {
    check("Có tin nhắn để ghim", false, "phòng không có tin nhắn");
  } else {
    const pin = await callApi(token, "chatPinMessage", {
      CTR_CD: ctrCd,
      conversationId,
      messageId,
      pinned: true,
    });
    check("Ghim trả OK", String(pin.json.tk_status).toUpperCase() === "OK", pin.json.message || "");
    check("Trả về messageId đúng", Number(pin.json?.data?.messageId) === Number(messageId));

    const withPin = (await syncConversations(token, ctrCd)).find(
      (c) => c.CONVERSATION_ID === conversationId
    );
    check("chatSync có mảng PINNED", Array.isArray(withPin.PINNED));
    check("PINNED chứa tin vừa ghim", withPin.PINNED.some((p) => Number(p.MESSAGE_ID) === Number(messageId)));
    check(
      "PINNED có nội dung + người ghim để dựng thanh ghim",
      withPin.PINNED[0] && "CONTENT" in withPin.PINNED[0] && "SENDER_EMPL_NO" in withPin.PINNED[0]
    );

    const unpin = await callApi(token, "chatPinMessage", {
      CTR_CD: ctrCd,
      conversationId,
      messageId,
      pinned: false,
    });
    check("Bỏ ghim OK", String(unpin.json.tk_status).toUpperCase() === "OK");
    const afterUnpin = (await syncConversations(token, ctrCd)).find(
      (c) => c.CONVERSATION_ID === conversationId
    );
    check(
      "PINNED rỗng sau khi bỏ ghim",
      !afterUnpin.PINNED.some((p) => Number(p.MESSAGE_ID) === Number(messageId))
    );

    // Ghim lại để FE có dữ liệu thử.
    await callApi(token, "chatPinMessage", { CTR_CD: ctrCd, conversationId, messageId, pinned: true });
  }

  /* --------------------------- 3. Người đã xem --------------------------- */
  console.log("\n3) Trạng thái đã xem của từng thành viên");
  const withRead = (await syncConversations(token, ctrCd)).find(
    (c) => c.CONVERSATION_ID === conversationId
  );
  check(
    "Mọi thành viên có LAST_READ_MESSAGE_ID",
    withRead.MEMBERS.every((m) => Number.isInteger(Number(m.LAST_READ_MESSAGE_ID)))
  );

  const mark = await callApi(token, "chatMarkRead", {
    CTR_CD: ctrCd,
    conversationId,
    lastMessageId: messageId,
  });
  check("chatMarkRead OK", String(mark.json.tk_status).toUpperCase() === "OK");
  const afterRead = (await syncConversations(token, ctrCd)).find(
    (c) => c.CONVERSATION_ID === conversationId
  );
  const me = afterRead.MEMBERS.find((m) => m.EMPL_NO === emplNo);
  check(
    "LAST_READ_MESSAGE_ID của tôi = tin mới nhất",
    Number(me.LAST_READ_MESSAGE_ID) >= Number(messageId),
    `${me.LAST_READ_MESSAGE_ID} >= ${messageId}`
  );

  await closePool();
  console.log(`\n[chat-pins-mute] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[chat-pins-mute] Lỗi:", error);
  try {
    await closePool();
  } catch {
    /* bỏ qua */
  }
  process.exit(1);
});
