# KẾ HOẠCH TRIỂN KHAI — MODULE EMAIL TẬP TRUNG (ERP)

> Phase 9 — Pilot / Rollout. Ngày: 2026-10-02.
> Kèm theo: `MAIL_DELIVERABLES_REPORT.md` (báo cáo bàn giao), `MAIL_BACKUP_STRATEGY.md` (sao lưu/phục hồi).

---

## 1. Nguyên tắc triển khai

1. **Pilot trước, mở rộng sau:** chạy 2–5 mailbox thật trong ≥ 1 tuần, đủ để gặp các ca lỗi (mail lớn, MIME lạ, POP3 ngắt kết nối, TLS tự ký).
2. **Không đổi hạ tầng mail server:** chỉ đọc POP3 (một chiều) và gửi qua SMTP; không sửa/xoá mail trên server.
3. **Có đường lùi:** tắt worker là hệ thống ngừng ingest, dữ liệu đã nhập vẫn đọc được bình thường.
4. **Không để người dùng tự khai mật khẩu nếu không muốn:** đặt `MAIL_ALLOW_SELF_SERVICE=false` để chỉ admin cấu hình.

---

## 2. Chuẩn bị hạ tầng (trước pilot)

| # | Việc | Lệnh / ghi chú |
|---|---|---|
| 1 | Tạo bảng + index | `node scripts/migrate_mail_tables.js` (idempotent, chạy lại an toàn) |
| 2 | Sinh khoá mã hoá credential | `MAIL_CRED_KEY` = chuỗi hex 32 byte; **sao lưu ở nơi an toàn** — mất khoá = mất mật khẩu mailbox |
| 3 | Cấu hình kho lưu trữ | `MAIL_STORAGE_PATH` (hoặc `MAIL_NAS_UNC` + `MAIL_NAS_USER/PASS/DOMAIN/DRIVE`) |
| 4 | Kiểm tra quyền ghi kho | Tạo 1 file thử rồi xoá; kiểm tra quota dung lượng (xem §5) |
| 5 | Cấu hình SMTP mặc định (nếu công ty dùng chung 1 máy chủ) | `MAIL_SMTP_HOST/PORT/SECURE`; máy chủ tự ký ⇒ `MAIL_TLS_REJECT_UNAUTHORIZED=false` |
| 6 | Khai báo admin | `MAIL_ADMIN_EMPL_NOS` (mặc định `NHU1903` — chỉ EMPL_NO, KHÔNG dùng `JOB_NAME`) |
| 7 | Khởi động lại backend | PM2 restart; xác nhận log `[mailworker] started` |
| 8 | Kiểm tra API | `POST /api {command:"emailBootstrap"}` trả `tk_status:"OK"` |

---

## 3. Giai đoạn 1 — Pilot (2–5 mailbox, ~1 tuần)

**Chọn mailbox pilot:** ưu tiên hộp thư có lưu lượng vừa (vài chục → vài trăm mail/ngày), có ít nhất 1 hộp thư nhận email tiếng Hàn/tiếng Việt có đính kèm & ảnh inline.

**Cách khai báo:** dùng giao diện admin (Nhập từ Excel) chứ không sửa DB tay.

| Cột Excel | Bắt buộc | Ghi chú |
|---|---|---|
| `MÃ NV` (hoặc `EMPL_NO`) | ✅ | Không có trong hồ sơ ⇒ **cảnh báo**, dòng vẫn nhập được nhưng kiểm tra lại |
| `EMAIL` (`EMAIL_ADDRESS`) | ✅ | Trùng trong công ty ⇒ bỏ qua dòng |
| `MÁY CHỦ POP3` (`POP3_HOST`) | ✅ | Trống ⇒ dùng `MAIL_DEFAULT_POP3_HOST` |
| `CỔNG POP3` (`POP3_PORT`) | ➖ | Trống ⇒ `995` nếu SSL, `110` nếu không |
| `SSL POP3` | ➖ | Trống ⇒ **suy ra theo cổng** (995/465 ⇒ SSL) |
| `TÊN ĐĂNG NHẬP` (`POP3_USERNAME`) | ➖ | Trống ⇒ dùng địa chỉ email |
| `MẬT KHẨU` (`POP3_PASSWORD`) | ✅ (lần đầu) | Mã hoá AES-256-GCM; để trống khi cập nhật ⇒ **giữ mật khẩu cũ** |
| `MÁY CHỦ SMTP` / `CỔNG SMTP` / `SSL SMTP` | ➖ | Trống ⇒ `MAIL_SMTP_*` hoặc suy từ POP3 (SSL ⇒ 465, không ⇒ 25) |

