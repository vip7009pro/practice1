# Current Context - practice1

- MFA / Multi-Factor Authentication (Google Authenticator) (2026-09-25):
  * **Database Migration (`ZTBEMPLINFO`)**: Chạy script `scripts/migrate_mfa_columns.js` bổ sung thành công 4 cột: `MFA_ENABLED` (BIT NOT NULL DEFAULT 0), `MFA_SECRET` (VARCHAR(100) NULL), `MFA_BACKUP_CODES` (NVARCHAR(1000) NULL), `MFA_SETUP_DATE` (DATETIME NULL). Mặc định toàn bộ user là tắt MFA.
  * **TOTP Engine RFC 6238 (`utils/totpUtils.js`)**: Triển khai thuật toán TOTP chuẩn bằng built-in `crypto` của Node.js (Base32, HMAC-SHA1, step 30s, 6 digits, window ±30s, backup codes generator, otpauth URI) không phụ thuộc external runtime, tương thích 100% với `pkg` (`updatebe.exe`).
  * **MFA Service (`services/mfaService.js`)**: Triển khai các command handlers: `getMfaStatus` (lấy trạng thái MFA), `setupMfa` (sinh secret & QR URL), `verifyAndEnableMfa` (xác thực OTP lần đầu, bật `MFA_ENABLED = 1` & cấp 8 mã backup codes), `disableMfa` (tắt MFA kèm xác thực an toàn), `verifyMfaLogin` (xác thực bước 2 khi đăng nhập, hỗ trợ cả OTP 6 số và mã dự phòng, tự động hủy mã dự phòng đã dùng).
  * **Auth Flow Integration (`services/authService.js` & `middleware/auth.js`)**:
    - Trong `login` và `login2`: Sau khi xác thực đúng tài khoản/mật khẩu, nếu `MFA_ENABLED = 1` trả về `tk_status: "MFA_REQUIRED"` kèm `temp_token` (hạn 5 phút) để yêu cầu nhập mã OTP bước 2.
    - Thêm `verifyMfaLogin` vào `PUBLIC_COMMANDS` trong `middleware/auth.js`.
  * **Khởi động lại**: PM2 process `index` (pid 13768) đã restart thành công và nạp code mới.

- Auth Middleware & Payload Decryption (2026-09-25):
  * Cập nhật `middleware/auth.js`: Thêm helper `isEncryptedPayload` kiểm tra đúng cấu trúc payload trước khi giải mã; whitelist `PUBLIC_COMMANDS`; tối ưu `config/database_mssql.js`.
- Entry point: [index.js](file:///g:/NODEJS/practice1/index.js) (PM2 process `index`).