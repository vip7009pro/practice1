/**
 * Pipeline đồng bộ 1 mailbox: POP3 → parse → dedup → lưu metadata (SQL) + body/đính kèm (NAS).
 *
 * Nguyên tắc:
 *  - KHÔNG xoá email trên server (copy-only).
 *  - Dedup theo UIDL → Message-ID → SHA-256 (theo thứ tự ưu tiên).
 *  - Ghi file NAS TRƯỚC, commit DB SAU (file mồ côi được dọn bởi mailReconcile).
 *  - Bounded: giới hạn số email mỗi lượt + kích thước email/đính kèm.
 */
const mailRepo = require("./mailRepository");
const msgRepo = require("./mailMessageRepository");
const mailCrypto = require("./mailCrypto");
const mailStorage = require("./mailStorage");
const { Pop3Client } = require("./mailPop3Client");
const { parseEmail, flattenRecipients } = require("./mailParserService");

// Trần số email xử lý mỗi lượt (an toàn); ngân sách thời gian bên dưới cũng giới hạn.
// Lần import đầu mailbox lớn sẽ chạy nhiều lượt liên tiếp (checkpoint + resume).
const MAX_BATCH_PER_RUN = Number(process.env.MAIL_MAX_BATCH_PER_RUN || 500) || 500;
const SYNC_INTERVAL_SECONDS = Number(process.env.MAIL_SYNC_INTERVAL_SECONDS || 45) || 45;
const POP3_TIMEOUT_MS = Number(process.env.MAIL_POP3_TIMEOUT_MS || 30000) || 30000;
const MAX_EMAIL_BYTES = Number(process.env.MAIL_MAX_EMAIL_BYTES || 50 * 1024 * 1024);
const MAX_ATTACHMENT_BYTES = Number(process.env.MAIL_ATTACHMENT_MAX_BYTES || 100 * 1024 * 1024);
const BODY_INLINE_MAX_BYTES = Number(process.env.MAIL_BODY_INLINE_MAX_BYTES || 262144);
const TLS_REJECT_UNAUTHORIZED = String(process.env.MAIL_TLS_REJECT_UNAUTHORIZED || "true") !== "false";
// Ngân sách thời gian cho 1 lượt đồng bộ. Hết ngân sách ⇒ nhả khoá, lượt sau tiếp tục
// (tránh 1 mailbox lớn giữ khoá quá lâu khiến UI hiển thị "Đang đồng bộ" vô tận).
const MAX_RUN_MS = Number(process.env.MAIL_SYNC_MAX_MS || 180000) || 180000;

const defLog = (msg) => console.log(msg);

/** Lấy + giải mã credential POP3 của account. */
function resolvePop3Credential(account) {
  const password = mailCrypto.decryptSecret(account.POP3_CRED_ENC);
  // ⚠️ mssql trả BIT về boolean ⇒ không so sánh `=== 0` (false !== 0 là true).
  const secure = account.POP3_SECURE === true || account.POP3_SECURE === 1;
  return {
    host: account.POP3_HOST,
    port: account.POP3_PORT,
    secure,
    username: account.POP3_USERNAME || account.EMAIL_ADDRESS,
    password,
  };
}

/** Chọn lưu body inline (DB) hay ra file (NAS) theo kích thước. */
function storeBody(account, parsed, messageRef) {
  const html = parsed.html || (parsed.text ? `<pre>${escapeHtml(parsed.text)}</pre>` : "");
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > BODY_INLINE_MAX_BYTES) {
    const dir = mailStorage.buildMessageDir({
      ctrCd: account.CTR_CD,
      sentAt: parsed.date || new Date(),
      mailboxKey: account.EMAIL_ADDRESS,
      messageRef,
    });
    const path = mailStorage.writeBody(html, dir);
    return { bodyStoragePath: path, bodyInline: null };
  }
  return { bodyStoragePath: null, bodyInline: html || null };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Xác định thread cho email.
 * Ưu tiên In-Reply-To / References; nếu không tìm thấy thì tạo thread mới.
 */
