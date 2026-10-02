/** Liệt kê mailbox + đính kèm để chọn tham số test. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();
const repo = require("../services/mail/mailRepository");

(async () => {
  console.table(
    await repo.queryRows(
      `SELECT TOP 5 a.ID, a.CTR_CD, a.EMPL_NO, a.EMAIL_ADDRESS,
              (SELECT COUNT(*) FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID = a.ID) AS MSGS
       FROM ZTB_MAIL_ACCOUNT a ORDER BY MSGS DESC`
    )
  );
  console.table(
    await repo.queryRows(
      `SELECT TOP 6 A.ID, A.FILE_NAME, A.CONTENT_TYPE, A.IS_INLINE, A.STATUS, M.FOLDER
       FROM ZTB_MAIL_ATTACHMENT A JOIN ZTB_MAIL_MESSAGE M ON M.ID = A.MESSAGE_ID
       WHERE A.STATUS = 'READY' ORDER BY A.ID DESC`
    )
  );
  const { openConnection } = require("../config/database");
  (await openConnection()).close();
})().catch((e) => {
  console.error(e?.message || e);
  process.exitCode = 1;
});
