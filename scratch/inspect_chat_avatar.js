/**
 * In raw `chatSync` để xem backend trả gì cho avatar phòng (đặc biệt phòng 1-1).
 * Chạy: node scratch/inspect_chat_avatar.js [EMPL_NO]
 */
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

const API = process.env.CHAT_TEST_API || "http://localhost:3007/api";

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
  return response.json();
}

async function main() {
  const emplNo = String(process.argv[2] || "NHU1903").trim().toUpperCase();
  const pool = await openConnection();
  const row = await pool.query(
    `SELECT TOP 1 CTR_CD FROM ZTB_CHAT_PARTICIPANT WHERE LTRIM(RTRIM(EMPL_NO)) = @EMPL_NO`,
    { EMPL_NO: emplNo }
  );
  const ctrCd = String(row.recordset[0]?.CTR_CD || "002").trim();

  const token = jwt.sign(
    { payload: JSON.stringify([{ CTR_CD: ctrCd, EMPL_NO: emplNo, WORK_STATUS_CODE: 1 }]) },
    "nguyenvanhung",
    { expiresIn: "24h" }
  );

  const json = await callApi(token, "chatSync", { CTR_CD: ctrCd });
  const list = json?.data?.conversations || [];
  console.log(`tk_status=${json.tk_status}  (${emplNo} @ ${ctrCd}, ${list.length} phòng)\n`);
  console.table(
    list.map((c) => ({
      ID: c.CONVERSATION_ID,
      TYPE: c.CONV_TYPE,
      NAME: c.DISPLAY_NAME,
      DISPLAY_AVATAR: c.DISPLAY_AVATAR,
      AVATAR: c.AVATAR,
      PEER: c.PEER_EMPL_NO,
      PEER_IMAGE: (c.MEMBERS || []).filter((m) => m.EMPL_NO !== emplNo).map((m) => `${m.EMPL_NO}:${m.EMPL_IMAGE}`).join(", "),
    }))
  );

  await closePool();
}

main().catch(async (error) => {
  console.error("[inspect-avatar] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
