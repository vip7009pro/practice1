/**
 * Phát 1 thông báo qua socket để test "Trung tâm thông báo" (snackbar).
 * Server (socketHandler) nhận `notification_panel` rồi broadcast cho MỌI client.
 *
 * Chạy: node scratch/emit_notification_panel.js "Nội dung test" [EMPL_NO]
 */
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");

const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:3007";
const content = process.argv[2] || `TEST_NOTI_${Date.now()}`;
const emplNo = process.argv[3] || "NHU1903";

const token = jwt.sign(
  {
    payload: JSON.stringify([
      { CTR_CD: "002", EMPL_NO: emplNo, WORK_STATUS_CODE: 1, FIRST_NAME: "Test", MIDLAST_NAME: "Noti" },
    ]),
  },
  "nguyenvanhung",
  { expiresIn: "1h" }
);

const socket = io(SOCKET_URL, {
  auth: (cb) => cb({ token, deviceId: "scratch-emit" }),
  transports: ["websocket", "polling"],
  reconnection: false,
  timeout: 8000,
});

socket.on("connect", () => {
  console.log(`[emit] connected ${socket.id}, phát notification_panel: ${content}`);
  socket.emit("notification_panel", {
    NOTI_ID: Date.now(),
    NOTI_TYPE: "info",
    TITLE: "Test",
    CONTENT: content,
  });
  setTimeout(() => {
    socket.close();
    process.exit(0);
  }, 1200);
});
socket.on("connect_error", (err) => {
  console.error("[emit] connect_error:", err?.message);
  process.exit(1);
});
