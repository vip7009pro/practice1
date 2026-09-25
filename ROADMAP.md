# Roadmap - practice1

- [x] AUTH/MFA: Tích hợp tính năng Multi-Factor Authentication (MFA / 2FA) dùng Google Authenticator (TOTP RFC 6238) — bổ sung cột `MFA_ENABLED`, `MFA_SECRET`, `MFA_BACKUP_CODES`, `MFA_SETUP_DATE` vào bảng `ZTBEMPLINFO`; xây dựng module TOTP thuần built-in `crypto` an toàn tuyệt đối với `pkg` (`updatebe.exe`); cung cấp bộ API `getMfaStatus`, `setupMfa`, `verifyAndEnableMfa`, `disableMfa`, `verifyMfaLogin`; cập nhật `login`/`login2` yêu cầu OTP khi tài khoản bật bảo vệ 2 lớp; PM2 process `index` restart thành công.
- [x] AUTH/DECRYPT: Thêm helper `isEncryptedPayload` kiểm tra đúng định dạng payload mã hóa trước khi giải mã, di chuyển giải mã an toàn lên đầu middleware để `checklogin` nhận đúng token, bảo vệ handler chống lỗi plain object và crash `DATA.COMPANY`.
- [x] AUTH/DB: Chặn dứt điểm lỗi token hết hạn với HTTP 401 TOKEN_EXPIRED tại `middleware/auth.js`, bổ sung try-catch cho `decryptData`, thêm whitelist `PUBLIC_COMMANDS`; tối ưu `config/database_mssql.js` (pool.max 40, timeout 60s, tự phục hồi pool khi mất kết nối).
- [x] Run ALTER TABLE migration to add `PART_CODE_OTHERS` to `DEFECT_MANAGEMENT` table
- [x] Add `PART_CODE_OTHERS` to the SELECT query in `services/qcService.js` (loadQTRData function)
