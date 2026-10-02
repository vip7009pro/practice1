/**
 * GỬI email qua SMTP + lưu bản sao vào thư mục "Đã gửi" + quản lý bản nháp.
 *
 * - Browser KHÔNG bao giờ kết nối SMTP trực tiếp; mọi thứ đi qua backend.
 * - SMTP dùng cấu hình của mailbox người gửi; nếu thiếu thì lấy mặc định từ env `MAIL_SMTP_*`.
 * - Sau khi gửi thành công ⇒ lưu 1 bản vào DB (FOLDER='SENT') kèm đính kèm (tái dùng kho vật lý).
 * - Đính kèm soạn thảo lấy từ ZTB_MAIL_OUTBOX theo ID (không nhận path từ client).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const mailRepo = require("./mailRepository");
const msgRepo = require("./mailMessageRepository");
const outboxRepo = require("./mailOutboxRepository");
const mailCrypto = require("./mailCrypto");
const mailStorage = require("./mailStorage");
const { buildPreview } = require("./mailParserService");

const BODY_INLINE_MAX_BYTES = Number(process.env.MAIL_BODY_INLINE_MAX_BYTES || 262144);
const MAX_ATTACH_TOTAL = Number(process.env.MAIL_SEND_MAX_ATTACH_BYTES || 50 * 1024 * 1024);
const SEND_TIMEOUT_MS = Number(process.env.MAIL_SMTP_TIMEOUT_MS || 30000) || 30000;

function ok(res, data) {
  res.send({ tk_status: "OK", data });
}
function fail(res, message, code) {
  res.send({ tk_status: "NG", code, message });
}
function ctx(req) {
  const p = req.payload_data || {};
  return { ctrCd: p.CTR_CD, emplNo: String(p.EMPL_NO || "").trim().toUpperCase() };
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Cấu hình SMTP + transport                                           */
/* ------------------------------------------------------------------ */

function resolveSmtpConfig(account) {
  const pass = account.SMTP_CRED_ENC
    ? mailCrypto.decryptSecret(account.SMTP_CRED_ENC)
    : mailCrypto.decryptSecret(account.POP3_CRED_ENC);
  const secure = account.SMTP_SECURE === undefined
    ? String(process.env.MAIL_SMTP_SECURE || "true") !== "false"
    : account.SMTP_SECURE === true || account.SMTP_SECURE === 1;
  return {
    host: account.SMTP_HOST || process.env.MAIL_SMTP_HOST || account.POP3_HOST,
    port: Number(account.SMTP_PORT) || Number(process.env.MAIL_SMTP_PORT) || (secure ? 465 : 25),
    secure,
    auth: {
      user: account.SMTP_USERNAME || account.POP3_USERNAME || account.EMAIL_ADDRESS,
      pass,
    },
  };
}

function buildTransport(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth.pass ? smtp.auth : undefined,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
    tls: { rejectUnauthorized: String(process.env.MAIL_TLS_REJECT_UNAUTHORIZED || "true") !== "false" },
  });
}

/** Dịch lỗi SMTP thô thành thông báo dễ hiểu cho người dùng. */
function friendlySmtpError(message, host, port) {
  const msg = String(message || "");
  if (/ETIMEDOUT|timeout|timed out/i.test(msg)) {
    return `Hết thời gian kết nối tới ${host}:${port}. Cổng này có thể bị tường lửa/máy chủ chặn — hãy thử cổng 465 (SSL) hoặc 25.`;
  }
  if (/ECONNREFUSED/i.test(msg)) {
    return `Máy chủ ${host} từ chối kết nối ở cổng ${port}. Kiểm tra lại cổng SMTP.`;
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    return `Không tìm thấy máy chủ SMTP "${host}". Kiểm tra lại tên máy chủ.`;
  }
  if (/EAUTH|Invalid login|535|534|530/i.test(msg)) {
    return `Sai tài khoản/mật khẩu SMTP (hoặc máy chủ yêu cầu SSL). Kiểm tra lại Tài khoản/Mật khẩu và cổng.`;
  }
  if (/self.signed|self signed|certificate|UNABLE_TO_VERIFY/i.test(msg)) {
    return `Lỗi chứng chỉ SSL của máy chủ SMTP. Nếu là mail nội bộ, đặt MAIL_TLS_REJECT_UNAUTHORIZED=false trong .ENV.`;
  }
  return msg;
}

