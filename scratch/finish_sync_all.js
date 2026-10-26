const { openConnection } = require("../config/database");
const { syncMailbox } = require("../services/mail/mailIngest");

async function run() {
  const pool = await openConnection();
  
  console.log("Cập nhật cấu hình chuẩn cho account 7: POP3 995 (SSL), SMTP 25 (plain)...");
  await pool.query(`
    UPDATE ZTB_MAIL_ACCOUNT
    SET POP3_HOST = 'mail.cmsbando.com',
        POP3_PORT = 995,
        POP3_SECURE = 1,
        SMTP_HOST = 'mail.cmsbando.com',
        SMTP_PORT = 25,
        SMTP_SECURE = 0
    WHERE ID = 7
  `);

  console.log("Giải phóng lock nếu có...");
  await pool.query(`
    UPDATE ZTB_MAIL_SYNC_CHECKPOINT
    SET IN_PROGRESS = 0, LOCKED_AT = NULL, LOCKED_BY = NULL
    WHERE MAIL_ACCOUNT_ID = 7
  `);

  console.log("Bắt đầu đồng bộ tiếp các email còn lại...");
  let round = 1;
  while (true) {
    console.log(`\n=== CHẠY LƯỢT ĐỒNG BỘ THỨ ${round} ===`);
    const res = await syncMailbox(7, { log: console.log, manual: true });
    console.log(`Kết quả lượt ${round}:`, res);
    if (!res.ok || res.imported === 0 || !res.budgetExhausted) {
      console.log("Đã tải xong toàn bộ email hoặc không còn email pending!");
      break;
    }
    round++;
  }

  const finalStats = await pool.query(`
    SELECT COUNT(*) as TOTAL,
           MIN(SENT_AT) as MIN_DATE,
           MAX(SENT_AT) as MAX_DATE
    FROM ZTB_MAIL_MESSAGE
    WHERE MAIL_ACCOUNT_ID = 7
  `);
  console.log("\n=== TỔNG KẾT SAU KHI ĐỒNG BỘ XONG ===");
  console.log(finalStats.recordset);

  const top10 = await pool.query(`
    SELECT TOP 10 ID, UIDL, SUBJECT, SENT_AT
    FROM ZTB_MAIL_MESSAGE
    WHERE MAIL_ACCOUNT_ID = 7
    ORDER BY SENT_AT DESC
  `);
  console.log("\n=== 10 EMAIL MỚI NHẤT TRONG HỘP THƯ ===");
  console.log(top10.recordset);

  process.exit(0);
}

run();
