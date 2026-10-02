/**
 * Kiểm chứng đơn vị + DB cho tính năng "đồng bộ email trong khoảng thời gian".
 *
 *  - Logic lọc ngày (thuần): extractHeaderDate, vnDayNumber, boundaryDayNumber.
 *  - DB: lưu/đọc SYNC_FROM_DATE / SYNC_TO_DATE, bảng ZTB_MAIL_SYNC_SKIP (ghi nhớ + xoá).
 *
 * Dùng account giả (email ztest-range-*, EMPL_NO ZTEST-RANGE) và TỰ DỌN.
 * Chạy: node scratch/test_mail_sync_range.js
 */
const { openConnection, closePool } = require("../config/database");
const mailRepo = require("../services/mail/mailRepository");
const { extractHeaderDate, vnDayNumber, boundaryDayNumber, rangeDateParts } = require("../services/mail/mailIngest");

let passed = 0;
let failed = 0;
function check(label, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function dayOf(dateStr) {
  // Mốc "ngày cấu hình" như DB trả về: Date.UTC(y,m,d).
  const [y, m, d] = dateStr.split("-").map(Number);
  return boundaryDayNumber({ y, m: m - 1, d });
}

async function main() {
  /* ------------------------- 1. Trích Date header ------------------------- */
  console.log("1) Trích ngày gửi từ header");
  const raw1 = Buffer.from("From: a@b.com\r\nDate: Wed, 15 Jan 2026 10:30:00 +0700\r\nSubject: Hi\r\n\r\n");
  const d1 = extractHeaderDate(raw1);
  check("Đọc được Date header", d1 instanceof Date, d1 ? d1.toISOString() : "null");

  const raw2 = Buffer.from("Date: Wed, 15 Jan 2026\n 10:30:00 +0700\nSubject: Fold\r\n\r\n");
  check("Header bị fold vẫn đọc được", extractHeaderDate(raw2) instanceof Date);

  check("Không có Date ⇒ null", extractHeaderDate(Buffer.from("Subject: none\r\n\r\n")) === null);

  /* --------------------------- 2. So sánh ngày --------------------------- */
  console.log("2) So sánh ngày theo lịch giờ VN");
  const sent = new Date("2026-01-15T03:30:00.000Z"); // = 10:30 giờ VN ngày 15/01
  const dayFrom = dayOf("2026-01-15");
  const dayTo = dayOf("2026-01-15");
  const day = vnDayNumber(sent);
  check("Thư 15/01 nằm trong khoảng [15/01, 15/01]", day >= dayFrom && day <= dayTo, `day=${day}`);

  const sentLate = new Date("2026-01-14T20:00:00.000Z"); // = 03:00 giờ VN ngày 15/01
  check("Thư 03:00 giờ VN ngày 15/01 vẫn thuộc ngày 15", vnDayNumber(sentLate) === dayFrom);

  const sentOld = new Date("2026-01-10T02:00:00.000Z");
  check("Thư 10/01 bị loại khỏi khoảng từ 15/01", vnDayNumber(sentOld) < dayFrom);

  /* --------------------------- 3. DB (repo) ------------------------------ */
  console.log("3) Lưu/đọc khoảng + bảng bỏ qua (DB thật)");
  const pool = await openConnection();
  const ctrCd = "002";
  const email = `ztest-range-${Date.now()}@example.com`;
  const accountId = await mailRepo.insertAccount({
    ctrCd,
    emplNo: "ZTEST-RANGE",
    emailAddress: email,
    pop3Host: "localhost",
    pop3Port: 995,
    pop3Secure: true,
    pop3Username: email,
    isActive: false,
    syncFromDate: new Date(Date.UTC(2026, 0, 1)),
    syncToDate: new Date(Date.UTC(2026, 0, 31)),
  });
  check("Tạo account test có ID", Number.isInteger(accountId) && accountId > 0, String(accountId));

  const acc = await mailRepo.getAccountById(accountId);
  const fromParts = rangeDateParts(acc.SYNC_FROM_DATE);
  const toParts = rangeDateParts(acc.SYNC_TO_DATE);
  check("SYNC_FROM_DATE đọc lại = 2026-01-01",
    fromParts && fromParts.y === 2026 && fromParts.m === 0 && fromParts.d === 1,
    JSON.stringify(fromParts));
  check("SYNC_TO_DATE đọc lại = 2026-01-31",
    toParts && toParts.y === 2026 && toParts.m === 0 && toParts.d === 31,
    JSON.stringify(toParts));

  await mailRepo.markUidlsSkipped(accountId, [
    { uidl: "UIDL-A", reason: "BEFORE_RANGE" },
    { uidl: "UIDL-B", reason: "AFTER_RANGE" },
    { uidl: "UIDL-A", reason: "BEFORE_RANGE" }, // trùng ⇒ idempotent
  ]);
  const skipped = await mailRepo.listSkippedUidls(accountId);
  check("Bỏ qua 2 UIDL (khử trùng)", skipped.size === 2, [...skipped].join(","));
  check("countSkippedUidls = 2", (await mailRepo.countSkippedUidls(accountId)) === 2);

  // Đổi khoảng ⇒ xoá danh sách bỏ qua.
  await mailRepo.updateAccount(accountId, { syncFromDate: null, syncToDate: null });
  await mailRepo.clearSkippedUidls(accountId);
  const acc2 = await mailRepo.getAccountById(accountId);
  check("Xoá được giới hạn (NULL)", !acc2.SYNC_FROM_DATE && !acc2.SYNC_TO_DATE);
  check("Danh sách bỏ qua đã xoá", (await mailRepo.countSkippedUidls(accountId)) === 0);

  /* ------------------------------ Cleanup -------------------------------- */
  await pool.query(`DELETE FROM ZTB_MAIL_SYNC_SKIP WHERE MAIL_ACCOUNT_ID = @ID`, { ID: accountId });
  await pool.query(`DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @ID`, { ID: accountId });
  await pool.query(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: accountId });
  console.log("\n[dọn dẹp] đã xoá account test");

  console.log(`\n=== ${passed} PASS, ${failed} FAIL ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => undefined);
  });