/** Kiểm tra kết nối + đăng nhập SMTP với 1 cấu hình cụ thể. */
async function testSmtpConfig(cfg, { timeoutMs = 8000 } = {}) {
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: !!cfg.secure,
    auth: cfg.username && cfg.password ? { user: cfg.username, pass: cfg.password } : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    tls: {
      rejectUnauthorized: cfg.rejectUnauthorized !== undefined
        ? !!cfg.rejectUnauthorized
        : String(process.env.MAIL_TLS_REJECT_UNAUTHORIZED || "true") !== "false",
    },
  });
  try {
    await transporter.verify();
    return { ok: true, message: "Kết nối SMTP OK" };
  } catch (error) {
    return { ok: false, message: friendlySmtpError(error?.message, cfg.host, cfg.port) };
  } finally {
    try { transporter.close(); } catch { /* bỏ qua */ }
  }
}

/** Các cổng SMTP phổ biến, xếp theo thứ tự thử (ưu tiên có mã hoá trước). */
const SMTP_CANDIDATES = [
  { port: 465, secure: true, label: "465 · SSL/TLS (SMTPS)" },
  { port: 587, secure: false, label: "587 · STARTTLS" },
  { port: 25, secure: false, label: "25 · SMTP + STARTTLS" },
  // Mail nội bộ thường dùng chứng chỉ TỰ KÝ ⇒ thử lại cổng 25 sau khi bỏ kiểm tra chứng chỉ.
  { port: 25, secure: false, rejectUnauthorized: false, label: "25 · SMTP + STARTTLS (bỏ kiểm tra chứng chỉ)" },
  // Một số server cấu hình nhầm SSL ngầm định trên 465 ⇒ thử 465 dạng thường.
  { port: 465, secure: false, rejectUnauthorized: false, label: "465 · thường (không SSL)" },
];

/** Dò lần lượt các cổng SMTP, dừng ở cổng đầu tiên kết nối + đăng nhập được. */
async function probeSmtp({ host, username, password, timeoutMs = 6000 }) {
  const results = [];
  for (const cand of SMTP_CANDIDATES) {
    const r = await testSmtpConfig({ host, port: cand.port, secure: cand.secure, rejectUnauthorized: cand.rejectUnauthorized, username, password }, { timeoutMs });
    results.push({ port: cand.port, secure: cand.secure, rejectUnauthorized: cand.rejectUnauthorized, label: cand.label, ok: r.ok, message: r.message });
    if (r.ok) break;
  }
  const working = results.find((r) => r.ok);
  return {
    results,
    recommended: working ? { port: working.port, secure: working.secure, relaxTls: working.rejectUnauthorized === false } : null,
  };
}

/** Lấy mailbox của chính người dùng (để gửi). */
async function requireOwnAccount(ctrCd, emplNo) {
  const found = await mailRepo.getAccountByEmpl({ ctrCd, emplNo });
  if (!found) return null;
  if (found.IS_ACTIVE === false || found.IS_ACTIVE === 0) return null;
  return mailRepo.getAccountWithCredentials(found.ID);
}

/* ------------------------------------------------------------------ */
/* Tiện ích soạn nội dung                                              */
/* ------------------------------------------------------------------ */

/** Người nhận từ tham số FE (chuỗi "Tên <mail>" hoặc "mail", ngăn cách , hoặc ;). */
function parseRecipients(value) {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(/[,;]/);
  const out = [];
  for (const item of raw) {
    const text = typeof item === "object" && item !== null ? item.address || "" : String(item);
    const m = text.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
    const addr = (m ? m[2] : text).trim();
    if (!EMAIL_RE.test(addr)) continue;
    out.push({ address: addr, name: m && m[1] ? m[1].trim() : null });
  }
  return out;
}

