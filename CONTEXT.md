# Current Context - practice1

- EMAIL / POP3 SYNC ENGINE: Khắc phục lỗi dừng đồng bộ email ngày 15/10/2026 (2026-10-26):
  * **Nguyên nhân gốc rễ**:
    1. Khi tải thư qua cổng 110 (unencrypted plain-text), email msg #383 (từ `finance@toccataplalajp.com` ngày 15/10/2026 - email spam/phishing) bị tường lửa mạng quét DPI và ngắt drop dòng TCP ở byte 24329, dẫn tới socket bị Timeout sau 30s.
    2. Trong `services/mail/mailIngest.js`, khi socket bị timeout/destroy, vòng lặp pending tiếp tục chạy trên socket chết khiến toàn bộ email tiếp theo văng lỗi `POP3 chưa kết nối`, đồng thời lượt sync vẫn trả về `SUCCESS` nên UI không báo lỗi.
    3. Email lỗi không được đưa vào danh sách skip khi tài khoản không bật `SYNC_FROM_DATE`/`SYNC_TO_DATE` (do `skippedUidls` chỉ đọc khi `hasRange`), khiến các lượt sau tiếp tục cố tải email #383 và bị tắc nghẽn vĩnh viễn ở 387/442.
  * **Khắc phục triệt để Backend & Tài khoản**:
    - `services/mail/mailIngest.js`: Luôn nạp `skippedUidls` từ `ZTB_MAIL_SYNC_SKIP`; tự động đánh dấu UIDL bị lỗi RETR/timeout vào bảng skip (`RETR_FAILED`) để chống nghẽn hòm thư; bổ sung cơ chế tự động reconnect kết nối POP3 khi socket bị đứt để tiếp tục tải các email tiếp theo; cập nhật trạng thái `WARNING`/`ERROR` chuẩn xác khi không import được email nào do lỗi mạng.
    - Cập nhật cấu hình tài khoản `nvh1903@cmsbando.com` (Account ID 7): Chuyển sang POP3S cổng 995 (Bảo mật SSL/TLS, `POP3_SECURE = 1`) và SMTP cổng 25 (`SMTP_SECURE = 0`). Nhờ mã hóa SSL, tường lửa không can thiệp gói tin, email #383 tải về trong 750ms.
    - Đã đồng bộ hoàn tất 100% toàn bộ 442 email (đến ngày 24/10/2026 14:25), giao diện không còn kẹt ở 387/442. PM2 process `index` đã restart nạp code mới.

