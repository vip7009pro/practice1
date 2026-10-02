/**
 * Kiểm tra trạng thái UPLOAD tài liệu của mã sản phẩm trong M100.
 *
 *  - BANVE    : cờ "đã có bản vẽ CAD" (Y/N) — do `update_banve_value` ghi
 *  - APPSHEET : cờ "đã có Appsheet" (Y/N) — do `update_appsheet_value` ghi
 *  - PDBV     : cờ phê duyệt bản vẽ — do `resetbanve` ghi (qua DATA.VALUE)
 *
 * Chạy: node scratch/inspect_code_doc_status.js [G_CODE]
 */
const mailRepo = require("../services/mail/mailRepository");

const G_CODE = process.argv[2] || "";

(async () => {
  const stats = await mailRepo.queryOne(
    `SELECT COUNT(*) AS TOTAL,
            SUM(CASE WHEN BANVE = 'Y' THEN 1 ELSE 0 END) AS BANVE_Y,
            SUM(CASE WHEN BANVE = 'N' THEN 1 ELSE 0 END) AS BANVE_N,
            SUM(CASE WHEN BANVE IS NULL THEN 1 ELSE 0 END) AS BANVE_NULL,
            SUM(CASE WHEN APPSHEET = 'Y' THEN 1 ELSE 0 END) AS APP_Y,
            SUM(CASE WHEN APPSHEET = 'N' THEN 1 ELSE 0 END) AS APP_N
     FROM M100 WHERE CTR_CD = '002'`
  );
  console.log("Thống kê M100 (CTR 002):", JSON.stringify(stats));

  if (G_CODE) {
    const row = await mailRepo.queryOne(
      `SELECT CTR_CD, G_CODE, G_NAME, BANVE, APPSHEET, PDBV, UPD_DATE, UPD_EMPL
       FROM M100 WHERE CTR_CD = '002' AND G_CODE = @G`,
      { G: G_CODE }
    );
    console.log(`Mã ${G_CODE}:`, JSON.stringify(row));
  } else {
    const rows = await mailRepo.queryRows(
      `SELECT TOP 5 G_CODE, BANVE, APPSHEET, PDBV, UPD_DATE FROM M100
       WHERE CTR_CD = '002' ORDER BY UPD_DATE DESC`
    );
    console.log("5 mã cập nhật gần nhất:", JSON.stringify(rows, null, 1));
  }
  process.exit(0);
})().catch((error) => {
  console.error("Lỗi:", error);
  process.exit(1);
});
