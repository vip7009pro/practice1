/**
 * E2E nhẹ: đặt khoảng đồng bộ cho 1 mailbox rồi ĐỌC LẠI qua emailAdminOverview,
 * sau đó KHÔI PHỤC về "không giới hạn" (null) để không đổi hành vi thật.
 * Chạy: node scratch/check_mail_range_e2e.js
 */
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

const API = process.env.CHAT_TEST_API || "http://127.0.0.1:3007/api";
const SECRET = "nguyenvanhung";

async function callAdmin(token, command, DATA = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secureContext: false, command, DATA: { token_string: token, COMPANY: "CMS", ...DATA } }),
  });
  return res.json();
}

async function main() {
  const pool = await openConnection();
  const row = await pool.query(
    `SELECT TOP 1 LTRIM(RTRIM(EMPL_NO)) AS EMPL_NO, LTRIM(RTRIM(CTR_CD)) AS CTR_CD
       FROM ZTBEMPLINFO WHERE EMPL_NO LIKE '%NHU1903%'`
  );
  const acc = row.recordset[0];
  const token = jwt.sign(
    { payload: JSON.stringify([{ CTR_CD: acc.CTR_CD, EMPL_NO: acc.EMPL_NO, WORK_STATUS_CODE: 1, FIRST_NAME: "Check", MIDLAST_NAME: "Test" }]) },
    SECRET,
    { expiresIn: "1h" }
  );

  const before = await callAdmin(token, "emailAdminOverview", { limit: 3 });
  const box = before?.data?.mailboxes?.[0];
  if (!box) throw new Error("Không có mailbox để test");
  console.log(`Mailbox test: #${box.id} ${box.emailAddress}`);

  const set1 = await callAdmin(token, "emailAccountUpdate", { ID: box.id, SYNC_FROM_DATE: "2026-01-01", SYNC_TO_DATE: "2026-01-31" });
  console.log("Đặt khoảng:", set1.tk_status);

  const after = await callAdmin(token, "emailAdminOverview", { limit: 3 });
  const box2 = after?.data?.mailboxes?.find((m) => m.id === box.id);
  const okFrom = String(box2?.syncFromDate || "").slice(0, 10) === "2026-01-01";
  const okTo = String(box2?.syncToDate || "").slice(0, 10) === "2026-01-31";
  console.log(`Đọc lại: from=${box2?.syncFromDate} to=${box2?.syncToDate} => ${okFrom && okTo ? "PASS" : "FAIL"}`);

  // Khôi phục.
  const clear = await callAdmin(token, "emailAccountUpdate", { ID: box.id, SYNC_FROM_DATE: null, SYNC_TO_DATE: null });
  const finalCheck = await callAdmin(token, "emailAdminOverview", { limit: 3 });
  const box3 = finalCheck?.data?.mailboxes?.find((m) => m.id === box.id);
  console.log(`Khôi phục: tk=${clear.tk_status} from=${box3?.syncFromDate} to=${box3?.syncToDate} => ${!box3?.syncFromDate && !box3?.syncToDate ? "PASS" : "FAIL"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => undefined);
  });