function recipientsToText(list) {
  return list.map((r) => (r.name ? `"${r.name}" <${r.address}>` : r.address)).join(", ");
}

function escapeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Ảnh nhúng dạng `data:image/...;base64,...` trong HTML. */
const DATA_IMG_RE = /src\s*=\s*(["'])data:(image\/[a-z0-9.+-]+);base64,([^"']+)\1/gi;
/** Giới hạn mỗi ảnh data: khi chuyển thành đính kèm (tránh nhồi ảnh khổng lồ). */
const MAX_DATA_IMAGE_BYTES = Number(process.env.MAIL_MAX_DATA_IMAGE_BYTES || 5 * 1024 * 1024);

/**
 * Chuyển ảnh `data:` trong HTML thành đính kèm `cid:` để HIỂN THỊ ĐƯỢC ở bên nhận.
 *
 * Lý do: nhiều webmail (Gmail...) **chặn `data:` URI** ⇒ ảnh trong email chuyển tiếp bị ô trống.
 * Gửi lại dưới dạng ảnh nhúng `Content-ID` thì mọi mail client đều hiển thị được.
 */
function embedDataImages(html) {
  const attachments = [];
  let index = 0;
  let skipped = 0;
  let skippedBytes = 0;
  const out = String(html || "").replace(DATA_IMG_RE, (match, quote, mime, base64) => {
    try {
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length === 0 || buffer.length > MAX_DATA_IMAGE_BYTES) {
        // Ảnh quá lớn: báo lại để người gửi biết (ảnh dạng data: sẽ bị nhiều nơi chặn).
        skipped += 1;
        skippedBytes += buffer.length;
        return match;
      }
      const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg").split("+")[0];
      index += 1;
      const cid = `erp-img-${Date.now()}-${index}`;
      attachments.push({
        filename: `image${index}.${ext}`,
        contentType: mime,
        content: buffer,
        size: buffer.length,
        cid,
        isInline: true,
        contentId: cid,
      });
      return `src=${quote}cid:${cid}${quote}`;
    } catch {
      return match;
    }
  });
  return { html: out, attachments, skipped, skippedBytes };
}

/** Tạo phần trích dẫn email gốc cho trả lời/chuyển tiếp. */
function quoteOriginal(original, { forward = false, html = null } = {}) {
  const body = html || original.BODY_INLINE || `<p>${escapeHtml(original.PREVIEW_TEXT || "(không có nội dung)")}</p>`;
  const header =
    `---------- ${forward ? "Chuyển tiếp" : "Thư gốc"} ----------<br/>` +
    `Từ: ${escapeHtml(original.FROM_NAME || original.FROM_ADDRESS || "")} &lt;${escapeHtml(original.FROM_ADDRESS || "")}&gt;<br/>` +
    `Ngày: ${escapeHtml(String(original.SENT_AT || original.RECEIVED_AT || ""))}<br/>` +
    `Tiêu đề: ${escapeHtml(original.SUBJECT || "")}<br/><br/>`;
  return `<br/><br/><blockquote style="margin:0 0 0 12px;padding-left:12px;border-left:2px solid #cbd5e1;color:#475569">${header}${body}</blockquote>`;
}

/** Đọc body HTML của email gốc (kể cả khi body lưu trên NAS) — giới hạn kích thước. */
function readOriginalHtml(original, maxBytes = 3 * 1024 * 1024) {
  if (original.BODY_INLINE) return original.BODY_INLINE;
  if (!original.BODY_STORAGE_PATH) return null;
  try {
    const stat = fs.statSync(original.BODY_STORAGE_PATH);
    if (stat.size > maxBytes) return null;
    return fs.readFileSync(original.BODY_STORAGE_PATH, "utf8");
  } catch {
    return null;
  }
}

function subjectWithPrefix(subject, prefix) {
  const clean = String(subject || "").trim();
  if (!clean) return prefix;
  return new RegExp(`^${prefix}\\s*:`, "i").test(clean) ? clean : `${prefix}: ${clean}`;
}

/* ------------------------------------------------------------------ */
/* Đính kèm                                                            */
/* ------------------------------------------------------------------ */

async function loadOutboxAttachments({ attachmentIds, emplNo }) {
  const rows = await outboxRepo.listOutbox({ ids: attachmentIds, emplNo });
  return rows.map((row) => ({
    row,
    filename: row.FILE_NAME || path.basename(row.STORAGE_PATH),
    contentType: row.CONTENT_TYPE || undefined,
    path: row.STORAGE_PATH,
    size: Number(row.FILE_SIZE) || 0,
    cid: null,
    isInline: false,
    contentId: null,
  }));
}

/**
 * Đính kèm của email GỐC (dùng khi chuyển tiếp/trả lời).
 *  - Ảnh inline (có Content-ID) ⇒ đính kèm lại dạng `cid` để ảnh trong phần trích dẫn hiện đúng.
 *  - `includeNonInline` = true (chuyển tiếp) ⇒ kèm cả tệp đính kèm thường.
 */
async function loadOriginalAttachments(originalId, { includeNonInline }) {
  const rows = await msgRepo.listAttachmentsByMessage(originalId);
  return rows
    .filter((r) => r.STORAGE_PATH && fs.existsSync(r.STORAGE_PATH))
    .filter((r) => includeNonInline || r.IS_INLINE === true || r.IS_INLINE === 1)
    .map((r) => ({
      row: r,
      filename: r.FILE_NAME || path.basename(r.STORAGE_PATH),
      contentType: r.CONTENT_TYPE || undefined,
      path: r.STORAGE_PATH,
      size: Number(r.FILE_SIZE) || 0,
      cid: r.CONTENT_ID || null,
      isInline: r.IS_INLINE === true || r.IS_INLINE === 1,
      contentId: r.CONTENT_ID || null,
    }));
}

/* ------------------------------------------------------------------ */
/* Lưu bản sao vào "Đã gửi"                                            */
/* ------------------------------------------------------------------ */

async function saveToSent({ account, to, cc, bcc, subject, html, text, attachments }) {
  const sentAt = new Date();
  const previewText = buildPreview({ text, html });
  const bytes = Buffer.byteLength(html || "", "utf8");
  let bodyStoragePath = null;
  let bodyInline = html || null;
  if (bytes > BODY_INLINE_MAX_BYTES) {
    const dir = mailStorage.buildMessageDir({
      ctrCd: account.CTR_CD,
      sentAt,
      mailboxKey: account.EMAIL_ADDRESS,
      messageRef: `sent-${Date.now()}`,
    });
    bodyStoragePath = mailStorage.writeBody(html || "", dir);
    bodyInline = null;
  }

  // Ghi file vật lý TRƯỚC (ngoài transaction).
  const prepared = [];
  for (const att of attachments) {
    try {
      const buf = att.content ? Buffer.from(att.content) : fs.readFileSync(att.path);
      const phys = mailStorage.writePhysicalFile(buf, path.extname(att.filename || ""));
      prepared.push({ att, phys });
    } catch (error) {
      console.warn(`[mail] bỏ qua đính kèm khi lưu Đã gửi: ${error?.message || error}`);
    }
  }

  return mailRepo.withTransaction(async (tx) => {
    const messageId = await msgRepo.insertMessage(tx, {
      mailAccountId: account.ID,
      messageId: `<${crypto.randomUUID()}@${String(account.EMAIL_ADDRESS).split("@")[1] || "erp"}>`,
      folder: "SENT",
      fromAddress: account.EMAIL_ADDRESS,
      fromName: account.DISPLAY_NAME || null,
      toJson: JSON.stringify(to),
      ccJson: JSON.stringify(cc),
      bccJson: JSON.stringify(bcc),
      subject,
      sentAt,
      receivedAt: sentAt,
      hasAttachment: prepared.length > 0,
      attachmentCount: prepared.length,
      bodyStoragePath,
      bodyInline,
      previewText,
      sizeBytes: bytes,
    });
    await msgRepo.insertRecipients(tx, messageId, [
      ...to.map((r) => ({ ...r, type: "TO" })),
      ...cc.map((r) => ({ ...r, type: "CC" })),
      ...bcc.map((r) => ({ ...r, type: "BCC" })),
    ]);
    for (const { att, phys } of prepared) {
      const physicalId = await msgRepo.ensurePhysicalFileTx(tx, {
        hash: phys.hash,
        storagePath: phys.storagePath,
        size: phys.size,
      });
      await msgRepo.insertAttachment(tx, {
        messageId,
        fileName: att.filename,
        contentType: att.contentType,
        fileSize: phys.size,
        contentId: att.contentId,
        isInline: att.isInline,
        fileHash: phys.hash,
        physicalFileId: physicalId,
        status: "READY",
      });
    }
    return messageId;
  });
}

/* ------------------------------------------------------------------ */
/* Gửi                                                                 */
/* ------------------------------------------------------------------ */

async function performSend({ account, to, cc, bcc, subject, html, text, attachments }) {
  if (to.length === 0) throw Object.assign(new Error("Thiếu người nhận (To)"), { code: "NO_RECIPIENT" });
  // Ảnh inline là một phần của nội dung ⇒ không tính vào hạn mức đính kèm.
  const totalAttach = attachments.reduce((s, a) => s + (a.isInline ? 0 : a.size), 0);
  if (totalAttach > MAX_ATTACH_TOTAL) {
    throw Object.assign(new Error("Tổng dung lượng đính kèm vượt giới hạn"), { code: "ATTACH_TOO_LARGE" });
  }

  const smtp = resolveSmtpConfig(account);
  const transporter = buildTransport(smtp);
  let info;
  try {
    info = await transporter.sendMail({
      from: account.DISPLAY_NAME ? `"${account.DISPLAY_NAME}" <${account.EMAIL_ADDRESS}>` : account.EMAIL_ADDRESS,
      to: recipientsToText(to),
      cc: cc.length ? recipientsToText(cc) : undefined,
      bcc: bcc.length ? recipientsToText(bcc) : undefined,
      subject,
      html: html || undefined,
      text: text || undefined,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        // Ảnh inline cần `cid` khớp với `src="cid:..."` trong HTML.
        cid: a.cid || undefined,
        // Ảnh chuyển từ data: ⇒ gửi trực tiếp bằng Buffer; còn lại đọc từ đĩa.
        content: a.content || undefined,
        path: a.content ? undefined : a.path,
      })),
    });
  } catch (error) {
    const friendly = friendlySmtpError(error?.message, smtp.host, smtp.port);
    const wrapped = new Error(friendly);
    wrapped.code = error?.code || "SMTP_ERROR";
    throw wrapped;
  } finally {
    try { transporter.close(); } catch { /* bỏ qua */ }
  }

  const messageId = await saveToSent({ account, to, cc, bcc, subject, html, text, attachments });
  return { messageId: info.messageId, sentMessageRowId: messageId };
}

