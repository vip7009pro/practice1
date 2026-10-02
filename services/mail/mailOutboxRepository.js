/**
 * DAL cho tệp đính kèm SOẠN THẢO (ZTB_MAIL_OUTBOX).
 * Upload trước khi gửi ⇒ trả `id` cho FE; khi gửi server tra id (thuộc đúng user)
 * rồi đính kèm từ đường dẫn đã lưu (KHÔNG nhận path từ client ⇒ tránh path traversal).
 */
const { queryRows, queryOne } = require("./mailRepository");

async function insertOutbox({ ctrCd, emplNo, fileName, contentType, fileSize, storagePath }) {
  const rows = await queryRows(
    `INSERT INTO ZTB_MAIL_OUTBOX (CTR_CD, EMPL_NO, FILE_NAME, CONTENT_TYPE, FILE_SIZE, STORAGE_PATH)
     OUTPUT INSERTED.ID
     VALUES (@CTR, @EMPL, @NAME, @TYPE, @SIZE, @PATH)`,
    {
      CTR: ctrCd,
      EMPL: String(emplNo || "").trim().toUpperCase(),
      NAME: fileName ?? null,
      TYPE: contentType ?? null,
      SIZE: fileSize ?? null,
      PATH: storagePath,
    }
  );
  return rows[0]?.ID ?? null;
}

async function getOutbox({ id, emplNo }) {
  return queryOne(
    `SELECT * FROM ZTB_MAIL_OUTBOX WHERE ID = @ID AND EMPL_NO = @EMPL`,
    { ID: id, EMPL: String(emplNo || "").trim().toUpperCase() }
  );
}

async function listOutbox({ ids, emplNo }) {
  const list = (ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (list.length === 0) return [];
  const rows = await queryRows(
    `SELECT * FROM ZTB_MAIL_OUTBOX
     WHERE EMPL_NO = @EMPL AND ID IN (${list.join(",")})
     ORDER BY ID`,
    { EMPL: String(emplNo || "").trim().toUpperCase() }
  );
  return rows;
}

async function deleteOutbox({ ids, emplNo }) {
  const list = (ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (list.length === 0) return;
  await queryRows(
    `DELETE FROM ZTB_MAIL_OUTBOX WHERE EMPL_NO = @EMPL AND ID IN (${list.join(",")})`,
    { EMPL: String(emplNo || "").trim().toUpperCase() }
  );
}

module.exports = { insertOutbox, getOutbox, listOutbox, deleteOutbox };