Quy trình: **Tải tệp mẫu → điền → “Kiểm tra trước” (DRY_RUN) → sửa hết lỗi → “Nhập”** → bấm **Đồng bộ tất cả** và theo dõi dải tiến độ.
Giới hạn **2000 dòng/lần** — chia nhiều lần nếu danh sách lớn hơn.

**Checklist theo dõi pilot (mỗi ngày):**

- [ ] `PrecisionEmailAdmin` → cột **Còn thiếu** giảm về ~0 với mọi mailbox.
- [ ] Nhật ký đồng bộ (`ZTB_MAIL_SYNC_LOG`): không có dòng `FAILED` lặp lại cùng mailbox.
- [ ] Đối chiếu 10 email ngẫu nhiên: subject, người gửi, thời gian, body, đính kèm khớp với Outlook/webmail.
- [ ] Mở 1 email có ảnh inline → ảnh hiển thị (đã rewrite `cid:`).
- [ ] Gửi thử 1 email ra Gmail ngoài công ty: body + ảnh hiển thị đúng, không có `data:image` trong raw.
- [ ] Xoá 1 email trong ERP → chỉ xoá với người đó, email trên mail server còn nguyên.
- [ ] Tắt/bật chuông mute 1 mailbox → không nhận Web Push khi đã tắt.
- [ ] Tìm kiếm 1 từ khoá tiếng Việt có dấu và 1 từ khoá tiếng Hàn → có kết quả, thời gian `tookMs` chấp nhận được.
- [ ] Người dùng báo lỗi: ghi lại EMPL_NO + thời điểm + nội dung để tái hiện.

**Tiêu chí đạt pilot:** không có lỗi ingest lặp lại, không mất dữ liệu (đối soát NAS sạch), không có phản hồi "không thấy email" quá 1 lần/tuần/mailbox.

---

## 4. Giai đoạn 2 — Go-live toàn công ty

1. Chốt danh sách mailbox (Excel) → import theo lô 500–2000 dòng.
2. **Bật đồng bộ theo đợt** (mỗi đợt ~20–30 mailbox) để tránh quá tải POP3 server của công ty; theo dõi `SERVER_TOTAL`/`Đã tải`.
3. Thông báo người dùng (kèm hướng dẫn ở §7).
4. Ngày 1–3 sau go-live: kiểm tra mỗi ngày 2 lần (sáng/chiều) các chỉ số ở §5.
5. Sau khi ổn định: đặt lịch đối soát NAS tự động (`MAIL_RECONCILE_EVERY_TICKS`) và chạy restore drill theo `MAIL_BACKUP_STRATEGY.md`.

---

## 5. Giám sát & ngưỡng cảnh báo

