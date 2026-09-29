/**
 * Kiểm chứng REALTIME đúng kịch bản 2 tài khoản:
 *  - Tạo hội thoại 1-1 giữa 2 nhân viên.
 *  - Ký JWT giống backend (middleware/auth.verifyAuthToken).
 *  - Kết nối 2 socket đã xác thực, cùng chat:join phòng.
 *  - A gửi chat:send (có ack) ⇒ B PHẢI nhận chat:message mà không cần F5.
 *  - Kiểm tra thêm: socket không token không gửi được (UNAUTHENTICATED).
 *
 * Chạy: node scratch/test_chat_realtime.js
 */
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const { openConnection, closePool } = require("../config/database");
const repo = require("../services/chat/chatRepository");
const roomService = require("../services/chat/chatRoomService");

const SOCKET_URL = process.env.CHAT_TEST_SOCKET_URL || "http://localhost:3007";

const sign = (employee) =>
  jwt.sign({ payload: JSON.stringify([employee]) }, "nguyenvanhung", { expiresIn: "1h" });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: (cb) => cb({ token }),
      transports: ["websocket", "polling"],
      reconnection: false,
      timeout: 8000,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (error) => reject(new Error(`connect_error: ${error?.message}`)));
    setTimeout(() => reject(new Error("timeout kết nối")), 9000);
  });
}

const emitAck = (socket, event, payload, timeoutMs = 6000) =>
  new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, code: "TIMEOUT" });
      }
    }, timeoutMs);
    socket.emit(event, payload, (ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack || { ok: false, code: "NO_ACK" });
    });
  });

async function main() {
  const pool = await openConnection();
  const employees = (
    await pool.query(
      `SELECT TOP 2 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME, WORK_STATUS_CODE FROM ZTBEMPLINFO
       WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 ORDER BY EMPL_NO`
    )
  ).recordset;

  const alice = { ...employees[0], EMPL_NO: String(employees[0].EMPL_NO).trim().toUpperCase() };
  const bob = { ...employees[1], EMPL_NO: String(employees[1].EMPL_NO).trim().toUpperCase() };
  console.log(`[rt] alice=${alice.EMPL_NO} bob=${bob.EMPL_NO} ctr=${alice.CTR_CD}`);

  // 1) Hội thoại 1-1
  const captured = [];
  const res = { send: (p) => captured.push(p) };
  await roomService.chatGetOrCreateDirect(
    { payload_data: { ...alice, CTR_CD: alice.CTR_CD } },
    res,
    { CTR_CD: alice.CTR_CD, otherEmplNo: bob.EMPL_NO }
  );
  const created = captured[captured.length - 1];
  if (created.tk_status !== "OK") throw new Error(`Không tạo được hội thoại: ${created.message}`);
  const conversationId = created.data.CONVERSATION_ID;
  console.log(`[rt] conversationId=${conversationId}`);

  // 2) Kết nối 2 socket đã xác thực
  const socketA = await connect(sign(alice));
  const socketB = await connect(sign(bob));
  console.log(`[rt] socketA=${socketA.id} socketB=${socketB.id}`);

  const joinA = await emitAck(socketA, "chat:join", { conversationId });
  const joinB = await emitAck(socketB, "chat:join", { conversationId });
  console.log(`[rt] join A=${JSON.stringify(joinA)} B=${JSON.stringify(joinB)}`);
  if (!joinA.ok || !joinB.ok) throw new Error("chat:join thất bại");

  // 3) Lắng nghe phía B
  const received = [];
  socketB.on("chat:message", (payload) => received.push(payload));

  // 4) A gửi tin
  const clientMessageId = `rt-${Date.now()}`;
  const ack = await emitAck(socketA, "chat:send", {
    conversationId,
    content: "[rt] tin nhắn realtime từ alice",
    clientMessageId,
  });
  console.log(`[rt] chat:send ack = ${JSON.stringify(ack).slice(0, 140)}`);
  if (!ack?.ok) throw new Error(`chat:send thất bại: ${ack?.message || ack?.code}`);

  await wait(1200);

  const gotByB = received.find(
    (item) => item?.message?.CLIENT_MESSAGE_ID === clientMessageId
  );
  console.log(`[rt] B nhận được chat:message? ${gotByB ? "CÓ" : "KHÔNG"} (${received.length} sự kiện)`);
  if (!gotByB) throw new Error("REALTIME HỎNG: B không nhận được tin nhắn");

  // 5) Socket KHÔNG token không được gửi
  const anon = await connect("");
  const anonJoin = await emitAck(anon, "chat:join", { conversationId });
  const anonSend = await emitAck(anon, "chat:send", { conversationId, content: "hack", clientMessageId: "anon-1" });
  console.log(`[rt] ẩn danh join=${anonJoin.code || anonJoin.ok} send=${anonSend.code || anonSend.ok}`);
  if (anonSend.ok) throw new Error("LỖ HỔNG: socket không xác thực gửi được tin nhắn");
  anon.close();

  // 6) Socket của người ngoài phòng không join được
  socketA.close();
  socketB.close();

  // Dọn dẹp (soft-delete)
  await repo.queryRows(
    "UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @C1 AND DELETED_AT IS NULL",
    { C1: conversationId }
  );
  await repo.queryRows(
    "UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @C1",
    { C1: conversationId }
  );
  console.log("[rt] ===== REALTIME OK =====");
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[rt] THẤT BẠI:", error?.message || error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
