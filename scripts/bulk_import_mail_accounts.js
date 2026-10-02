/**
 * IMPORT HÀNG LOẠT mailbox nhân viên từ file CSV.
 *
 * Mục đích: bạn có sẵn danh sách tài khoản mail của nhân viên ⇒ nạp 1 lần vào DB,
 * sau đó Mail Worker tự tải mail của TẤT CẢ nhân viên về NAS theo lịch.
 *
 * Chạy:
 *   node scripts/bulk_import_mail_accounts.js --file=mail_accounts.csv
 *   node scripts/bulk_import_mail_accounts.js --file=mail_accounts.csv --dry-run
 *
 * Cột CSV (dòng đầu là tiêu đề, KHÔNG phân biệt hoa/thường):
 *   EMPL_NO, EMAIL_ADDRESS, POP3_HOST, POP3_USERNAME, POP3_PASSWORD,
 *   POP3_PORT, POP3_SECURE, DISPLAY_NAME, SMTP_HOST, SMTP_PORT, SMTP_SECURE, IS_ACTIVE, CTR_CD
 *
 * - CTR_CD để trống ⇒ tự suy từ EMPL_NO (bảng ZTBEMPLINFO).
 * - POP3_HOST/PORT/SECURE để trống ⇒ lấy mặc định từ env:
 *     MAIL_DEFAULT_POP3_HOST, MAIL_DEFAULT_POP3_PORT, MAIL_DEFAULT_POP3_SECURE
 * - POP3_USERNAME để trống ⇒ dùng EMAIL_ADDRESS. POP3_PASSWORD sẽ được mã hoá AES-256-GCM.
 * - Nếu email đã tồn tại (theo CTR_CD + EMAIL_ADDRESS) ⇒ CẬP NHẬT (không tạo trùng).
 *
 * ⚠️ Cần MAIL_CRED_KEY trong outbinary/.ENV trước khi chạy.
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();

const mailRepo = require("../services/mail/mailRepository");
const mailCrypto = require("../services/mail/mailCrypto");
const { openConnection } = require("../config/database");

/** Parser CSV tối giản (hỗ trợ dấu ngoặc kép + escape "" ). */
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* bỏ qua */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

const arg = (name, fallback = undefined) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);
const bool = (v, dflt) => {
  if (v === undefined || v === null || String(v).trim() === "") return dflt;
  return !/^(0|false|no|n|off)$/i.test(String(v).trim());
};

async function resolveCtr(emplNo) {
  if (!emplNo) return "";
  const rows = await mailRepo.queryRows(
    `SELECT TOP 1 LTRIM(RTRIM(CTR_CD)) AS CTR FROM ZTBEMPLINFO WHERE LTRIM(RTRIM(EMPL_NO)) = @E`,
    { E: emplNo }
  );
  return rows[0]?.CTR || "";
}

async function main() {
  const file = arg("file");
  if (!file) {
    console.error("✘ Thiếu --file=<đường dẫn CSV>. Xem hướng dẫn ở đầu file.");
    process.exit(1);
  }
  if (!mailCrypto.isConfigured()) {
    console.error("✘ Thiếu MAIL_CRED_KEY trong outbinary/.ENV — không thể mã hoá mật khẩu.");
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error(`✘ Không thấy file: ${abs}`);
    process.exit(1);
  }

  const table = parseCsv(fs.readFileSync(abs, "utf8"));
  if (table.length < 2) {
    console.error("✘ File CSV không có dữ liệu (cần dòng tiêu đề + ít nhất 1 dòng).");
    process.exit(1);
  }

  const header = table[0].map((h) => String(h).trim().toUpperCase());
  const idx = (name) => header.indexOf(name);
  const get = (row, name) => {
    const i = idx(name);
    return i >= 0 ? String(row[i] ?? "").trim() : "";
  };

  const defaultHost = String(process.env.MAIL_DEFAULT_POP3_HOST || "").trim();
  const defaultPort = Number(process.env.MAIL_DEFAULT_POP3_PORT || 0) || 0;
  const defaultSecure = bool(process.env.MAIL_DEFAULT_POP3_SECURE, true);
  const dryRun = hasFlag("dry-run");

  let inserted = 0, updated = 0, skipped = 0;
  const errors = [];

  for (let r = 1; r < table.length; r += 1) {
    const row = table[r];
    const emplNo = get(row, "EMPL_NO").toUpperCase();
    const email = get(row, "EMAIL_ADDRESS");
    if (!email) { skipped += 1; errors.push(`Dòng ${r + 1}: thiếu EMAIL_ADDRESS`); continue; }

    let ctrCd = get(row, "CTR_CD");
    if (!ctrCd) ctrCd = await resolveCtr(emplNo);
    if (!ctrCd) { skipped += 1; errors.push(`Dòng ${r + 1}: không suy được CTR_CD (EMPL_NO="${emplNo}")`); continue; }

    const host = get(row, "POP3_HOST") || defaultHost;
    if (!host) { skipped += 1; errors.push(`Dòng ${r + 1}: thiếu POP3_HOST (và không có MAIL_DEFAULT_POP3_HOST)`); continue; }

    const secure = bool(get(row, "POP3_SECURE"), defaultSecure);
    const port = Number(get(row, "POP3_PORT")) || defaultPort || (secure ? 995 : 110);
    const username = get(row, "POP3_USERNAME") || email;
    const password = get(row, "POP3_PASSWORD");

    if (dryRun) { inserted += 1; continue; }

    try {
      const existing = await mailRepo.findAccountByEmail({ ctrCd, emailAddress: email });
      const fields = {
        emplNo: emplNo || null,
        displayName: get(row, "DISPLAY_NAME") || email,
        pop3Host: host,
        pop3Port: port,
        pop3Secure: secure,
        pop3Username: username,
        smtpHost: get(row, "SMTP_HOST") || host,
        smtpPort: Number(get(row, "SMTP_PORT")) || (secure ? 465 : 25),
        smtpSecure: bool(get(row, "SMTP_SECURE"), true),
        smtpUsername: get(row, "SMTP_USERNAME") || username,
        isActive: bool(get(row, "IS_ACTIVE"), true),
      };
      if (password) fields.pop3CredEnc = mailCrypto.encryptSecret(password);

      if (existing) {
        await mailRepo.updateAccount(existing.ID, fields);
        updated += 1;
      } else {
        const id = await mailRepo.insertAccount({ ctrCd, emailAddress: email, ...fields });
        await mailRepo.ensureCheckpoint(id);
        inserted += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push(`Dòng ${r + 1} (${email}): ${error?.message || error}`);
    }
  }

  console.log(`\n[dry-run? ${dryRun}] ${dryRun ? "SẼ tạo" : "Đã tạo"} ${inserted} · cập nhật ${updated} · bỏ qua ${skipped}`);
  if (errors.length > 0) {
    console.log("Lỗi:");
    errors.slice(0, 30).forEach((e) => console.log("  - " + e));
    if (errors.length > 30) console.log(`  ... và ${errors.length - 30} dòng khác`);
  }
}

main()
  .catch((e) => { console.error("[import] lỗi:", e); process.exitCode = 1; })
  .finally(async () => { try { (await openConnection()).close(); } catch { /* bỏ qua */ } });