| Chỉ số | Nguồn | Ngưỡng cần xử lý |
|---|---|---|
| Mailbox có email lỗi | `emailAdminOverview` (cột lỗi) | > 0 kéo dài 2 nhịp quét |
| Mailbox "còn thiếu" không giảm | `emailSyncStatus` / KPI | không giảm trong 30 phút |
| Nhật ký đồng bộ FAILED | `ZTB_MAIL_SYNC_LOG` | ≥ 3 lần liên tiếp cùng mailbox ⇒ kiểm tra credential/cổng/TLS |
| Số email mỗi lần quét | log `[mailingest]` | tăng đột biến liên tục ⇒ có thể đang bị gửi bom thư |
| Dung lượng kho | `emailStorageDashboard` (theo năm + tăng trưởng 14 ngày) | > 80% quota NAS ⇒ xem lại retention |
| File orphan / lệch DB-NAS | `emailStorageDashboard` + `emailReconcileNow` | orphan tăng liên tục ⇒ kiểm tra ghi NAS |
| Lỗi gửi SMTP | `ZTB_MAIL_OUTBOX` + thông báo UI | > 5% số lần gửi ⇒ kiểm tra cổng 25/465, TLS |
| Độ trễ realtime | trải nghiệm người dùng | > 90 s (bằng 2 nhịp quét) ⇒ xem worker còn chạy không |

Lệnh kiểm tra nhanh khi có sự cố:
- Worker còn chạy: `pm2 logs <app>` → tìm `[mailworker]`.
- Mailbox lỗi: `emailAdminOverview` (admin UI) → nút **Nhật ký**.
- Đồng bộ ngay 1 mailbox: nút **Đồng bộ ngay** (hoặc `emailSyncNow`).
- Ép quét lại từ đầu: nút **Reset con trỏ** (chỉ dùng khi nghi ngờ checkpoint sai — sẽ tải lại theo UIDL nên không tạo trùng).
- Đối soát NAS ↔ DB: `emailReconcileNow`.

---

## 6. Rollback

| Mức | Hành động | Ảnh hưởng |
|---|---|---|
| 1 — Tạm ngừng nhận mail mới | `MAIL_WORKER_ENABLED=false` + restart | Người dùng vẫn đọc/gửi/tìm kiếm email **đã nhập**; không có email mới nào vào ERP |
| 2 — Ngừng toàn bộ tính năng mail | Ẩn lối vào hộp thư trong UI (cấu hình/bản build) | Trở lại dùng Outlook/webmail |
| 3 — Gỡ hoàn toàn | Drop các bảng `ZTB_MAIL_*` + xoá `MAIL_STORAGE_PATH` | Mất toàn bộ dữ liệu ERP-side; mail server **không** bị ảnh hưởng. Chỉ làm sau khi đã export báo cáo |

> Vì POP3 chỉ đọc một chiều, rollback **không** làm mất email trên mail server. Rủi ro duy nhất là mất metadata/trạng thái đọc-sao đã tạo trong ERP.

---

## 7. Hướng dẫn nhanh

### 7.1 Cho người dùng