async function resolveThread(account, parsed) {
  const candidates = [parsed.inReplyTo, ...(parsed.references || []).slice().reverse()].filter(Boolean);
  for (const ref of candidates) {
    const found = await msgRepo.findThreadByHeaderRef({ ctrCd: account.CTR_CD, headerRef: ref });
    if (found) return found.ID;
  }
  const participantKey = [parsed.from?.address, ...(parsed.to || []).map((t) => t.address)]
    .filter(Boolean)
    .sort()
    .join("|")
    .slice(0, 400);
  return msgRepo.createThread({
    ctrCd: account.CTR_CD,
    subjectNorm: parsed.subjectNorm,
    participantKey,
  });
}

/**
 * Lưu 1 email đã parse. Trả true nếu import mới, false nếu trùng.
 * @param {object} account row (kèm CTR_CD)
 * @param {object} parsed kết quả parseEmail
 * @param {string} uidl
 */
async function persistParsedEmail(account, parsed, uidl, rawHash) {
  // Chỉ dùng hash khi email KHÔNG có Message-ID (Message-ID là khoá đáng tin nhất).
  const contentHash = parsed.messageId
    ? null
    : (rawHash || mailStorage.sha256(Buffer.from(JSON.stringify({
        s: parsed.subject, f: parsed.from?.address, d: parsed.date, t: parsed.text?.slice(0, 500),
      }))));

  const dup = await msgRepo.findMessageByDedup({
    accountId: account.ID,
    messageId: parsed.messageId,
    uidl,
    contentHash,
  });
  if (dup) return false;

  const threadId = await resolveThread(account, parsed);
  const receivedAt = parsed.date || new Date();
  const messageRef = `${Date.now()}-${(uidl || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 20) || "0"}`;
  const body = storeBody(account, parsed, messageRef);

  // Ghi TRƯỚC ra NAS để transaction DB ngắn.
  const preparedAttachments = [];
  for (const att of parsed.attachments) {
    if (!att.content || att.content.length === 0) continue;
    if (att.content.length > MAX_ATTACHMENT_BYTES) continue; // bỏ qua đính kèm quá lớn
    const ext = att.fileName ? require("path").extname(att.fileName) : "";
    const phys = mailStorage.writePhysicalFile(att.content, ext);
    preparedAttachments.push({ att, phys });
  }

  const recipients = flattenRecipients(parsed);

  let insertedId = null;
  await mailRepo.withTransaction(async (tx) => {
    const messageId = await msgRepo.insertMessage(tx, {
      mailAccountId: account.ID,
      messageId: parsed.messageId,
      uidl,
      threadId,
      inReplyTo: parsed.inReplyTo,
      referencesHeader: (parsed.references || []).join(" ").slice(0, 4000) || null,
      fromAddress: parsed.from?.address || null,
      fromName: parsed.from?.name || null,
      toJson: JSON.stringify(parsed.to || []),
      ccJson: JSON.stringify(parsed.cc || []),
      bccJson: JSON.stringify(parsed.bcc || []),
      subject: parsed.subject,
      sentAt: parsed.date || null,
      receivedAt,
      folder: "INBOX",
      hasAttachment: preparedAttachments.length > 0,
      attachmentCount: preparedAttachments.length,
      bodyStoragePath: body.bodyStoragePath,
      bodyInline: body.bodyInline,
      previewText: parsed.previewText,
      sizeBytes: parsed.rawSize,
      contentHash,
    });

    await msgRepo.insertRecipients(tx, messageId, recipients);

    for (const { att, phys } of preparedAttachments) {
      const physicalId = await msgRepo.ensurePhysicalFileTx(tx, {
        hash: phys.hash,
        storagePath: phys.storagePath,
        size: phys.size,
      });
      await msgRepo.insertAttachment(tx, {
        messageId,
        fileName: att.fileName,
        contentType: att.contentType,
        fileSize: phys.size,
        contentId: att.contentId,
        isInline: att.isInline,
        fileHash: phys.hash,
        physicalFileId: physicalId,
        status: "READY",
      });
    }

    await msgRepo.touchThread(threadId, receivedAt);
    insertedId = messageId;
  });

  return insertedId;
}

