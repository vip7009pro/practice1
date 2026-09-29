/**
 * So sánh backend ở 2 cổng public (3007 của máy dev vs 5013 mà app đang dùng).
 * Mục đích: xác định cổng nào thực sự có chat backend.
 *
 * Chạy: node scratch/probe_ports.js [CMS_ID]
 */
const http = require("http");
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

const post = (port, body) =>
  new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        host: "cmsvina4285.com",
        port,
        path: "/api",
        method: "POST",
        timeout: 15000,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data.slice(0, 160) }));
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "TIMEOUT" }); });
    req.on("error", (error) => resolve({ status: 0, body: "ERR " + error.message }));
    req.write(payload);
    req.end();
  });

async function main() {
  const pool = await openConnection();
  const employee = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, CMS_ID, MIDLAST_NAME, FIRST_NAME FROM ZTBEMPLINFO WHERE CMS_ID = @CMS_ID`,
      { CMS_ID: process.argv[2] || "CMS1179" }
    )
  ).recordset[0];
  if (!employee) throw new Error("Không tìm thấy nhân viên");

  const token = jwt.sign(
    { payload: JSON.stringify([{ ...employee, EMPL_NO: String(employee.EMPL_NO).trim().toUpperCase() }]) },
    "nguyenvanhung",
    { expiresIn: "1h" }
  );

  for (const port of [3007, 5013]) {
    const res = await post(port, {
      secureContext: false,
      command: "chatSync",
      DATA: { token_string: token, CTR_CD: "002" },
    });
    console.log(`port ${port}: status=${res.status} body=${res.body}`);

    const res2 = await post(port, {
      secureContext: false,
      command: "checkWebVer",
      DATA: { token_string: token, CTR_CD: "002" },
    });
    console.log(`port ${port} (checkWebVer): status=${res2.status} body=${res2.body.slice(0, 100)}`);
  }
}

main()
  .then(async () => { await closePool(); process.exit(0); })
  .catch(async (e) => { console.error("FAIL:", e?.message || e); await closePool().catch(() => {}); process.exit(1); });
