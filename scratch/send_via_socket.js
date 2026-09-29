/**
 * Gửi tin nhắn tới server ĐANG CHẠY bằng socket client (giống 1 user thật khác),
 * để server tự phát realtime tới mọi thành viên.
 *
 * Chạy: node scratch/send_via_socket.js [EMPL_NO_nguoi_nhan] [URL]
 */
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const { openConnection, closePool } = require("../config/database");
const repo = require("../services/chat/chatRepository");

const SOCKET_URL = process.argv[3] || "http://localhost:3007";
const sign = (employee) =>
  jwt.sign({ payload: JSON.stringify([employee]) }, "nguyenvanhung", { expiresIn: "1h" });

const emitAck = (socket, event, payload, timeoutMs = 8000) =>
  new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve({ ok: false, code: "TIMEOUT" }); }
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
      `SELECT TOP 2 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME FROM ZTBEMPLINFO
       WHERE CMS_ID = @CMS_ID1 OR CMS_ID = @CMS_ID2 ORDER BY EMPL_NO`,
      { CMS_ID1: process.argv[2] || "CMS1179", CMS_ID2: "CMS1179" }
    )
  ).recordset;
  const receiver = employees[0];

  const sender = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME FROM ZTBEMPLINFO
       WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 AND EMPL_NO NOT IN (@A, @B)
       ORDER BY EMPL_NO`,
      { A: String(receiver.EMPL_NO).trim(), B: String(receiver.EMPL_NO).trim() }
    )
  ).recordset[0];

  const receiverNo = String(receiver.EMPL_NO).trim().toUpperCase();
  const senderNo = String(sender.EMPL_NO).trim().toUpperCase();
  const ctrCd = String(receiver.CTR_CD).trim();

  // Lấy/tạo phòng 1-1 (dùng transaction của server không cần thiết — chỉ cần id).
  const directKey = repo.buildDirectKey(receiverNo, senderNo);
  let conversation = await repo.findDirectConversation({ ctrCd, directKey });
  if (!conversation) {
    throw new Error("Chưa có phòng 1-1 giữa 2 người — hãy mở chat trước");
  }
  const conversationId = conversation.CONVERSATION_ID;

  const socket = io(SOCKET_URL, {
    auth: (cb) => cb({ token: sign({ ...sender, EMPL_NO: senderNo }) }),
    transports: ["websocket", "polling"],
    reconnection: false,
    timeout: 8000,
  });

  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", (e) => reject(new Error(e.message)));
    setTimeout(() => reject(new Error("timeout kết nối tới server")), 9000);
  });

  const join = await emitAck(socket, "chat:join", { conversationId });
  const ack = await emitAck(socket, "chat:send", {
    conversationId,
    content: `[realtime] ${new Date().toLocaleTimeString("vi-VN")} gửi tới ${receiverNo} — kiểm chứng không F5`,
    clientMessageId: `live-${Date.now()}`,
  });

  console.log(`[live] ${senderNo} -> ${receiverNo} conv=${conversationId} join=${join.ok} send=${ack.ok}`);
  console.log(`[live] messageId=${ack?.message?.MESSAGE_ID}`);
  socket.close();
}

main()
  .then(async () => { await closePool(); process.exit(0); })
  .catch(async (e) => { console.error("[live] FAIL:", e?.message || e); await closePool().catch(() => {}); process.exit(1); });
