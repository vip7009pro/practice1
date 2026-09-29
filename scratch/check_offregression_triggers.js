/**
 * Kiểm tra CHỈ ĐỌC: bảng ZTBOFFREGISTRATIONTB có trigger đang bật không?
 *
 * Lý do: câu lệnh INSERT ... OUTPUT INSERTED.OFF_ID sẽ bị SQL Server từ chối
 * (lỗi 334) nếu bảng đích có trigger đang bật. Nếu có trigger, phải chuyển sang
 * cách lấy OFF_ID khác để không làm hỏng luồng đăng ký nghỉ đang chạy production.
 */
const { queryDB_New } = require("../config/database");

(async () => {
  try {
    const triggers = await queryDB_New(
      `SELECT t.name AS TRIGGER_NAME, t.is_disabled
       FROM sys.triggers t
       WHERE t.parent_id = OBJECT_ID('ZTBOFFREGISTRATIONTB')`
    );
    const rows = Array.isArray(triggers?.data) ? triggers.data : [];
    console.log("rows:", rows.length);
    rows.forEach((row) => console.log(`  - ${row.TRIGGER_NAME} is_disabled=${row.is_disabled}`));
    console.log(
      rows.length === 0
        ? "=> KHÔNG có trigger: OUTPUT INSERTED.OFF_ID an toàn."
        : "=> CÓ trigger: KHÔNG dùng được OUTPUT, phải đổi cách lấy OFF_ID."
    );
  } catch (error) {
    console.log("Không kết nối được DB hoặc truy vấn lỗi:", error?.message || error);
  } finally {
    process.exit(0);
  }
})();
