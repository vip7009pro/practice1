const { openConnection } = require("../config/database");
const mailRepo = require("../services/mail/mailRepository");
const { syncMailbox } = require("../services/mail/mailIngest");

async function run() {
  const pool = await openConnection();
  
  // Giải phóng lock hiện tại nếu có
  await pool.query(`
    UPDATE ZTB_MAIL_SYNC_CHECKPOINT
    SET IN_PROGRESS = 0, LOCKED_AT = NULL, LOCKED_BY = NULL
    WHERE MAIL_ACCOUNT_ID = 7
  `);

  console.log("Đã giải phóng lock. Bắt đầu syncMailbox(7)...");
  const res = await syncMailbox(7, { log: console.log, manual: true });
  console.log("Kết quả sync:", res);

  const stats = await pool.query(`
    SELECT COUNT(*) as TOTAL,
           MIN(SENT_AT) as MIN_DATE,
           MAX(SENT_AT) as MAX_DATE
    FROM ZTB_MAIL_MESSAGE
    WHERE MAIL_ACCOUNT_ID = 7
  `);
  console.log("Thống kê tin nhắn sau sync:", stats.recordset);

  // Lấy 10 email mới nhất vừa sync
  const latest = await pool.query(`
    SELECT TOP 10 ID, UIDL, SUBJECT, SENT_AT
    FROM ZTB_MAIL_MESSAGE
    WHERE MAIL_ACCOUNT_ID = 7
    ORDER BY SENT_AT DESC
  `);
  console.log("Top 10 email mới nhất:", latest.recordset);

  process.exit(0);
}

run();
