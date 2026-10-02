/**
 * Kiểm tra nhanh: `emailAdminOverview` (backend mới) trả về trường khoảng đồng bộ.
 * Chạy: node scratch/check_mail_admin_fields.js
 */
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

const API = process.env.CHAT_TEST_API || "http://localhost:3007/api";
const SECRET = "nguyenvanhung";

async function main() {
  const pool = await openConnection();
  const row = await pool.query(
    `SELECT TOP 1 LTRIM(RTRIM(EMPL_NO)) AS EMPL_NO, LTRIM(RTRIM(CTR_CD)) AS CTR_CD
       FROM ZTBEMPLINFO WHERE EMPL_NO LIKE '%NHU1903%'`
  );
  const account = row.recordset[0];
  if (!account) throw new Error("Không tìm thấy NHU1903");
  const token = jwt.sign(
    {
      payload: JSON.stringify([
        { CTR_CD: account.CTR_CD, EMPL_NO: account.EMPL_NO, WORK_STATUS_CODE: 1, FIRST_NAME: "Check", MIDLAST_NAME: "Test" },
      ]),
    },
    SECRET,
    { expiresIn: "1h" }
  );

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secureContext: false, command: "emailAdminOverview", DATA: { token_string: token, COMPANY: "CMS", limit: 5 } }),
  });
  const json = await res.json();
  console.log("tk_status =", json.tk_status, "· status", res.status);
  const first = json?.data?.mailboxes?.[0];
  console.log("mailbox[0]:", first ? {
    emailAddress: first.emailAddress,
    syncFromDate: first.syncFromDate,
    syncToDate: first.syncToDate,
    skippedCount: first.skippedCount,
  } : "(none)");
  const hasFields = first && "syncFromDate" in first && "syncToDate" in first && "skippedCount" in first;
  console.log(hasFields ? "=> BACKEND MỚI ĐÃ CHẠY" : "=> CÒN CODE CŨ (chưa restart?)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => undefined);
  });