- REPORT / KINH DOANH REPORT: Bảng Summary RP_* & Refactor Backend kinhdoanhService.js (2026-10-13):
  * **Khởi tạo 6 bảng Summary `RP_*` trên SQL Server**:
    1. `RP_KD_DELIVERY_DAILY`: Doanh thu và giao hàng theo ngày/khách/PIC/In Nhanh.
    2. `RP_KD_OVERDUE_DAILY`: Trạng thái và số lượng quá hạn theo ngày kèm D_PLUS.
    3. `RP_KD_PO_WEEKLY`: Số lượng & doanh số PO phát sinh theo tuần/In Nhanh.
    4. `RP_KD_PO_BALANCE_TOTAL`: Tổng hợp tồn đơn toàn bộ hệ thống theo CTR_CD.
    5. `RP_KD_PO_BALANCE_WEEKLY`: Chi tiết tồn đơn theo tuần, năm, khách hàng.
    6. `RP_KD_CUSTOMER_PO_WEEKLY`: PO mới của từng khách theo tuần (nguồn trước Dynamic Pivot).
  * **Scripts & Services**:
    - `scripts/migrate_rp_kinhdoanh.js`: Khởi tạo bảng và nạp toàn bộ backdata lịch sử.
    - `services/reportSyncService.js`: Dịch vụ tự động đồng bộ (rolling 60 ngày) cho các bảng summary.
  * **Sửa lỗi Closing & Biểu đồ PO Balance (2026-10-13)**:
    - **Fix 3 bảng Closing bị trắng**: Sửa lỗi 4 dấu nháy `''''${DATA.CTR_CD}''''` và `''''TOTAL''''` thành 2 dấu nháy `''${DATA.CTR_CD}''` và `''TOTAL''` trong dynamic SQL string `@query`. Bỏ comment chứa nháy trong chuỗi `@query` của `getWeeklyClosingKD`. Cả 4 hàm closing (`getDailyClosingKD`, `getWeeklyClosingKD`, `loadMonthlyRevenueByCustomer`, `baocaodanhthutheokhachtheonguoimonthly`) đã trả về đầy đủ 40-41 dòng.
    - **Fix biểu đồ PO Balance (By Year, By Week, Customer)**: Cột Bigint trong SQL Server qua mssql driver trả về String làm hỏng tính tổng và scale trục biểu đồ; đã thêm `CAST(... AS FLOAT)` cho các trường `PO_BALANCE`, `PO_QTY`, `DELIVERY_QTY`. Chuẩn hóa điều kiện `PO_WEEK` hỗ trợ cả number (2) và string ('02') bằng `padStart(2, '0')`.
  * **Refactor Backend ([kinhdoanhService.js](file:///g:/NODEJS/practice1/services/kinhdoanhService.js))**:
    - Đã backup 100% các câu query cũ bằng comment block `/* === BACKUP TRUY VẤN CŨ === */`.
    - Đã chuyển sang query từ 6 bảng `RP_*` cho toàn bộ 22 command: `kd_dailyclosing`, `kd_weeklyclosing`, `kd_monthlyclosing`, `kd_annuallyclosing`, `customerRevenue`, `PICRevenue`, `dailyoverduedata`, `weeklyoverduedata`, `monthlyoverduedata`, `yearlyoverduedata`, `kd_pooverweek`, `kd_runningpobalance`, `traPOSummaryTotal`, `pobalanceByYear`, `pobalanceYearByWeekDetail`, `poBalanceByYearWeekCustomer`, `poBalanceByYearWeekCustomerByYear`, `loadCustomerWeeklyPOQty`, `getDailyClosingKD`, `getWeeklyClosingKD`, `loadMonthlyRevenueByCustomer`, `baocaodanhthutheokhachtheonguoimonthly`.
    - Thời gian phản hồi giảm từ 3s - 30s xuống 4ms - 74ms (Dynamic Pivot ~240ms).
  * **Đồng Bộ Dữ Liệu & Nhật Ký RP_SYNC_LOG (2026-10-13)**:
    - Tạo bảng `RP_SYNC_LOG` trên SQL Server: `REPORT_CODE`, `REPORT_NAME`, `LAST_SYNC_AT`, `STATUS`, `MESSAGE`, `DURATION_MS`, `UPDATED_BY`.
    - `services/reportSyncService.js`: Tự động cập nhật `MERGE RP_SYNC_LOG` sau mỗi lần đồng bộ `syncRPKinhDoanh`; export hàm `getReportSyncInfo`.
    - `services/kinhdoanhService.js`: Bổ sung 2 commands: `getReportSyncInfo` (lấy thời điểm cập nhật gần nhất) và `triggerReportSync` (cho phép frontend kích hoạt đồng bộ rolling tức thì).
  * **Fix Triệt Để PO Balance By Year & By Week 2026 (2026-10-13)**:
    - **Full Sync cho PO Balance**: Chuyển sync `RP_KD_PO_BALANCE_WEEKLY` sang Full Sync toàn bộ các năm (chạy ~5s) thay vì rolling 60 ngày để bảo tồn các PO tồn từ năm cũ và các tuần đầu năm khi có biến động giao hàng/hủy PO gần đây.
    - **Fix lọc HAVING thay cho WHERE**: Chuyển điều kiện lọc `PO_BALANCE > 0` từ `WHERE` sang `HAVING SUM(PO_BALANCE) > 0` trong `pobalanceByYear`, `pobalanceYearByWeekDetail` và `poBalanceByYearWeekCustomerByYear`, giúp bảo toàn 100% giá trị các cột `PO_QTY` và `DELIVERY_QTY` của các tuần (khớp tuyệt đối 41/41 tuần năm 2026 so với bản cũ).
  * **Fix Lệch Trục Tung Biểu Đồ PO By Week, Monthly Closing, Yearly Closing (2026-10-13)**:
    - **Backend**: Cột `DELIVERY_QTY` (trong `RP_KD_DELIVERY_DAILY`) và `PO_QTY` (trong `RP_KD_PO_WEEKLY`) có kiểu BIGINT khiến tedious trả về kiểu String. Vì JS so sánh chuỗi theo từ điển ('641M' > '1.72B') làm Recharts cụt domain trục Y ở 800M và vẽ đường vọt ra ngoài đỉnh biểu đồ. Đã thêm `CAST(... AS FLOAT)` cho `kd_annuallyclosing`, `kd_monthlyclosing`, `kd_weeklyclosing`, `kd_dailyclosing` và `kd_pooverweek` (kèm fallback ngày & CTR_CD).
  * **Bộ Lập Lịch Refresh Báo Cáo Chung 10 Phút & Central Registry ([reportSyncService.js](file:///g:/NODEJS/practice1/services/reportSyncService.js), [index.js](file:///g:/NODEJS/practice1/index.js)) (2026-10-13)**:
    - **Central Registry (`REPORT_REGISTRY`)**: Cấu trúc trung tâm đăng ký báo cáo toàn hệ thống ERP (`code`, `name`, `department`, `minIntervalMinutes: 10`, `syncFn`). Hỗ trợ hàm `registerReportSync` cho phép các phân hệ khác (Sản Xuất, Kho, Mua Hàng, QC...) đăng ký chạy chung luồng.
    - **Reload Guard chống spam**: Hàm `shouldSyncReport(reportCode, 10)` kiểm tra khoảng cách thời gian `DATEDIFF(second, LAST_SYNC_AT, GETDATE())` trong bảng `RP_SYNC_LOG`. Kể cả khi khởi động lại backend, nếu chưa đủ 10 phút (600 giây) thì hệ thống trả về `SKIPPED` và tuyệt đối KHÔNG chạy lại backdata.
    - **Scheduler kiểm tra mỗi 60s**: Hàm `startReportSyncScheduler(10)` kiểm tra định kỳ mỗi 60s (quét DB cực nhẹ 1-2ms), khi tới mốc >= 10 phút mới sync. Khởi động kiểm tra sau 15 giây khi server start.
    - **Phân tách 2 chế độ**: Tự động background (`force: false` - tuân thủ guard 10 phút) và Thao tác chủ động trên UI (`force: true` - chạy tức thì).
    - Tích hợp dừng scheduler an toàn khi nhận tín hiệu `SIGINT` trong `index.js`.


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