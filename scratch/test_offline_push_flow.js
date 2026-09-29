/**
 * Kiểm chứng luồng push offline đầy đủ, đi qua CHÍNH server (HTTP command):
 *  - Người nhận: nhân viên có subscription hợp lệ và KHÔNG có socket trên server.
 *  - Người gửi: một nhân viên khác (ký JWT như middleware).
 *  - Bước 1: chatGetOrCreateDirect tạo/mở phòng 1-1.
 *  - Bước 2: chatSendMessage ⇒ server phải emit realtime VÀ gọi push cho người offline.
 *
 * Chạy: node scratch/test_offline_push_flow.js [URL]
 * (sau khi chạy, xem log server: dòng "[chat] push offline conv=...")
 */
const http = require("http");
const https = require("https");
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

const BASE = new URL(process.argv[2] || "http://localhost:3007");

const normalize = (value) => String(value || "").trim().toUpperCase();

const postApi = (body) =>
  new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const client = BASE.protocol === "https:" ? https : http;
    const req = client.request(
      {
        host: BASE.hostname,
        port: BASE.port,
        path: "/api",
        method: "POST",
        timeout: 20000,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            resolve({ tk_status: "NG", message: `bad json: ${data.slice(0, 80)}` });
          }
        });
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ tk_status: "NG", message: "TIMEOUT" }); });
    req.on("error", (error) => resolve({ tk_status: "NG", message: error.message }));
    req.write(payload);
    req.end();
  });

const sign = (employee) =>
  jwt.sign({ payload: JSON.stringify([employee]) }, "nguyenvanhung", { expiresIn: "1h" });

const callAs = async (employee, command, DATA = {}) => {
  const token = sign(employee);
  return postApi({
    secureContext: false,
    command,
    DATA: { ...DATA, token_string: token, CTR_CD: String(employee.CTR_CD).trim() },
  });
};

async function main() {
  const pool = await openConnection();

  const sender = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD, MIDLAST_NAME, FIRST_NAME FROM ZTBEMPLINFO
       WHERE CMS_ID = 'CMS1179'`
    )
  ).recordset[0];
  const senderNo = normalize(sender.EMPL_NO);
  const ctrCd = String(sender.CTR_CD).trim();

  // Người nhận: có subscription owned hợp lệ, khác người gửi.
  const candidates = (
    await pool.query(
      `SELECT TOP 20 SUBSCRIPTION FROM ZTB_SUBSCRIPTION_TB
       WHERE CTR_CD = @CTR_CD AND SUB_STATUS = '1'`,
      { CTR_CD: ctrCd }
    )
  ).recordset;
  const owners = new Set();
  candidates.forEach((row) => {
    try {
      const parsed = JSON.parse(row.SUBSCRIPTION);
      const own = normalize(parsed?.emplNo);
      if (own && own !== senderNo) owners.add(own);
    } catch (error) {
      /* bỏ qua row lỗi */
    }
  });
  const recipientNo = [...owners][0];
  if (!recipientNo) throw new Error("Không tìm được người nhận có subscription");

  const recipient = (
    await pool.query(
      `SELECT TOP 1 EMPL_NO, CTR_CD FROM ZTBEMPLINFO WHERE EMPL_NO = @EMPL_NO`,
      { EMPL_NO: recipientNo }
    )
  ).recordset[0];
  console.log(`Người gửi=${senderNo} | người nhận=${recipientNo} (ctr=${ctrCd})`);

  const senderCtx = { ...sender, EMPL_NO: senderNo };

  // 1) Mở/tạo phòng 1-1
  const conv = await callAs(senderCtx, "chatGetOrCreateDirect", { otherEmplNo: recipientNo });
  if (conv.tk_status !== "OK") throw new Error(`chatGetOrCreateDirect: ${conv.message}`);
  const conversationId = conv.data.CONVERSATION_ID;
  console.log(`conversationId=${conversationId}, members=${conv.data.MEMBERS.length}`);

  // 2) Gửi tin qua HTTP ⇒ server phải gọi push cho người nhận offline
  const sent = await callAs(senderCtx, "chatSendMessage", {
    conversationId,
    content: `[offline-push-test] ${new Date().toLocaleTimeString("vi-VN")}`,
    clientMessageId: `offline-${Date.now()}`,
  });
  console.log(`chatSendMessage: ${sent.tk_status} ${sent.message || ""}`);
  if (sent.tk_status !== "OK") throw new Error("Gửi tin thất bại");

  console.log("=> Kiểm tra log server để thấy dòng '[chat] push offline conv=...'");
}

main()
  .then(async () => { await closePool(); process.exit(0); })
  .catch(async (error) => {
    console.error("FAIL:", error?.message || error);
    await closePool().catch(() => undefined);
    process.exit(1);
  });
