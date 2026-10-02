/**
 * Thêm mailbox THẬT + (tuỳ chọn) test kết nối và đồng bộ POP3 ngay.
 *
 * Dùng khi chưa có màn Admin (Phase 8). Credential được mã hoá AES-256-GCM
 * bằng MAIL_CRED_KEY (đọc từ outbinary/.ENV).
 *
 * Ví dụ:
 *   node scratch/add_mailbox.js --empl=NHU1903 --email=ketoan@cmsvina.com \
 *     --host=mail.cmsvina.com --port=995 --secure=true --user=ketoan@cmsvina.com --pass=matkhau \
 *     --smtp-host=mail.cmsvina.com --smtp-port=465 [--sync]
 *
 *   node scratch/add_mailbox.js --list          # liệt kê mailbox hiện có
 *   node scratch/add_mailbox.js --sync-id=5     # đồng bộ ngay mailbox #5
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();

const mailRepo = require("../services/mail/mailRepository");
const mailCrypto = require("../services/mail/mailCrypto");
const { syncMailbox, testConnection } = require("../services/mail/mailIngest");
const { openConnection } = require("../config/database");

function arg(name, fallback = undefined) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

async function main() {
  if (!mailCrypto.isConfigured()) {
    console.error("✘ Thiếu MAIL_CRED_KEY trong outbinary/.ENV — không thể mã hoá credential.");
    process.exit(1);
  }

  if (hasFlag("list")) {
    const rows = await mailRepo.queryRows(
      `SELECT ID, CTR_CD, EMPL_NO, EMAIL_ADDRESS, POP3_HOST, POP3_PORT, POP3_SECURE, IS_ACTIVE, IS_SHARED, LAST_SYNC_STATUS
       FROM ZTB_MAIL_ACCOUNT ORDER BY ID`
    );
    console.table(rows);
    return;
  }

  if (arg("sync-id")) {
    const id = Number(arg("sync-id"));
    console.log(`→ Đồng bộ mailbox #${id} ...`);
    const result = await syncMailbox(id, { manual: true });
    console.log("Kết quả:", result);
    return;
  }

  // Tạo mailbox mới
  const emplNo = String(arg("empl", "")).trim().toUpperCase();
  const email = String(arg("email", "")).trim();
  const host = arg("host");
  const password = arg("pass");
  if (!email || !host) {
    console.error("✘ Thiếu --email hoặc --host. Xem hướng dẫn ở đầu file.");
    process.exit(1);
  }

  let ctrCd = String(arg("ctr", "")).trim();
  if (!ctrCd && emplNo) {
    const rows = await mailRepo.queryRows(
      `SELECT TOP 1 LTRIM(RTRIM(CTR_CD)) AS CTR FROM ZTBEMPLINFO WHERE LTRIM(RTRIM(EMPL_NO)) = @E`,
      { E: emplNo }
    );
    ctrCd = rows[0]?.CTR || "";
  }
  if (!ctrCd) {
    console.error("✘ Không xác định được CTR_CD. Truyền --ctr=<mã công ty>.");
    process.exit(1);
  }

  const existing = await mailRepo.findAccountByEmail({ ctrCd, emailAddress: email });
  if (existing) {
    console.error(`✘ Mailbox ${email} đã tồn tại (ID=${existing.ID}) trong công ty ${ctrCd}.`);
    process.exit(1);
  }

  const secure = String(arg("secure", "true")) !== "false";
  const smtpPort = Number(arg("smtp-port", secure ? 465 : 25));

  const id = await mailRepo.insertAccount({
    ctrCd,
    emplNo: emplNo || null,
    emailAddress: email,
    displayName: arg("name", email),
    pop3Host: host,
    pop3Port: Number(arg("port", secure ? 995 : 110)),
    pop3Secure: secure,
    pop3Username: arg("user", email),
    pop3CredEnc: password ? mailCrypto.encryptSecret(password) : null,
    smtpHost: arg("smtp-host", host),
    smtpPort,
    smtpSecure: String(arg("smtp-secure", "true")) !== "false",
    smtpUsername: arg("smtp-user", arg("user", email)),
    isActive: true,
    isShared: hasFlag("shared"),
  });
  await mailRepo.ensureCheckpoint(id);
  console.log(`✔ Đã tạo mailbox #${id} (${email}) cho ${emplNo || "(dùng chung)"} — CTR=${ctrCd}`);

  console.log("→ Test kết nối POP3 ...");
  const account = await mailRepo.getAccountWithCredentials(id);
  const test = await testConnection(account);
  console.log(test.ok ? `  ✔ ${test.message}` : `  ✘ ${test.message}`);
  if (!test.ok) {
    console.log("  (Mailbox vẫn được lưu. Sửa cấu hình rồi chạy lại: node scratch/add_mailbox.js --sync-id=" + id + ")");
    return;
  }

  if (hasFlag("sync")) {
    console.log("→ Đồng bộ ngay ...");
    const result = await syncMailbox(id, { manual: true });
    console.log("Kết quả:", result);
  } else {
    console.log(`ℹ️ Worker sẽ tự đồng bộ trong ~${process.env.MAIL_SYNC_INTERVAL_SECONDS || 45}s. Hoặc chạy: node scratch/add_mailbox.js --sync-id=${id}`);
  }
}

main()
  .catch((e) => { console.error("[add_mailbox] lỗi:", e); process.exitCode = 1; })
  .finally(async () => { try { (await openConnection()).close(); } catch { /* bỏ qua */ } });