/** Gửi email mới. */
exports.emailSend = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const account = await requireOwnAccount(ctrCd, emplNo);
    if (!account) return fail(res, "Bạn chưa cấu hình mailbox hoặc mailbox đang tắt.", "NO_ACCOUNT");

    const to = parseRecipients(DATA.TO);
    const cc = parseRecipients(DATA.CC);
    const bcc = parseRecipients(DATA.BCC);
    const subject = String(DATA.SUBJECT || "").slice(0, 500);
    const html0 = typeof DATA.BODY_HTML === "string" ? DATA.BODY_HTML : "";
    // Lọc lần cuối ở SERVER (client có thể bị sửa/thay thế) trước khi nhúng ảnh data:.
    const sanitized = require("./mailHtmlSanitize").sanitizeOutboundHtml(html0);
    if (sanitized.removed.blocks || sanitized.removed.events || sanitized.removed.urls) {
      console.warn(
        `[mail] đã lọc mã nguy hiểm trong thư gửi: blocks=${sanitized.removed.blocks} events=${sanitized.removed.events} urls=${sanitized.removed.urls}`
      );
    }
    // Ảnh dán từ clipboard dạng data: ⇒ chuyển thành đính kèm cid để bên nhận hiển thị được.
    const embedded = embedDataImages(sanitized.html);
    const html = embedded.html;
    const text = typeof DATA.BODY_TEXT === "string" ? DATA.BODY_TEXT : html.replace(/<[^>]+>/g, " ");
    const attachments = [
      ...(await loadOutboxAttachments({ attachmentIds: DATA.ATTACHMENT_IDS, emplNo })),
      ...embedded.attachments,
    ];

    const result = await performSend({ account, to, cc, bcc, subject, html, text, attachments });
    if (DATA.DRAFT_ID) await mailRepo.deleteDraft({ id: Number(DATA.DRAFT_ID), emplNo }).catch(() => undefined);
    if (DATA.ATTACHMENT_IDS?.length) await outboxRepo.deleteOutbox({ ids: DATA.ATTACHMENT_IDS, emplNo }).catch(() => undefined);
    ok(res, {
      ...result,
      inlineImagesEmbedded: embedded.attachments.length,
      inlineImagesSkipped: embedded.skipped,
      inlineImagesSkippedBytes: embedded.skippedBytes,
    });
  } catch (error) {
    fail(res, error?.message || String(error), error?.code || "SEND_FAILED");
  }
};

