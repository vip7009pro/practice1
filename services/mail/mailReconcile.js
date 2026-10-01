/**
 * Reconciliation — dò & sửa lệch giữa DB và file trên NAS.
 *
 * Vì transaction DB không bao được thao tác NAS, có thể xảy ra:
 *  - File vật lý tồn tại nhưng REF_COUNT = 0 (email bị xoá / commit lỗi) ⇒ dọn.
 *  - Attachment STATUS='READY' nhưng file không tồn tại ⇒ đánh dấu FAILED.
 *  - REF_COUNT sai lệch so với số attachment thực tế ⇒ đếm lại.
 *
 * Chạy định kỳ bởi worker (mỗi N tick) hoặc thủ công qua command admin.
 */
const msgRepo = require("./mailMessageRepository");
const mailStorage = require("./mailStorage");

/** Đếm lại REF_COUNT của mọi file vật lý theo số attachment tham chiếu (nguồn chân lý). */
async function recountRefs() {
  const result = await require("./mailRepository").queryRows(
    `UPDATE pf
       SET REF_COUNT = ISNULL(cnt.C, 0)
       OUTPUT INSERTED.ID, INSERTED.REF_COUNT
     FROM ZTB_MAIL_PHYSICAL_FILE pf
     OUTER APPLY (
        SELECT COUNT(*) AS C FROM ZTB_MAIL_ATTACHMENT a WHERE a.PHYSICAL_FILE_ID = pf.ID
     ) cnt
     WHERE pf.REF_COUNT <> ISNULL(cnt.C, 0)`
  );
  return result.length;
}

/** Dọn file vật lý không còn attachment nào tham chiếu (và xoá cả file trên đĩa). */
async function cleanupOrphans({ limit = 500 } = {}) {
  const orphans = await msgRepo.listOrphanPhysicalFiles({ limit });
  let removed = 0;
  for (const file of orphans) {
    mailStorage.removeFile(file.STORAGE_PATH);
    await msgRepo.deletePhysicalFile(file.ID);
    removed += 1;
  }
  return removed;
}

/** Kiểm tra attachment READY có file thật trên đĩa; thiếu ⇒ FAILED. */
async function verifyFiles({ limit = 500 } = {}) {
  const rows = await require("./mailRepository").queryRows(
    `SELECT TOP (@LIMIT) a.ID, pf.STORAGE_PATH
     FROM ZTB_MAIL_ATTACHMENT a
     JOIN ZTB_MAIL_PHYSICAL_FILE pf ON pf.ID = a.PHYSICAL_FILE_ID
     WHERE a.STATUS = 'READY'`,
    { LIMIT: Math.min(Number(limit) || 500, 2000) }
  );
  let failed = 0;
  for (const row of rows) {
    if (row.STORAGE_PATH && !mailStorage.exists(row.STORAGE_PATH)) {
      await msgRepo.updateAttachmentStatus(row.ID, { status: "FAILED" });
      failed += 1;
    }
  }
  return failed;
}

/** Chạy toàn bộ quy trình reconcile. */
async function reconcile(options = {}) {
  const started = Date.now();
  const refs = await recountRefs();
  const orphans = await cleanupOrphans(options);
  const failed = await verifyFiles(options);
  const ms = Date.now() - started;
  if (refs || orphans || failed) {
    console.log(`[mailreconcile] refs=${refs} orphans=${orphans} failed=${failed} (${ms}ms)`);
  }
  return { refs, orphans, failed, ms };
}

module.exports = { reconcile, recountRefs, cleanupOrphans, verifyFiles };
