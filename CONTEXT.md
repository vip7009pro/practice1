# Current Context - practice1

- Loại bỏ hardcode dòng máy sản xuất bằng CTE động (`services/sanxuatService.js`) (2026-10-03):
  * Sử dụng CTE: `WITH MACHINE_TB AS (SELECT DISTINCT SUBSTRING(EQ_NAME,1,2) AS EQ_SERIES FROM ZTB_SX_EQ_STATUS)`.
  * Đã comment lại toàn bộ truy vấn cũ để bảo lưu đối chiếu và viết truy vấn mới phía dưới.
  * Đã cập nhật 4 command liên quan:
    1. `ycsxbalanceleadtimedata`: Thay hardcode `IN ('FR','SR','DC','ED')` bằng `IN (SELECT EQ_SERIES FROM MACHINE_TB)`.
    2. `ycsxbalancecapa`: Thêm CTE `MACHINE_TB`, thay hardcode `EQ1/EQ2 IN ('FR','SR','DC','ED')` bằng CTE động.
    3. `loadLeadtimeData`: Thêm CTE `MACHINE_TB`, thay 4 khối `UNION ALL` cố định từng dòng máy bằng `CROSS JOIN MACHINE_TB`.
    4. `sxachivementdata`: Thêm CTE `MACHINE_TB`, thay điều kiện kiểm tra `M100.EQ2 NOT IN ('FR','SR','DC','ED')` bằng `NOT IN (SELECT EQ_SERIES FROM MACHINE_TB)`.
  * Cú pháp Node.js đã được kiểm tra (`node -c`) đảm bảo 100% hợp lệ.

- MFA / Multi-Factor Authentication (Google Authenticator) (2026-09-25):
  * **Database Migration (`ZTBEMPLINFO`)**: Chạy script `scripts/migrate_mfa_columns.js` bổ sung thành công 4 cột: `MFA_ENABLED` (BIT NOT NULL DEFAULT 0), `MFA_SECRET` (VARCHAR(100) NULL), `MFA_BACKUP_CODES` (NVARCHAR(1000) NULL), `MFA_SETUP_DATE` (DATETIME NULL). Mặc định toàn bộ user là tắt MFA.
  * **TOTP Engine RFC 6238 (`utils/totpUtils.js`)**: Triển khai thuật toán TOTP chuẩn bằng built-in `crypto` của Node.js (Base32, HMAC-SHA1, step 30s, 6 digits, window ±30s, backup codes generator, otpauth URI) không phụ thuộc external runtime, tương thích 100% với `pkg` (`updatebe.exe`).
  * **MFA Service (`services/mfaService.js`)**: Triển khai các command handlers: `getMfaStatus` (lấy trạng thái MFA), `setupMfa` (sinh secret & QR URL), `verifyAndEnableMfa` (xác thực OTP lần đầu, bật `MFA_ENABLED = 1` & cấp 8 mã backup codes), `disableMfa` (tắt MFA kèm xác thực an toàn), `verifyMfaLogin` (xác thực bước 2 khi đăng nhập, hỗ trợ cả OTP 6 số và mã dự phòng, tự động hủy mã dự phòng đã dùng).
  * **Auth Flow Integration (`services/authService.js` & `middleware/auth.js`)**:
    - Trong `login` và `login2`: Sau khi xác thực đúng tài khoản/mật khẩu, nếu `MFA_ENABLED = 1` trả về `tk_status: "MFA_REQUIRED"` kèm `temp_token` (hạn 5 phút) để yêu cầu nhập mã OTP bước 2.
    - Thêm `verifyMfaLogin` vào `PUBLIC_COMMANDS` trong `middleware/auth.js`.
  * **Fix Company Not Supported (`services/dbService.js`)**: Cập nhật điều kiện lọc `isCompanyAllowed` cho phép lệnh `verifyMfaLogin` và cho qua khi `DATA.COMPANY` không được truyền hoặc bằng `"CMS"`.
  * **Khởi động lại**: PM2 process `index` (pid 8476) đã restart thành công và nạp code mới.

- Auth Middleware & Payload Decryption (2026-09-25):
  * Cập nhật `middleware/auth.js`: Thêm helper `isEncryptedPayload` kiểm tra đúng cấu trúc payload trước khi giải mã; whitelist `PUBLIC_COMMANDS`; tối ưu `config/database_mssql.js`.
- Entry point: [index.js](file:///g:/NODEJS/practice1/index.js) (PM2 process `index`).