/** Trả lời / trả lời tất cả / chuyển tiếp — dựa trên email gốc trong DB. */
async function replyOrForward(req, res, DATA, mode) {
  const { ctrCd, emplNo } = ctx(req);
  const account = await requireOwnAccount(ctrCd, emplNo);
  if (!account) return fail(res, "Bạn chưa cấu hình mailbox hoặc mailbox đang tắt.", "NO_ACCOUNT");

  const id = Number(DATA.ID);
  if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID email gốc", "INVALID");
  const original = await msgRepo.getMessageWithAccount(id);
  if (!original || String(original.CTR_CD) !== String(ctrCd)) return fail(res, "Không tìm thấy email gốc", "NOT_FOUND");

  const originalHtml = readOriginalHtml(original);
  const quote = DATA.INCLUDE_QUOTE === false ? "" : quoteOriginal(original, { forward: mode === "forward", html: originalHtml });
  const bodyHtml = `${typeof DATA.BODY_HTML === "string" ? DATA.BODY_HTML : ""}${quote}`;

  let to = [];
  let cc = [];
  if (mode === "forward") {
    to = parseRecipients(DATA.TO);
  } else {
    to = original.FROM_ADDRESS ? [{ address: original.FROM_ADDRESS, name: original.FROM_NAME || null }] : [];
    if (mode === "replyAll") {
      const originals = [original.TO_JSON, original.CC_JSON]
        .map((v) => { try { return JSON.parse(v || "[]"); } catch { return []; } })
        .flat();
      const seen = new Set([account.EMAIL_ADDRESS, original.FROM_ADDRESS]);
      cc = originals.filter((r) => r?.address && !seen.has(r.address));
    }
    // Cho phép FE bổ sung/ghi đè người nhận.
    if (DATA.TO) to = parseRecipients(DATA.TO);
    if (DATA.CC) cc = parseRecipients(DATA.CC);
  }
  if (DATA.BCC) { /* BCC do FE truyền */ }
  const bcc = parseRecipients(DATA.BCC);

  const subject = DATA.SUBJECT
    ? String(DATA.SUBJECT).slice(0, 500)
    : subjectWithPrefix(original.SUBJECT, mode === "forward" ? "Fwd" : "Re");

  const outbox = await loadOutboxAttachments({ attachmentIds: DATA.ATTACHMENT_IDS, emplNo });
  // Giữ ảnh inline của thư gốc (để ảnh trong phần trích dẫn hiển thị đúng);
  // chuyển tiếp thì kèm cả tệp đính kèm thường (trừ khi tắt INCLUDE_ATTACHMENTS).
  const originalAttachments = await loadOriginalAttachments(original.ID, {
    includeNonInline: mode === "forward" && DATA.INCLUDE_ATTACHMENTS !== false,
  });
  // Ảnh `data:` trong phần trích dẫn (Gmail CHẶN) ⇒ chuyển thành ảnh nhúng `cid:`.
  const embedded = embedDataImages(require("./mailHtmlSanitize").sanitizeOutboundHtml(bodyHtml).html);
  const cidRefs = String(embedded.html).toLowerCase();
  // Chỉ kèm ảnh inline của thư gốc khi phần trích dẫn THỰC SỰ tham chiếu tới nó (tránh đính kèm thừa).
  const fromOriginal = originalAttachments.filter(
    (a) => !a.isInline || (a.contentId && cidRefs.includes(`cid:${String(a.contentId).toLowerCase()}`))
  );
  const attachments = [...outbox, ...fromOriginal, ...embedded.attachments];
  const text = embedded.html.replace(/<[^>]+>/g, " ");

  try {
    const result = await performSend({ account, to, cc, bcc, subject, html: embedded.html, text, attachments });
    if (DATA.ATTACHMENT_IDS?.length) await outboxRepo.deleteOutbox({ ids: DATA.ATTACHMENT_IDS, emplNo }).catch(() => undefined);
    ok(res, result);
  } catch (error) {
    fail(res, error?.message || String(error), error?.code || "SEND_FAILED");
  }
}

