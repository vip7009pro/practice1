/* eslint-disable no-console */
/**
 * Script CHẨN ĐOÁN (chỉ đọc DB): Đo xem 2 token sinh ra cách nhau có khác nhau ở đoạn nào.
 * Chạy: node scratch/check_token_diff.js [EMPL_NO] [CTR_CD]
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { queryDB } = require("../config/database");
const { checkMYCHAMCONG } = require("../services/commonService");

const EMPL_NO = process.argv[2] || "VTT1901";
const CTR_CD = process.argv[3] || "002";

function makeRes() {
  return { sent: null, send(p) { this.sent = p; } };
}

(async () => {
  const row = await queryDB(
    `SELECT TOP 1 * FROM ZTBEMPLINFO WHERE EMPL_NO='${EMPL_NO}' AND CTR_CD='${CTR_CD}'`
  );
  const payloadData = row.data[0];
  const cookieToken = jwt.sign({ payload: JSON.stringify(row.data) }, "nguyenvanhung", {
    expiresIn: "24h",
  });
  const DATA = { CTR_CD };
  const req = { payload_data: payloadData, cookies: { token: cookieToken } };

  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const res = makeRes();
    await checkMYCHAMCONG(req, res, DATA);
    tokens.push(res.sent.REFRESH_TOKEN);
    if (i === 0) await new Promise((r) => setTimeout(r, 1100));
  }

  const [a, b] = tokens;
  let same = 0;
  while (same < a.length && same < b.length && a[same] === b[same]) same++;

  console.log("Độ dài token                :", a.length);
  console.log("Số ký tự ĐẦU GIỐNG NHAU     :", same, `(${((same / a.length) * 100).toFixed(1)}%)`);
  console.log("Số ký tự cuối KHÁC nhau     :", a.length - same);
  console.log("\n--- Phần khác nhau (từ vị trí", same, ") ---");
  console.log("Token #1 :", a.slice(Math.max(0, same - 20)));
  console.log("Token #2 :", b.slice(Math.max(0, same - 20)));

  process.exit(0);
})().catch((e) => {
  console.error("LỖI SCRIPT:", e);
  process.exit(1);
});
