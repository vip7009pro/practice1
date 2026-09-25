# Current Context - practice1

- Auth Middleware & Payload Decryption (2026-09-25):
  * Cập nhật `middleware/auth.js`: Thêm helper `isEncryptedPayload` kiểm tra đúng cấu trúc `{ encryptedData, encryptedKey, iv }` trước khi gọi `decryptData`, khắc phục triệt để lỗi TypeError khi nhận plain object từ command `login` hoặc các request không mã hóa.
  * Di chuyển bước giải mã lên trước whitelist check `PUBLIC_COMMANDS` (`login`, `login2`, `logout`, `checklogin`, `loadWebSetting`, `checkWebVer`, `checkLicense`) để command `checklogin` nhận đúng payload `{ COMPANY, CTR_CD, token_string }`.
  * Cập nhật `services/dbService.js`: Thêm guard kiểm tra an toàn `DATA?.COMPANY === "CMS"` chống lỗi TypeError khi `DATA` là undefined.
  * Khi token hết hạn hoặc verify thất bại, trả về HTTP status 401 kèm `{ tk_status: "TOKEN_EXPIRED", message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ" }` và dừng ngay (không gọi `next()`), bảo vệ các handler nội bộ.
  * Tối ưu `config/database_mssql.js`: Nâng `DEFAULT_POOL_SIZE` lên 40, giảm timeout từ 300s xuống 60s, thêm `acquireTimeoutMillis: 30000`, thêm event listener `pool.on("error")` tự động phục hồi kết nối database khi đứt mạng.
- Database Migration & Query Updates (2026-07-02): Added `PART_CODE_OTHERS` column (VARCHAR(1000) NULL) to table `DEFECT_MANAGEMENT` via a migration script. Updated SQL SELECT query in `loadQTRData` (`services/qcService.js`) to retrieve and return `PART_CODE_OTHERS`.
- Entry point: [index.js](file:///g:/NODEJS/practice1/index.js) (PM2 process `index`).
- File Upload: `routes/fileUpload.js` tự động tạo `TEMP_UPLOAD_FOLDER` đệ quy nếu chưa có.