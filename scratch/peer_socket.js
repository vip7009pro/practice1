/**
 * Đóng vai "đối phương" để kiểm chứng realtime 2 chiều.
 *
 *   node scratch/peer_socket.js <EMPL_NO> react  <conversationId> <REACTION>
 *   node scratch/peer_socket.js <EMPL_NO> typing <conversationId> <ms>
 *   node scratch/peer_socket.js <EMPL_NO> hold   <conversationId> <giây>
 */
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const { openConnection, closePool } = require("../config/database");

const normalize = (value) => String(value || "").trim().toUpperCase();

async function buildToken(emplNo) {
  const pool = await openConnection();
  const employee = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, CMS_ID, MIDLAST_NAME, FIRST_NAME
         FROM ZTBEMPLINFO WHERE EMPL_NO = @KEY`,
      { KEY: emplNo }
    )
  ).recordset[0];
  if (!employee) throw new Error(`Không tìm thấy ${emplNo}`);
  return {
    emplNo: normalize(employee.EMPL_NO),
    token: jwt.sign(
      { payload: JSON.stringify([{ ...employee, EMPL_NO: normalize(employee.EMPL_NO) }]) },
      "nguyenvanhung",
      { expiresIn: "1h" }
    ),
  };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io("http://localhost:3007", {
      auth: (cb) => cb({ token }),
      transports: ["websocket", "polling"],
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (error) => reject(error));
  });
}

async function main() {
  const [emplArg, mode, convArg, extraArg] = process.argv.slice(2);
  if (!emplArg || !mode) throw new Error("Thiếu tham số");
  const conversationId = Number(convArg) || 0;

  const { emplNo, token } = await buildToken(emplArg);
  const socket = await connect(token);
  console.log(`[peer] ${emplNo} online (${socket.id})`);

  if (conversationId) {
    socket.emit("chat:join", { conversationId });
    await new Promise((r) => setTimeout(r, 600));
    console.log(`[peer] đã vào phòng ${conversationId}`);
  }

  if (mode === "react") {
    const pool = await openConnection();
    const row = (
      await pool.query(
        `SELECT TOP 1 MESSAGE_ID FROM ZTB_CHAT_MESSAGE
          WHERE CONVERSATION_ID = @CID AND DELETED_AT IS NULL
          ORDER BY MESSAGE_ID DESC`,
        { CID: conversationId }
      )
    ).recordset[0];
    if (!row) throw new Error("Phòng chưa có tin nhắn");
    const acks = await new Promise((resolve) =>
      socket.emit(
        "chat:reaction",
        { conversationId, messageId: row.MESSAGE_ID, reaction: extraArg || "LOVE" },
        (ack) => resolve(ack)
      )
    );
    console.log(`[peer] đã thả ${extraArg || "LOVE"} cho tin ${row.MESSAGE_ID}:`, acks?.ok);
  }

  if (mode === "typing") {
    const ms = Number(extraArg) || 3000;
    socket.emit("chat:typing", { conversationId, typing: true });
    console.log(`[peer] đang nhập (${ms}ms)`);
    await new Promise((r) => setTimeout(r, ms));
    socket.emit("chat:typing", { conversationId, typing: false });
    console.log("[peer] ngừng nhập");
  }

  // Giữ trạng thái "đang nhập" luôn sống (client tự tắt sau ~4s nên phải lặp lại),
  // để quan sát được từ phía người nhận bất kể độ trễ của công cụ kiểm thử.
  if (mode === "typingloop") {
    const ms = Number(extraArg) || 12000;
    const deadline = Date.now() + ms;
    const timer = setInterval(() => {
      if (Date.now() > deadline) return;
      socket.emit("chat:typing", { conversationId, typing: true });
    }, 1200);
    socket.emit("chat:typing", { conversationId, typing: true });
    console.log(`[peer] đang nhập liên tục (${ms}ms)`);
    await new Promise((r) => setTimeout(r, ms));
    clearInterval(timer);
    socket.emit("chat:typing", { conversationId, typing: false });
    console.log("[peer] ngừng nhập");
  }

  if (mode === "reactloop") {
    const pool = await openConnection();
    const row = (
      await pool.query(
        `SELECT TOP 1 MESSAGE_ID FROM ZTB_CHAT_MESSAGE
          WHERE CONVERSATION_ID = @CID AND DELETED_AT IS NULL
          ORDER BY MESSAGE_ID DESC`,
        { CID: conversationId }
      )
    ).recordset[0];
    if (!row) throw new Error("Phòng chưa có tin nhắn");
    const ms = Number(process.argv[6]) || 15000;
    console.log(`[peer] thả cảm xúc lặp lại cho tin ${row.MESSAGE_ID} trong ${ms}ms`);
    const emit = () =>
      socket.emit(
        "chat:reaction",
        { conversationId, messageId: row.MESSAGE_ID, reaction: extraArg || "LOVE" },
        (ack) => console.log(`[peer] ack ok=${ack?.ok} count=${ack?.reactions?.[extraArg || "LOVE"]?.count}`)
      );
    emit();
    const timer = setInterval(emit, 2500);
    await new Promise((r) => setTimeout(r, ms));
    clearInterval(timer);
  }

  if (mode === "hold") {
    const seconds = Number(extraArg) || 120;
    console.log(`[peer] giữ online ${seconds}s`);
    await new Promise((r) => setTimeout(r, seconds * 1000));
  }

  socket.close();
  await closePool().catch(() => undefined);
  process.exit(0);
}

main().catch(async (error) => {
  console.error("[peer] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
