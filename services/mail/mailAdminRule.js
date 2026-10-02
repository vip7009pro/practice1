/**
 * Quy tắc QUẢN TRỊ EMAIL — nguồn duy nhất cho toàn module (BE).
 *
 * Quyền quản trị Email **chỉ** dành cho các EMPL_NO trong env `MAIL_ADMIN_EMPL_NOS`
 * (mặc định: **chỉ `NHU1903`**). KHÔNG dùng `JOB_NAME`/chức danh: Leader/Admin
 * vẫn KHÔNG có quyền quản trị Email.
 *
 * ⚠️ Hằng số đọc 1 lần lúc require ⇒ đổi env phải RESTART backend.
 */
const ADMIN_EMPL_NOS = new Set(
  String(process.env.MAIL_ADMIN_EMPL_NOS || "NHU1903")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean)
);

/** Người gọi có phải admin Email không. */
function isMailAdmin(req) {
  const p = req.payload_data || {};
  const empl = String(p.EMPL_NO || "").trim().toUpperCase();
  return ADMIN_EMPL_NOS.has(empl);
}

module.exports = { isMailAdmin, ADMIN_EMPL_NOS };