/** Bắn thông báo realtime (không chặn luồng sync nếu socket chưa sẵn sàng). */
function emitNewEmail(account, summary) {
  try {
    const { emitToUsers } = require("../../socket/socketHandler");
    if (typeof emitToUsers !== "function" || !account.EMPL_NO) return;
    emitToUsers([account.EMPL_NO], "email:new", {
      accountId: account.ID,
      emailAddress: account.EMAIL_ADDRESS,
      imported: summary.imported,
    });
  } catch (error) {
    console.warn(`[mail] emit email:new bỏ qua: ${error?.message || error}`);
  }
}

/**
 * Đồng bộ 1 mailbox (có khoá chống chạy chồng).
 * @param {number} accountId
 * @returns {Promise<object>} summary
 */
async function syncMailbox(accountId, { log = defLog, manual = false } = {}) {
  const account = await mailRepo.getAccountWithCredentials(accountId);
  if (!account) return { ok: false, errorCode: "NOT_FOUND", message: "Không tìm thấy mailbox" };
  if (account.IS_ACTIVE === 0 || account.IS_ACTIVE === false) {
    return { ok: false, errorCode: "INACTIVE", message: "Mailbox đang tắt" };
  }

  const gotLock = await mailRepo.tryAcquireLock(accountId, `worker:${process.pid}`);
  if (!gotLock) {
    return { ok: false, errorCode: "LOCKED", message: "Mailbox đang được đồng bộ" };
  }

  const logId = await mailRepo.startSyncLog(accountId);
  const summary = { ok: true, connected: false, newCount: 0, imported: 0, attachCount: 0, serverTotal: 0, budgetExhausted: false, errorCode: null, message: null };
  let client = null;

  try {
    const cred = resolvePop3Credential(account);
    if (!cred.host || !cred.password) {
      throw Object.assign(new Error("Thiếu cấu hình POP3 host/credential"), { code: "CONFIG" });
    }

    client = new Pop3Client({ ...cred, timeoutMs: POP3_TIMEOUT_MS, rejectUnauthorized: TLS_REJECT_UNAUTHORIZED, log });
    await client.connect();
    await client.auth();
    summary.connected = true;
    log(`[mail] acc=${account.ID} đăng nhập OK ${account.EMAIL_ADDRESS} (${cred.host}:${cred.port} secure=${cred.secure})`);

    const uidlMap = await client.uidl();
    log(`[mail] acc=${account.ID} UIDL xong: ${uidlMap.size} mục`);
    const existing = await msgRepo.listExistingUidls(accountId);
    const sizeMap = await client.list().catch(() => new Map());
    // Tổng email phía server (để FE hiển thị tiến độ đã tải / còn lại).
    const serverTotal = await client.stat().then((s) => s.count).catch(() => 0);
    summary.serverTotal = serverTotal;
    // Lưu NGAY để UI hiển thị "Tổng thư / Còn lại" trong lúc sync (không đợi hết lượt).
    await mailRepo.setServerTotal(accountId, serverTotal).catch(() => undefined);

    // Email mới = UIDL chưa có trong DB. Xử lý theo thứ tự tăng dần (cũ → mới).
    const numbers = [...uidlMap.keys()].sort((a, b) => a - b);
    const pending = numbers.filter((no) => !existing.has(uidlMap.get(no)));
    summary.newCount = pending.length;
    log(`[mail] acc=${account.ID} total=${serverTotal}, đã có=${existing.size}, cần tải=${pending.length}`);

    let processed = 0;
    let lastUidl = null;
    const runStarted = Date.now();
    // Vài email mới nhất của lượt này (dùng cho thông báo đẩy + deep-link).
    const recent = [];
    for (const no of pending) {
      if (processed >= MAX_BATCH_PER_RUN) {
        summary.budgetExhausted = true;
        break;
      }
      if (Date.now() - runStarted > MAX_RUN_MS) {
        summary.budgetExhausted = true;
        log(`[mail] acc=${account.ID} hết ngân sách ${MAX_RUN_MS}ms sau ${summary.imported} email — tiếp tục ở lượt sau`);
        break;
      }
      const uidl = uidlMap.get(no);
      const size = sizeMap.get(no) || 0;
      processed += 1;
      lastUidl = uidl;

      if (size > MAX_EMAIL_BYTES) {
        log(`[mail] bỏ qua msg ${no} (${size} byte > giới hạn)`);
        continue;
      }
      try {
        const retrStart = Date.now();
        const raw = await client.retr(no, { maxBytes: MAX_EMAIL_BYTES });
        const retrMs = Date.now() - retrStart;
        const parseStart = Date.now();
        const parsed = await parseEmail(raw);
        const parseMs = Date.now() - parseStart;
        const imported = await persistParsedEmail(account, parsed, uidl, mailStorage.sha256(raw));
        // Cảnh báo email chậm để chẩn đoán (mạng chậm / email lớn).
        if (retrMs > 2000 || parseMs > 2000) {
          log(`[mail] email ${no}: tải ${retrMs}ms, parse ${parseMs}ms (${raw.length} byte)`);
        }
        if (imported) {
          summary.imported += 1;
          summary.attachCount += parsed.attachments.length;
          // Email xử lý theo thứ tự cũ → mới ⇒ unshift để phần tử đầu là MỚI NHẤT.
          recent.unshift({
            ID: Number(imported),
            SUBJECT: parsed.subject,
            FROM_NAME: parsed.from?.name,
            FROM_ADDRESS: parsed.from?.address,
            PREVIEW_TEXT: parsed.previewText,
          });
          if (recent.length > 10) recent.pop();
          if (summary.imported % 10 === 0) {
            log(`[mail] acc=${account.ID} đã tải ${summary.imported}/${pending.length}...`);
          }
        }
      } catch (error) {
        // Lỗi 1 email không được chặn cả mailbox.
        log(`[mail] lỗi email ${no}: ${error?.message || error}`);
      }
    }

    await mailRepo.releaseLock(accountId, { lastUidl, importedDelta: summary.imported, serverTotal });
    log(`[mail] acc=${account.ID} hoàn tất lượt: imported=${summary.imported}, tổng server=${serverTotal}`);
    await mailRepo.updateAccountSyncState(accountId, { status: "SUCCESS", error: null });
    if (summary.imported > 0) {
      emitNewEmail(account, summary);
      // Thông báo đẩy cho thiết bị KHÔNG đang mở ERP (tôn trọng tắt thông báo theo mailbox).
      await require("./mailPush")
        .pushNewEmail({ account, messages: recent, imported: summary.imported })
        .catch((error) => log(`[mail] push lỗi: ${error?.message || error}`));
    }

    await mailRepo.finishSyncLog(logId, {
      status: "SUCCESS",
      connected: true,
      newCount: summary.newCount,
      importedCount: summary.imported,
      attachCount: summary.attachCount,
    });
    return summary;
  } catch (error) {
    const errorCode = error?.code || (error?.pop3Response ? "POP3" : "ERROR");
    summary.ok = false;
    summary.errorCode = errorCode;
    summary.message = error?.message || String(error);
    await mailRepo.releaseLock(accountId).catch(() => undefined);
    await mailRepo.updateAccountSyncState(accountId, { status: "ERROR", error: summary.message });
    await mailRepo.finishSyncLog(logId, {
      status: "ERROR",
      connected: summary.connected,
      newCount: summary.newCount,
      importedCount: summary.imported,
      attachCount: summary.attachCount,
      errorCode,
      errorMessage: summary.message,
    });
    return summary;
  } finally {
    if (client) client.destroy();
  }
}

/** Kiểm tra kết nối + đăng nhập POP3 (dùng cho nút "Test connection"). */
async function testConnection(accountRow) {
  const cred = resolvePop3Credential(accountRow);
  if (!cred.host || !cred.password) {
    return { ok: false, message: "Thiếu cấu hình POP3 host/credential" };
  }
  const client = new Pop3Client({ ...cred, timeoutMs: POP3_TIMEOUT_MS, rejectUnauthorized: TLS_REJECT_UNAUTHORIZED, log: defLog });
  try {
    await client.connect();
    await client.auth();
    const stat = await client.stat();
    return { ok: true, message: `Kết nối OK — ${stat.count} email (${stat.size} byte)` };
  } catch (error) {
    return { ok: false, message: error?.message || String(error) };
  } finally {
    client.destroy();
  }
}

module.exports = {
  syncMailbox,
  testConnection,
  resolvePop3Credential,
  emitNewEmail,
  SYNC_INTERVAL_SECONDS,
  MAX_BATCH_PER_RUN,
};
