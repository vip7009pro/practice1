/**
 * Kiểm tra kiểu thời gian lưu trong ZTB_MAIL_MESSAGE: SENT_AT/RECEIVED_AT là UTC thật hay giờ VN "dán nhãn UTC"?
 * So sánh với GETDATE() (giờ VN của SQL Server).
 *
 * Chạy: node scratch/diagnose_mail_time.js
 */
const { openConnection, closePool } = require("../config/database");

async function main() {
  const pool = await openConnection();
  const r = await pool.query(
    `SELECT TOP 5
        m.ID, m.SUBJECT, m.SENT_AT, m.RECEIVED_AT,
        m.CREATED_AT,
        GETDATE() AS NOW_SERVER,
        DATEDIFF(MINUTE, m.RECEIVED_AT, GETDATE()) AS DIFF_RECV_VS_NOW_MIN
       FROM ZTB_MAIL_MESSAGE m
      WHERE m.RECEIVED_AT IS NOT NULL
      ORDER BY m.RECEIVED_AT DESC`
  );
  for (const row of r.recordset) {
    console.log({
      ID: row.ID,
      SUBJECT: String(row.SUBJECT || "").slice(0, 30),
      SENT_AT: row.SENT_AT,
      RECEIVED_AT: row.RECEIVED_AT,
      CREATED_AT: row.CREATED_AT,
      NOW_SERVER: row.NOW_SERVER,
      DIFF_RECV_VS_NOW_MIN: row.DIFF_RECV_VS_NOW_MIN,
    });
  }
  // Giá trị JSON mà API trả cho FE (Date → ISO):
  const sample = r.recordset[0];
  if (sample) {
    console.log("\nJSON RECEIVED_AT như API trả về:", new Date(sample.RECEIVED_AT).toISOString());
    console.log("JSON CREATED_AT như API trả về:", new Date(sample.CREATED_AT).toISOString());
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await closePool().catch(() => undefined); setTimeout(() => process.exit(0), 200); });
