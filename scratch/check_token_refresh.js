/* eslint-disable no-console */
/**
 * Script CHẨN ĐOÁN (chỉ đọc DB, không ghi):
 * Gọi trực tiếp handler checkMYCHAMCONG 2 lần để xem REFRESH_TOKEN có được sinh mới hay không.
 * Chạy: node scratch/check_token_refresh.js [EMPL_NO] [CTR_CD]
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { queryDB } = require("../config/database");
const { checkMYCHAMCONG } = require("../services/commonService");

const EMPL_NO = process.argv[2] || "VTT1901";
const CTR_CD = process.argv[3] || "002";

function makeRes() {
  return {
    sent: null,
    send(payload) {
      this.sent = payload;
    },
  };
}

function brief(token) {
  if (!token) return { empty: true, value: JSON.stringify(token) };
  try {
    const decoded = jwt.decode(token);
    return {
      len: token.length,
      head: token.slice(0, 24),
      tail: token.slice(-16),
      iat: decoded?.iat,
      exp: decoded?.exp,
      emplInPayload: (() => {
        try {
          return JSON.parse(decoded.payload)[0]?.EMPL_NO;
        } catch (e) {
          return "(không parse được)";
        }
      })(),
    };
  } catch (e) {
    return { len: token.length, head: token.slice(0, 24), err: String(e) };
  }
}

(async () => {
  // 1) Lấy row nhân viên giống payload JWT lúc login
  const row = await queryDB(
    `SELECT TOP 1 EMPL_NO, PASSWORD, CTR_CD FROM ZTBEMPLINFO WHERE EMPL_NO='${EMPL_NO}' AND CTR_CD='${CTR_CD}'`
  );
  console.log("[DB] query nhân viên:", row.tk_status, row.data?.length ?? 0, "dòng");
  if (row.tk_status !== "OK" || !row.data?.length) {
    console.log("=> Không tìm thấy nhân viên, dừng.");
    process.exit(0);
  }

  const payloadData = row.data[0];
  console.log("[DB] EMPL_NO =", payloadData.EMPL_NO, "| PASSWORD rỗng?", !payloadData.PASSWORD);

  const cookieToken = jwt.sign({ payload: JSON.stringify(row.data) }, "nguyenvanhung", {
    expiresIn: "24h",
  });

  const DATA = { CTR_CD };
  const req = { payload_data: payloadData, cookies: { token: cookieToken } };

  // 2) Gọi handler 2 lần (mô phỏng 2 chu kỳ poll)
  const results = [];
  for (let i = 1; i <= 2; i++) {
    const res = makeRes();
    await checkMYCHAMCONG(req, res, DATA);
    results.push({ lần: i, tk_status: res.sent?.tk_status, ...brief(res.sent?.REFRESH_TOKEN) });
    if (i === 1) await new Promise((r) => setTimeout(r, 1100));
  }

  console.log("\n[KẾT QUẢ]");
  console.table(results);
  console.log(
    "\n=> REFRESH_TOKEN có thay đổi giữa 2 lần gọi?",
    results[0].head !== results[1].head || results[0].tail !== results[1].tail ? "CÓ" : "KHÔNG"
  );
  process.exit(0);
})().catch((e) => {
  console.error("LỖI SCRIPT:", e);
  process.exit(1);
});