- **Mở hộp thư:** biểu tượng thư trên thanh công cụ (hoặc deep-link `/?mail=<id>` khi bấm thông báo). Badge đỏ = số email chưa đọc.
- **Thư mục:** Hộp thư đến, Có gắn sao, Đã gửi, Lưu trữ, Thư rác, Thùng rác, Nháp. Nút ẩn/hiện cột để gọn màn hình.
- **Tìm kiếm:** gõ từ khoá, hoặc dùng cú pháp `from:`, `to:`, `subject:`, `body:`, `filename:`, `has:attachment`, `is:unread|read|starred`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`. Có pill lọc nhanh (Chưa đọc / Đính kèm / Có sao) và nút sắp xếp.
- **Soạn thư:** Đến/Cc/Bcc (gợi ý từ danh bạ), chèn ảnh bằng Ctrl+V, dán bảng từ Excel ⇒ hiện hộp thoại chọn **Dán dạng bảng** (sửa được từng ô) hoặc **Dán dạng ảnh** (nguyên bản như Excel). Nháp tự lưu sau ~1,5 giây.
- **Đính kèm:** bấm để tải, nút **Xem trước** cho ảnh/PDF; tệp nguy hiểm có badge cảnh báo (ERP luôn ép tải xuống, không mở trực tiếp).
- **Thông báo:** chuông cạnh mỗi mailbox để tắt/bật thông báo cho mailbox đó. Tắt = không nhận Web Push cho mailbox ấy.
- **Danh bạ (nhóm gửi nhanh / CC nhanh):** mục **Danh bạ** trong sidebar hộp thư.
  - Tạo nhóm: nhập tên nhóm + dán danh sách email (ngăn cách bằng dấu phẩy, dấu chấm phẩy hoặc xuống dòng; hỗ trợ dạng `Kế toán <ketoan@congty.com>`). Bật **Chia sẻ cho toàn công ty** nếu muốn đồng nghiệp cùng dùng (chỉ bạn sửa được).
  - **Tạo nhóm từ người nhận của 1 email:** mở email → biểu tượng **playlist_add** trên thanh tiêu đề → chọn lấy từ **Đến / Cc / Bcc** → lưu.
  - **Tag nhanh khi soạn thư:** hàng chip nhóm danh bạ nằm ngay dưới ô Tiêu đề — bấm tên nhóm để thêm vào **Đến**, hoặc bấm mũi tên ▾ để chọn **Đến / Cc / Bcc**. Nút **Nhóm danh bạ** mở hộp chọn nhiều nhóm cùng lúc; địa chỉ trùng sẽ tự bỏ qua.
  - Nút **Lưu To/Cc thành nhóm** trong hộp soạn thư để lưu nhanh danh sách đang gõ thành 1 nhóm mới.
- **Xoá:** xoá mềm cho riêng bạn; có thể khôi phục. Email trên máy chủ công ty không bị xoá.
- **Cấu hình Email của tôi:** chỉ hiển thị khi công ty cho phép tự cấu hình (`MAIL_ALLOW_SELF_SERVICE`). Nhập thông tin POP3/SMTP rồi bấm **Kiểm tra kết nối**; nút **Dò cổng SMTP** tự tìm cổng đúng.

### 7.2 Cho admin

- **Mở:** tab Cài đặt → **Quản trị Email**, hoặc trong cửa sổ hộp thư → **Quản trị Email** (chỉ admin thấy mục này).
- **Bảng mailbox:** Bật/Tắt · Test POP3 · Đồng bộ ngay · Nhật ký · Reset con trỏ. Bộ lọc + tìm kiếm theo mã NV/email.
- **Nhập từ Excel:** tải tệp mẫu → điền (tên cột linh hoạt, xem §3) → **Kiểm tra trước** → **Nhập**. Kết quả: `tạo mới / cập nhật / bỏ qua / lỗi / cảnh báo`.
- **Đồng bộ tất cả:** chạy nền tuần tự, có dải tiến độ; không chặn thao tác khác.
- **Dashboard dung lượng:** tổng, theo nhân viên, theo năm, tăng trưởng 14 ngày, file vật lý/orphan/dung lượng tiết kiệm nhờ dedup.
- **Đối soát:** `emailReconcileNow` để đối chiếu DB ↔ NAS (xoá file mồ côi, phát hiện thiếu file).
- **Quy tắc admin:** **chỉ** EMPL_NO trong `MAIL_ADMIN_EMPL_NOS` (mặc định `NHU1903`) mới thấy/vào được Quản trị Email — chức danh Leader/Admin **không** có quyền. Ai sửa env thì phải restart backend.

---

## 8. Việc cần làm ngay sau bàn giao

1. ⚠️ **Nhập lại mật khẩu POP3 cho `nvh1903@cmsbando.com`** (đã bị test ghi đè — xem §7.1 của báo cáo bàn giao) và bấm **Kiểm tra kết nối**.
2. Chạy `node scripts/migrate_mail_tables.js` trên môi trường production (nếu chưa).
3. Sao lưu `MAIL_CRED_KEY` vào kho bí mật của công ty.
4. Kiểm tra quota NAS và lập lịch sao lưu theo `MAIL_BACKUP_STRATEGY.md`.
5. Lên kế hoạch **Full-Text Search** nếu tổng số email vượt ~50k (xem §8 báo cáo bàn giao).
