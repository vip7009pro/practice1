/**
 * Migration tạo bảng cho tính năng Chat nội bộ (Socket.IO + Web Push).
 *
 * Nguyên tắc:
 * - Idempotent: chạy lại nhiều lần không lỗi, không ghi đè dữ liệu.
 * - Không đụng tới các bảng nghiệp vụ hiện có (ZTB_NOTIFICATION, ZTBEMPLINFO...).
 * - Không xóa vật lý: các bảng chat dùng cột *_AT / *_DELETED để soft-delete.
 *
 * Chạy: node scripts/migrate_chat_tables.js
 */
const { openConnection } = require("../config/database");

const STATEMENTS = [
  {
    name: "ZTB_CHAT_CONVERSATION",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_CONVERSATION')
BEGIN
  CREATE TABLE ZTB_CHAT_CONVERSATION (
    CONVERSATION_ID   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CTR_CD            NVARCHAR(20)  NOT NULL,
    CONV_TYPE         NVARCHAR(10)  NOT NULL,           -- DIRECT | GROUP
    TITLE             NVARCHAR(200) NULL,
    AVATAR            NVARCHAR(300) NULL,
    DIRECT_KEY        NVARCHAR(60)  NULL,               -- EMP1|EMP2 (đã sort) cho DIRECT
    OWNER_EMPL_NO     NVARCHAR(20)  NULL,
    LAST_MESSAGE_ID   INT           NULL,
    LAST_MESSAGE_AT   DATETIME      NULL,
    CREATED_BY        NVARCHAR(20)  NOT NULL,
    CREATED_AT        DATETIME      NOT NULL CONSTRAINT DF_CHAT_CONV_CREATED DEFAULT (GETDATE()),
    UPDATED_AT        DATETIME      NULL,
    DELETED_AT        DATETIME      NULL
  );
  PRINT 'Created ZTB_CHAT_CONVERSATION';
END`,
  },
  {
    name: "ZTB_CHAT_PARTICIPANT",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_PARTICIPANT')
BEGIN
  CREATE TABLE ZTB_CHAT_PARTICIPANT (
    CONVERSATION_ID      INT           NOT NULL,
    EMPL_NO              NVARCHAR(20)  NOT NULL,
    CTR_CD               NVARCHAR(20)  NOT NULL,
    ROLE                 NVARCHAR(12)  NOT NULL CONSTRAINT DF_CHAT_PART_ROLE DEFAULT ('MEMBER'),
    JOINED_AT            DATETIME      NOT NULL CONSTRAINT DF_CHAT_PART_JOINED DEFAULT (GETDATE()),
    LEFT_AT              DATETIME      NULL,
    MUTED                BIT           NOT NULL CONSTRAINT DF_CHAT_PART_MUTED DEFAULT (0),
    LAST_READ_MESSAGE_ID INT           NULL,
    CONSTRAINT PK_CHAT_PARTICIPANT PRIMARY KEY (CONVERSATION_ID, EMPL_NO)
  );
  PRINT 'Created ZTB_CHAT_PARTICIPANT';
END`,
  },
  {
    name: "ZTB_CHAT_MESSAGE",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_MESSAGE')
BEGIN
  CREATE TABLE ZTB_CHAT_MESSAGE (
    MESSAGE_ID        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CONVERSATION_ID   INT           NOT NULL,
    CTR_CD            NVARCHAR(20)  NOT NULL,
    SENDER_EMPL_NO    NVARCHAR(20)  NOT NULL,
    MSG_TYPE          NVARCHAR(12)  NOT NULL CONSTRAINT DF_CHAT_MSG_TYPE DEFAULT ('TEXT'),
    CONTENT           NVARCHAR(MAX) NULL,
    MENTIONS          NVARCHAR(1000) NULL,              -- JSON array EMPL_NO được tag
    REPLY_TO_MESSAGE_ID INT         NULL,
    CLIENT_MESSAGE_ID NVARCHAR(60)  NULL,               -- chống gửi trùng khi reconnect
    CREATED_AT        DATETIME      NOT NULL CONSTRAINT DF_CHAT_MSG_CREATED DEFAULT (GETDATE()),
    EDITED_AT         DATETIME      NULL,
    DELETED_AT        DATETIME      NULL
  );
  PRINT 'Created ZTB_CHAT_MESSAGE';
END`,
  },
  {
    name: "ZTB_CHAT_ATTACHMENT",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_ATTACHMENT')
BEGIN
  CREATE TABLE ZTB_CHAT_ATTACHMENT (
    ATTACHMENT_ID   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MESSAGE_ID      INT           NULL,
    CONVERSATION_ID INT           NOT NULL,
    CTR_CD          NVARCHAR(20)  NOT NULL,
    ORIGINAL_NAME   NVARCHAR(300) NOT NULL,
    STORED_NAME     NVARCHAR(200) NOT NULL,
    STORAGE_PATH    NVARCHAR(500) NOT NULL,
    MIME_TYPE       NVARCHAR(150) NULL,
    FILE_SIZE       BIGINT        NULL,
    UPLOADED_BY     NVARCHAR(20)  NOT NULL,
    CREATED_AT      DATETIME      NOT NULL CONSTRAINT DF_CHAT_ATT_CREATED DEFAULT (GETDATE()),
    DELETED_AT      DATETIME      NULL
  );
  PRINT 'Created ZTB_CHAT_ATTACHMENT';
END`,
  },
  {
    name: "ZTB_CHAT_FRIEND",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_FRIEND')
BEGIN
  CREATE TABLE ZTB_CHAT_FRIEND (
    FRIEND_ID   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CTR_CD      NVARCHAR(20)  NOT NULL,
    REQUESTER   NVARCHAR(20)  NOT NULL,
    RECIPIENT   NVARCHAR(20)  NOT NULL,
    STATUS      NVARCHAR(12)  NOT NULL,                 -- PENDING | ACCEPTED | REJECTED | CANCELLED
    CREATED_AT  DATETIME      NOT NULL CONSTRAINT DF_CHAT_FRIEND_CREATED DEFAULT (GETDATE()),
    UPDATED_AT  DATETIME      NULL
  );
  PRINT 'Created ZTB_CHAT_FRIEND';
END`,
  },
  {
    name: "ZTB_CHAT_AUDIT",
    sql: `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ZTB_CHAT_AUDIT')
BEGIN
  CREATE TABLE ZTB_CHAT_AUDIT (
    AUDIT_ID        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CTR_CD          NVARCHAR(20)  NULL,
    CONVERSATION_ID INT           NULL,
    ACTOR           NVARCHAR(20)  NULL,
    ACTION          NVARCHAR(50)  NOT NULL,
    TARGET          NVARCHAR(100) NULL,
    DETAIL          NVARCHAR(1000) NULL,
    CREATED_AT      DATETIME      NOT NULL CONSTRAINT DF_CHAT_AUDIT_CREATED DEFAULT (GETDATE())
  );
  PRINT 'Created ZTB_CHAT_AUDIT';
END`,
  },
  {
    name: "IDX_CHAT_PARTICIPANT_EMPL",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_PARTICIPANT_EMPL')
  CREATE INDEX IDX_CHAT_PARTICIPANT_EMPL ON ZTB_CHAT_PARTICIPANT (CTR_CD, EMPL_NO, LEFT_AT);`,
  },
  {
    name: "IDX_CHAT_MESSAGE_CONV",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_MESSAGE_CONV')
  CREATE INDEX IDX_CHAT_MESSAGE_CONV ON ZTB_CHAT_MESSAGE (CONVERSATION_ID, MESSAGE_ID DESC);`,
  },
  {
    name: "UX_CHAT_MSG_CLIENT",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_CHAT_MSG_CLIENT')
  CREATE UNIQUE INDEX UX_CHAT_MSG_CLIENT ON ZTB_CHAT_MESSAGE (CTR_CD, SENDER_EMPL_NO, CLIENT_MESSAGE_ID)
  WHERE CLIENT_MESSAGE_ID IS NOT NULL;`,
  },
  {
    name: "UX_CHAT_CONV_DIRECT",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_CHAT_CONV_DIRECT')
  CREATE UNIQUE INDEX UX_CHAT_CONV_DIRECT ON ZTB_CHAT_CONVERSATION (CTR_CD, DIRECT_KEY)
  WHERE DIRECT_KEY IS NOT NULL;`,
  },
  {
    name: "IDX_CHAT_ATTACHMENT_MSG",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_ATTACHMENT_MSG')
  CREATE INDEX IDX_CHAT_ATTACHMENT_MSG ON ZTB_CHAT_ATTACHMENT (MESSAGE_ID, CONVERSATION_ID);`,
  },
  {
    name: "IDX_CHAT_FRIEND_PAIR",
    sql: `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_CHAT_FRIEND_PAIR')
  CREATE INDEX IDX_CHAT_FRIEND_PAIR ON ZTB_CHAT_FRIEND (CTR_CD, REQUESTER, RECIPIENT, STATUS);`,
  },
];

async function main() {
  const pool = await openConnection();
  console.log(`[chat-migration] Chạy ${STATEMENTS.length} bước...`);

  for (const statement of STATEMENTS) {
    try {
      await pool.query(statement.sql);
      console.log(`[chat-migration] OK: ${statement.name}`);
    } catch (error) {
      console.error(`[chat-migration] LỖI ở ${statement.name}:`, error?.message || error);
      throw error;
    }
  }

  const verify = await pool.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME IN ('ZTB_CHAT_CONVERSATION','ZTB_CHAT_PARTICIPANT','ZTB_CHAT_MESSAGE',
                         'ZTB_CHAT_ATTACHMENT','ZTB_CHAT_FRIEND','ZTB_CHAT_AUDIT')
    ORDER BY TABLE_NAME`);
  console.log("[chat-migration] Bảng hiện có:", (verify.recordset || []).map((r) => r.TABLE_NAME));
  console.log("[chat-migration] HOÀN THÀNH");
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
