# Chiến lược sao lưu & phục hồi — Module Email tập trung

> Áp dụng cho module Email của ERP (POP3 ingestion → SQL Server + NAS).
> Nguyên tắc xuyên suốt: **COPY-ONLY** — ERP chỉ ĐỌC mail từ POP3 server, **không bao giờ xoá mail trên server**.
> Xoá trong ERP = `soft-delete` theo từng người (`ZTB_MAIL_USERSTATE.DELETED_AT`), không mất dữ liệu gốc.

## 1. Thành phần cần sao lưu

| Thành phần | Nội dung | Vị trí |
|---|---|---|
| **SQL Server** | 12+ bảng `ZTB_MAIL_*` (metadata, trạng thái đọc, checkpoint, log, nháp, mute…) | DB ERP |
| **NAS** | Body HTML (`<root>/<CTR>/<yyyy>/<mm>/<mailbox>/<ref>/body.html`) + file vật lý dedup (`<root>/_files/<ab>/<sha256>.<ext>`) + `_outbox/` | `MAIL_STORAGE_PATH` (UNC) |
| **Cấu hình** | `.ENV` (`MAIL_CRED_KEY`, `MAIL_STORAGE_PATH`, `MAIL_*`) | server ERP |

⚠️ **`MAIL_CRED_KEY` phải được sao lưu riêng và an toàn.** Mất key ⇒ **không giải mã được** credential POP3/SMTP đã lưu (dữ liệu email vẫn còn, chỉ không tự sync/gửi được nữa).

## 2. SQL Server

- **Full backup**: hằng ngày (ví dụ 23:00), giữ 14–30 bản.
- **Log backup**: mỗi 15–30 phút nếu DB đang ở FULL recovery (RPO ~15 phút).
- Ví dụ (chạy bằng SQL Agent job hoặc script):

```sql
BACKUP DATABASE [<DB_ERP>] TO DISK = N'D:\Backup\ERP_FULL_' + FORMAT(GETDATE(),'yyyyMMdd_HHmm') + N'.bak'
WITH INIT, COMPRESSION, CHECKSUM, STATS = 10;

BACKUP LOG [<DB_ERP>] TO DISK = N'D:\Backup\ERP_LOG_' + FORMAT(GETDATE(),'yyyyMMdd_HHmm') + N'.trn'
WITH INIT, COMPRESSION, CHECKSUM;

RESTORE VERIFYONLY FROM DISK = N'D:\Backup\ERP_FULL_...bak' WITH CHECKSUM;  -- kiểm tra integrity hằng ngày
```

- Sau khi restore: chạy lại `node scripts/migrate_mail_tables.js` (idempotent) để bảo đảm schema mới nhất.

## 3. NAS (body + attachment)

Chọn 1 trong các cách (theo hạ tầng thực tế):

1. **Snapshot cấp thiết bị** (khuyến nghị): NAS Synology/QNAP bật Snapshot Replication cho thư mục mail, giữ 30 bản; nhanh, không ảnh hưởng tải.
2. **Đồng bộ sang NAS thứ 2** bằng `robocopy` (chỉ copy phần thay đổi) — mẫu:

```bat
robocopy "\\192.168.1.55\Cms_3T\MailBando" "\\<nas-backup>\MailBando" /MIR /R:2 /W:5 /XO /LOG+:D:\Backup\mail-rsync.log /TEE
```

3. **Cloud/offsite** (tuỳ chính sách): đẩy bản nén của `_files/` + `body.html` mỗi tuần.

Lưu ý: `_outbox/` chỉ là tệp đang soạn (có thể bỏ khỏi backup); `_files/` là kho dedup **dùng chung cho nhiều email** ⇒ không xoá thủ công.

## 4. Kiểm tra toàn vẹn (DB ↔ file) — bắt buộc

Sau restore (hoặc định kỳ hằng tuần), chạy đối soát:

- **Trong app**: trang quản trị Email → nút **“Đối soát ngay”** (command `emailReconcileNow`).
- **Ngoài app**: `node -e "require('./services/mail/mailReconcile').reconcile().then(console.log)"`

Job này sẽ:
1. `recountRefs()` — đếm lại `REF_COUNT` của file vật lý theo số attachment tham chiếu (nguồn chân lý).
2. `cleanupOrphans()` — xoá file vật lý `REF_COUNT <= 0` (email đã xoá / commit lỗi) khỏi NAS.
3. `verifyFiles()` — attachment `STATUS='READY'` mà **thiếu file** ⇒ đánh dấu `FAILED` để nhìn thấy ngay trong UI.

Kỳ vọng: `orphans = 0`, `failed = 0`. Nếu `failed > 0` ⇒ bản backup NAS thiếu file so với DB ⇒ phải restore lại NAS.

Dashboard dung lượng cũng hiển thị `physicalFiles/physicalBytes/orphanFiles/dedupSavedBytes` để so sánh nhanh.

## 5. Quy trình phục hồi (restore drill)

1. Restore DB (full + log gần nhất) vào môi trường kiểm tra.
2. Khôi phục/khôi phục-xong NAS đúng mount `MAIL_STORAGE_PATH`.
3. Chạy `scripts/migrate_mail_tables.js`.
4. Bật lại service (`npm run start`), mở ERP → kiểm tra: inbox có dữ liệu, mở 1 email có đính kèm (xem ảnh inline + tải file), badge chưa đọc hợp lý.
5. Chạy **Đối soát ngay** ⇒ `orphans/failed = 0`.
6. Thử gửi 1 email tới mailbox nội bộ ⇒ xác nhận SMTP hoạt động; chờ 1 chu kỳ worker ⇒ xác nhận POP3 vẫn tải mail mới.
7. Ghi lại thời gian phục hồi thực tế (RTO) và thời điểm dữ liệu cuối (RPO) vào biên bản.

## 6. Mục tiêu đề xuất

| Chỉ số | Mục tiêu |
|---|---|
| RPO (mất tối đa dữ liệu) | ≤ 30 phút (SQL log backup 15–30 phút); NAS snapshot ≤ 24 giờ |
| RTO (thời gian phục hồi) | ≤ 4 giờ |
| Kiểm tra integrity | `RESTORE VERIFYONLY` hằng ngày + đối soát DB↔file hằng tuần |
| Diễn tập phục hồi | 6 tháng/lần (restore vào môi trường kiểm tra) |

## 7. Việc KHÔNG được làm

- ❌ Không xoá file trong `_files/` bằng tay (nhiều email cùng trỏ tới 1 file).
- ❌ Không dùng lệnh xoá mail trên POP3 server từ ERP.
- ❌ Không backup chỉ NAS mà bỏ DB (hoặc ngược lại) — **hai phần phải đi cùng nhau** mới phục hồi được.
- ❌ Không ghi `MAIL_CRED_KEY` vào log/tài liệu chia sẻ.