exports.emailReply = (req, res, DATA = {}) => replyOrForward(req, res, DATA, "reply");
exports.emailReplyAll = (req, res, DATA = {}) => replyOrForward(req, res, DATA, "replyAll");
exports.emailForward = (req, res, DATA = {}) => replyOrForward(req, res, DATA, "forward");

/* ------------------------------------------------------------------ */
/* Bản nháp                                                            */
/* ------------------------------------------------------------------ */

exports.emailSaveDraft = async (req, res, DATA = {}) => {
  try {
    const { emplNo } = ctx(req);
    const id = await mailRepo.saveDraft({
      id: DATA.ID ? Number(DATA.ID) : undefined,
      emplNo,
      ctrCd: ctx(req).ctrCd,
      toJson: JSON.stringify(parseRecipients(DATA.TO)),
      ccJson: JSON.stringify(parseRecipients(DATA.CC)),
      bccJson: JSON.stringify(parseRecipients(DATA.BCC)),
      subject: String(DATA.SUBJECT || "").slice(0, 500),
      bodyHtml: typeof DATA.BODY_HTML === "string" ? DATA.BODY_HTML : null,
      bodyText: typeof DATA.BODY_TEXT === "string" ? DATA.BODY_TEXT : null,
      attachJson: JSON.stringify((DATA.ATTACHMENT_IDS || []).map(Number).filter(Boolean)),
      inReplyTo: DATA.IN_REPLY_TO || null,
      referencesHeader: DATA.REFERENCES || null,
    });
    ok(res, { id });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailDraftList = async (req, res, DATA = {}) => {
  try {
    const { emplNo } = ctx(req);
    ok(res, await mailRepo.listDrafts({ emplNo, limit: DATA.limit || 50 }));
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailDraftGet = async (req, res, DATA = {}) => {
  try {
    const { emplNo } = ctx(req);
    const id = Number(DATA.ID);
    const draft = await mailRepo.getDraft(id, { emplNo });
    if (!draft) return fail(res, "Không tìm thấy bản nháp", "NOT_FOUND");
    let to = []; let cc = []; let bcc = []; let attachmentIds = [];
    try { to = JSON.parse(draft.TO_JSON || "[]"); } catch { /* bỏ qua */ }
    try { cc = JSON.parse(draft.CC_JSON || "[]"); } catch { /* bỏ qua */ }
    try { bcc = JSON.parse(draft.BCC_JSON || "[]"); } catch { /* bỏ qua */ }
    try { attachmentIds = JSON.parse(draft.ATTACH_JSON || "[]"); } catch { /* bỏ qua */ }
    const attachments = await outboxRepo.listOutbox({ ids: attachmentIds, emplNo });
    ok(res, {
      id: draft.ID,
      to, cc, bcc,
      subject: draft.SUBJECT || "",
      bodyHtml: draft.BODY_HTML || "",
      inReplyTo: draft.IN_REPLY_TO || null,
      attachments: attachments.map((a) => ({ id: a.ID, fileName: a.FILE_NAME, fileSize: a.FILE_SIZE, contentType: a.CONTENT_TYPE })),
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailDeleteDraft = async (req, res, DATA = {}) => {
  try {
    const { emplNo } = ctx(req);
    const id = Number(DATA.ID);
    if (Number.isInteger(id) && id > 0) {
      const draft = await mailRepo.getDraft(id, { emplNo });
      if (draft) {
        try {
          const ids = JSON.parse(draft.ATTACH_JSON || "[]");
          await outboxRepo.deleteOutbox({ ids, emplNo }).catch(() => undefined);
        } catch { /* bỏ qua */ }
      }
      await mailRepo.deleteDraft({ id, emplNo });
    }
    ok(res, { id });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailSendDraft = exports.emailSend;

// Xuất tiện ích để tầng khác (mailAccountService) và script chẩn đoán dùng lại.
module.exports.testSmtpConfig = testSmtpConfig;
module.exports.probeSmtp = probeSmtp;
module.exports.friendlySmtpError = friendlySmtpError;
module.exports.resolveSmtpConfig = resolveSmtpConfig;

/** Test + DÒ cổng SMTP cho mailbox của chính người dùng (không cần admin). */
exports.emailTestSmtp = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const stored = await requireOwnAccount(ctrCd, emplNo);
    const host = String(DATA.SMTP_HOST || stored?.SMTP_HOST || process.env.MAIL_SMTP_HOST || stored?.POP3_HOST || "").trim();
    if (!host) return fail(res, "Thiếu máy chủ SMTP", "INVALID");

    const username = String(DATA.SMTP_USERNAME || stored?.SMTP_USERNAME || stored?.POP3_USERNAME || "").trim();
    const password = DATA.SMTP_PASSWORD
      ? String(DATA.SMTP_PASSWORD)
      : (stored?.SMTP_CRED_ENC || stored?.POP3_CRED_ENC)
        ? mailCrypto.decryptSecret(stored.SMTP_CRED_ENC || stored.POP3_CRED_ENC)
        : "";

    if (DATA.PORT) {
      const r = await testSmtpConfig({ host, port: Number(DATA.PORT), secure: DATA.SECURE !== false, username, password }, { timeoutMs: 8000 });
      return r.ok ? ok(res, { results: [{ port: Number(DATA.PORT), secure: DATA.SECURE !== false, ok: true, message: r.message }], recommended: { port: Number(DATA.PORT), secure: DATA.SECURE !== false } }) : fail(res, r.message, "CONNECT_FAILED");
    }

    const probe = await probeSmtp({ host, username, password });
    if (!probe.recommended) {
      return fail(res, `Không kết nối được cổng SMTP nào tới ${host}. ` + (probe.results[0]?.message || ""), "CONNECT_FAILED");
    }
    ok(res, probe);
  } catch (error) {
    fail(res, error?.message || String(error), "SMTP_ERROR");
  }
};
