/**
 * SỬA DỮ LIỆU: hạ cờ `IS_INLINE` cho các đính kèm bị phân loại SAI (bug "Content-ID = inline").
 *
 * BỐI CẢNH
 * --------
 * Bản cũ của `mailParserService` suy ra `isInline = !!Content-ID`. Gmail gắn Content-ID cho
 * **cả tệp đính kèm thật** (vd `<f_muqgaxoz1>` cho `companylogo.png`, `f_…` cho PDF/RAR)
 * ⇒ file bị coi là ảnh trong nội dung ⇒ FE ẩn khỏi danh sách đính kèm ⇒ người dùng tưởng
 * email mất đính kèm (Outlook vẫn thấy vì Outlook đọc `Content-Disposition`).
 *
 * CÁCH SỬA (2 bước, an toàn)
 * -------------------------
 *  BƯỚC 1 (không cần tải lại mail): đính kèm đang inline mà `CONTENT_TYPE` KHÔNG phải `image/*`
 *          ⇒ chắc chắn là tệp đính kèm (PDF/RAR/DOCX…) ⇒ hạ cờ.
 *  BƯỚC 2 (tải lại raw từ POP3): với email có ẢNH đang inline mang TÊN KHÁC kiểu `imageNNN.*`
 *          (vd `companylogo.png`, `logoImage`, `Catch.jpg`) ⇒ tải lại raw, parse lại bằng logic
 *          mới (chỉ dựa vào `Content-Disposition`) rồi cập nhật cờ theo kết quả, ghép theo
 *          `CONTENT_ID` (tên file/logo inline thật như `logoImage` sẽ được giữ nguyên inline).
 *  BƯỚC 3: tính lại `HAS_ATTACHMENT` / `ATTACHMENT_COUNT` (chỉ đếm tệp đính kèm THẬT).
 *
 * Chạy:
 *   node scripts/repair_mail_inline_flags.js --dry-run              (chỉ báo cáo, KHÔNG ghi gì)
 *   node scripts/repair_mail_inline_flags.js                        (áp dụng đầy đủ)
 *   node scripts/repair_mail_inline_flags.js --skip-reparse         (chỉ bước 1 + 3, không tải lại mail)
 */
const mailRepo = require("../services/mail/mailRepository");
const msgRepo = require("../services/mail/mailMessageRepository");
const { Pop3Client } = require("../services/mail/mailPop3Client");
const { resolvePop3Credential } = require("../services/mail/mailIngest");
const { parseEmail } = require("../services/mail/mailParserService");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_REPARSE = args.includes("--skip-reparse");

/** Tên ảnh inline "kinh điển" do Outlook/Word sinh ra — không cần tải lại để kiểm tra. */
const CLASSIC_INLINE_NAME = /^image[0-9]{1,3}\.(png|jpe?g|gif|bmp|webp|tiff?)$/i;

function normCid(value) {
  return value ? String(value).replace(/^<|>$/g, "").trim().toLowerCase() : "";
}

/* ------------------------------------------------------------------ */
/* BƯỚC 1 — inline nhưng không phải ảnh ⇒ chắc chắn là tệp đính kèm      */
/* ------------------------------------------------------------------ */

async function step1NonImage() {
  const rows = await mailRepo.queryRows(
    `SELECT a.ID, a.MESSAGE_ID, a.FILE_NAME, a.CONTENT_TYPE, m.SUBJECT
     FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID
     WHERE a.IS_INLINE = 1 AND a.CONTENT_TYPE NOT LIKE 'image/%'
     ORDER BY a.ID`
  );
  console.log(`\n[BƯỚC 1] Inline nhưng KHÔNG phải ảnh ⇒ chắc chắn là tệp đính kèm: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `   #${row.ID} msg#${row.MESSAGE_ID} “${String(row.SUBJECT || "").slice(0, 40)}” → ${row.FILE_NAME} (${row.CONTENT_TYPE})`
    );
    if (!DRY_RUN) await msgRepo.setAttachmentInline(row.ID, false);
  }
  return rows.length;
}

/* ------------------------------------------------------------------ */
/* BƯỚC 2 — tải lại raw cho email có ẢNH inline mang tên "lạ"            */
/* ------------------------------------------------------------------ */

async function collectReparseTargets() {
  const messages = await mailRepo.queryRows(
    `SELECT DISTINCT m.ID, m.MAIL_ACCOUNT_ID, m.UIDL, m.SUBJECT
     FROM ZTB_MAIL_MESSAGE m
     JOIN ZTB_MAIL_ATTACHMENT a ON a.MESSAGE_ID = m.ID
     WHERE a.IS_INLINE = 1 AND a.CONTENT_TYPE LIKE 'image/%'
     ORDER BY m.ID`
  );
  const targets = [];
  for (const message of messages) {
    const atts = await mailRepo.queryRows(
      `SELECT ID, FILE_NAME FROM ZTB_MAIL_ATTACHMENT WHERE MESSAGE_ID = @ID AND IS_INLINE = 1`,
      { ID: message.ID }
    );
    const suspicious = atts.filter((a) => a.FILE_NAME && !CLASSIC_INLINE_NAME.test(String(a.FILE_NAME).trim()));
    if (suspicious.length > 0) targets.push({ ...message, suspiciousCount: suspicious.length });
  }
  return targets;
}

