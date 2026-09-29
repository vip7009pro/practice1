/**
 * So sánh đường đi tới backend:
 *   A) localhost:3007  + JWT thật  (websocket)
 *   B) cmsvina4285.com:3007 + JWT thật (websocket)  ← đúng đường của trình duyệt
 *   C) cmsvina4285.com:3007 + polling (giống trình duyệt khi không upgrade được)
 *
 * Chạy: node scratch/test_transport_paths.js [CMS_ID]
 */
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const { openConnection, closePool } = require("../config/database");

const sign = (employee) =>
  jwt.sign({ payload: JSON.stringify([employee]) }, "nguyenvanhung", { expiresIn: "1h" });

function probe(label, url, token, transports) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = io(url, {
      auth: (cb) => cb({ token }),
      transports,
      reconnection: false,
      timeout: 9000,
    });
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      try { socket.close(); } catch {}
      resolve({ label, ms: Date.now() - started, ...result });
    };
    socket.on("connect", () => finish({ ok: true, id: socket.id }));
    socket.on("connect_error", (e) => finish({ ok: false, err: e?.message }));
    setTimeout(() => finish({ ok: false, err: "TIMEOUT (giống trình duyệt: treo ở connect)" }), 10000);
  });
}

async function main() {
  const pool = await openConnection();
  const employee = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, CMS_ID, MIDLAST_NAME, FIRST_NAME FROM ZTBEMPLINFO
       WHERE CMS_ID = @CMS_ID`,
      { CMS_ID: process.argv[2] || "CMS1179" }
    )
  ).recordset[0];
  if (!employee) throw new Error("Không tìm thấy nhân viên");

  const payload = {
    ...employee,
    EMPL_NO: String(employee.EMPL_NO).trim().toUpperCase(),
  };
  const token = sign(payload);
  console.log(`[tp] user=${payload.EMPL_NO} tokenLen=${token.length}`);

  const results = [
    await probe("A localhost + websocket", "http://localhost:3007", token, ["websocket"]),
    await probe("B public    + websocket", "http://cmsvina4285.com:3007", token, ["websocket"]),
    await probe("C public    + polling", "http://cmsvina4285.com:3007", token, ["polling"]),
  ];

  results.forEach((r) =>
    console.log(
      `${r.label.padEnd(26)} ok=${String(r.ok).padEnd(5)} ms=${String(r.ms).padStart(6)} ${r.ok ? `id=${r.id}` : `err=${r.err}`}`
    )
  );
}

main()
  .then(async () => { await closePool(); process.exit(0); })
  .catch(async (e) => { console.error("[tp] FAIL:", e?.message || e); await closePool().catch(() => {}); process.exit(1); });
