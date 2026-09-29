/**
 * Giữ 1 socket đã xác thực luôn online (để kiểm chứng trạng thái presence).
 * Chạy: node scratch/hold_socket.js [CMS_ID] [giây]
 */
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const { openConnection, closePool } = require("../config/database");

const normalize = (value) => String(value || "").trim().toUpperCase();

async function main() {
  const cmsId = process.argv[2] || "CMS0001";
  const holdSeconds = Number(process.argv[3]) || 60;

  const pool = await openConnection();
  const employee = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, CMS_ID, MIDLAST_NAME, FIRST_NAME
         FROM ZTBEMPLINFO
        WHERE EMPL_NO = @KEY OR CMS_ID = @KEY
        ORDER BY CASE WHEN EMPL_NO = @KEY THEN 0 ELSE 1 END`,
      { KEY: cmsId }
    )
  ).recordset[0];
  if (!employee) throw new Error(`Không tìm thấy ${cmsId}`);

  const emplNo = normalize(employee.EMPL_NO);
  const token = jwt.sign(
    { payload: JSON.stringify([{ ...employee, EMPL_NO: emplNo }]) },
    "nguyenvanhung",
    { expiresIn: "1h" }
  );

  const socket = io("http://localhost:3007", {
    auth: (cb) => cb({ token }),
    transports: ["websocket", "polling"],
    reconnection: true,
  });

  socket.on("connect", () => console.log(`[hold] ${emplNo} online (${socket.id})`));
  socket.on("connect_error", (error) => console.log("[hold] lỗi:", error.message));

  console.log(`[hold] giữ online ${emplNo} trong ${holdSeconds}s`);
  setTimeout(() => {
    socket.close();
    console.log("[hold] đã ngắt");
    process.exit(0);
  }, holdSeconds * 1000);
}

main().catch(async (error) => {
  console.error("[hold] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