/** Kết nối POP3 dùng lại cho từng mailbox (tải nhiều email trong 1 phiên). */
async function getClient(cache, accountId) {
  const key = String(accountId);
  if (cache.has(key)) return cache.get(key);
  const account = await mailRepo.getAccountWithCredentials(accountId);
  const cred = resolvePop3Credential(account);
  const client = new Pop3Client({ ...cred, timeoutMs: 60000, rejectUnauthorized: false, log: () => undefined });
  await client.connect();
  await client.auth();
  cache.set(key, client);
  return client;
}

/** Đóng và quên client của 1 mailbox (sau khi kết nối bị ngắt/treo). */
async function dropClient(cache, accountId) {
  const key = String(accountId);
  const client = cache.get(key);
  cache.delete(key);
  if (client) await client.quit().catch(() => undefined);
}

/**
 * Bọc `reparseAndFix` với KHẢ NĂNG KẾT NỐI LẠI: máy chủ POP3 sẽ đóng phiên khi để lâu
 * giữa 2 lần RETR ⇒ gặp lỗi thì tạo kết nối mới và thử lại (tối đa 3 lần).
 */
async function reparseWithRetry(cache, message) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await reparseAndFix(cache, message);
    } catch (error) {
      lastError = error;
      console.log(`   ↻ msg#${message.ID} lỗi “${error?.message || error}” — kết nối lại (lần ${attempt})`);
      await dropClient(cache, message.MAIL_ACCOUNT_ID);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  return { ok: false, reason: lastError?.message || String(lastError) };
}

async function reparseAndFix(cache, message) {
  const client = await getClient(cache, message.MAIL_ACCOUNT_ID);
  const uidlMap = await client.uidl();
  let targetNo = null;
  for (const [no, uidl] of uidlMap.entries()) {
    if (uidl === message.UIDL) { targetNo = no; break; }
  }
  if (!targetNo) return { ok: false, reason: "UIDL không còn trên server" };

  const raw = await client.retr(targetNo, { maxBytes: 100 * 1024 * 1024 });
  const parsed = await parseEmail(raw);
  const inlineCids = new Set(
    parsed.attachments.filter((a) => a.isInline).map((a) => normCid(a.contentId)).filter(Boolean)
  );
  const allCids = new Set(parsed.attachments.map((a) => normCid(a.contentId)).filter(Boolean));

  const atts = await mailRepo.queryRows(
    `SELECT ID, FILE_NAME, CONTENT_ID, IS_INLINE FROM ZTB_MAIL_ATTACHMENT WHERE MESSAGE_ID = @ID`,
    { ID: message.ID }
  );
  let flips = 0;
  let unknown = 0;
  for (const att of atts) {
    const cid = normCid(att.CONTENT_ID);
    if (!cid) continue;
    if (!allCids.has(cid)) { unknown += 1; continue; }
    const isInlineNow = att.IS_INLINE === true || att.IS_INLINE === 1;
    const shouldBeInline = inlineCids.has(cid);
    if (isInlineNow && !shouldBeInline) {
      flips += 1;
      console.log(`   msg#${message.ID} “${String(message.SUBJECT || "").slice(0, 38)}” → #${att.ID} ${att.FILE_NAME}: Content-Disposition=attachment ⇒ hạ cờ inline`);
      if (!DRY_RUN) await msgRepo.setAttachmentInline(att.ID, false);
    }
  }
  return { ok: true, flips, unknown };
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n=== SỬA CỜ IS_INLINE ${DRY_RUN ? "(DRY-RUN — không ghi)" : "(ÁP DỤNG)"} ===`);

  const step1 = await step1NonImage();

  let targets = [];
  let step2Flips = 0;
  let step2Failed = 0;
  if (!SKIP_REPARSE) {
    targets = await collectReparseTargets();
    console.log(`\n[BƯỚC 2] Email có ẢNH inline tên KHÁC kiểu imageNNN.* (cần tải lại raw): ${targets.length}`);
    const cache = new Map();
    try {
      for (const target of targets) {
        try {
          const result = await reparseWithRetry(cache, target);
          if (!result.ok) {
            step2Failed += 1;
            console.log(`   ⚠️ msg#${target.ID}: ${result.reason}`);
          } else {
            step2Flips += result.flips;
          }
        } catch (error) {
          step2Failed += 1;
          console.log(`   ⚠️ msg#${target.ID} lỗi: ${error?.message || error}`);
        }
      }
    } finally {
      for (const client of cache.values()) await client.quit().catch(() => undefined);
    }
  } else {
    console.log("\n[BƯỚC 2] BỎ QUA (--skip-reparse)");
  }

  console.log("\n[BƯỚC 3] Tính lại HAS_ATTACHMENT / ATTACHMENT_COUNT (chỉ đếm tệp đính kèm THẬT)…");
  if (!DRY_RUN) {
    const updated = await msgRepo.recalcAllAttachmentMeta();
    console.log(`   Đã tính lại cho ${updated} email có đính kèm.`);
  } else {
    console.log("   (dry-run: bỏ qua)");
  }

  console.log("\n--- KẾT QUẢ ---");
  console.log(`  Bước 1 (không phải ảnh)           : ${step1} đính kèm ${DRY_RUN ? "sẽ" : "đã"} hạ cờ`);
  console.log(`  Bước 2 (ảnh tên lạ, tải lại raw)  : ${targets.length} email, ${step2Flips} đính kèm ${DRY_RUN ? "sẽ" : "đã"} hạ cờ`);
  console.log(`  Email không xử lý được             : ${step2Failed}`);
  console.log(DRY_RUN ? "\n(Chạy lại KHÔNG có --dry-run để áp dụng.)\n" : "\nHoàn tất.\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("Lỗi:", error);
  process.exit(1);
});
