/**
 * Migration (IDEMPOTENT): Cấu hình KHOẢNG THỜI GIAN ĐỒNG BỘ email cho mailbox.
 *
 * Thêm vào `ZTB_MAIL_ACCOUNT`:
 *   - SYNC_FROM_DATE DATETIME2 NULL — chỉ tải email có ngày >= mốc này (NULL = không giới hạn).
 *   - SYNC_TO_DATE   DATETIME2 NULL — chỉ tải email có ngày <= mốc này (NULL = không giới hạn).
 *
 * Thêm bảng `ZTB_MAIL_SYNC_SKIP` — ghi nhớ các UIDL đã bị BỎ QUA do ngoài khoảng
 * (nếu không, mỗi lượt đồng bộ lại phải tải header của đúng những email cũ đó và
 *  không bao giờ tiến tới được email mới). Xoá bảng con này khi đổi khoảng cấu hình.
 *
 * Chạy: node scripts/migrate_mail_sync_daterange.js
 */
const { openConnection, closePool } = require("../config/database");

const STATEMENTS = [
  {
    name: "ZTB_MAIL_ACCOUNT.SYNC_FROM_DATE",
    sql: `IF NOT EXISTS (
       SELECT * FROM sys.columns
       WHERE object_id = OBJECT_ID('ZTB_MAIL_ACCOUNT') AND name = 'SYNC_FROM_DATE')
BEGIN
  ALTER TABLE ZTB_MAIL_ACCOUNT ADD SYNC_FROM_DATE DATETIME2 NULL;
  PRINT 'Added ZTB_MAIL_ACCOUNT.SYNC_FROM_DATE';
END`,
  },
  {
    name: "ZTB_MAIL_ACCOUNT.SYNC_TO_DATE",
    sql: `IF NOT EXISTS (
       SELECT * FROM sys.columns
       WHERE object_id = OBJECT_ID('ZTB_MAIL_ACCOUNT') AND name = 'SYNC_TO_DATE')
BEGIN
  ALTER TABLE ZTB_MAIL_ACCOUNT ADD SYNC_TO_DATE DATETIME2 NULL;
  PRINT 'Added ZTB_MAIL_ACCOUNT.SYNC_TO_DATE';
END`,
  },
  {
    name: "ZTB_MAIL_SYNC_SKIP",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_MAIL_SYNC_SKIP')
BEGIN
  CREATE TABLE ZTB_MAIL_SYNC_SKIP (
    MAIL_ACCOUNT_ID INT           NOT NULL,
    UIDL            NVARCHAR(400) NOT NULL,
    SKIP_REASON     NVARCHAR(30)  NOT NULL,   -- BEFORE_RANGE | AFTER_RANGE
    SKIPPED_AT      DATETIME2     NOT NULL CONSTRAINT DF_MAIL_SKIP_AT DEFAULT GETDATE(),
    CONSTRAINT PK_MAIL_SYNC_SKIP PRIMARY KEY (MAIL_ACCOUNT_ID, UIDL)
  );
  PRINT 'Created ZTB_MAIL_SYNC_SKIP';
END`,
  },
];

async function main() {
  const connection = await openConnection();
  try {
    for (const statement of STATEMENTS) {
      try {
        await connection.query(statement.sql);
        console.log(`[migrate-mail-range] OK  — ${statement.name}`);
      } catch (error) {
        console.error(`[migrate-mail-range] LỖI — ${statement.name}: ${error.message}`);
        throw error;
      }
    }
    console.log("[migrate-mail-range] Hoàn tất.");
  } finally {
    try {
      await connection.close();
    } catch {
      /* bỏ qua */
    }
    if (typeof closePool === "function") {
      try {
        await closePool();
      } catch {
        /* bỏ qua */
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
