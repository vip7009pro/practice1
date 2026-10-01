/**
 * Command handlers ĐỌC cho hộp thư (Phase 2).
 *
 * Gồm: bootstrap (folders + unread + accounts), danh sách inbox (keyset),
 * đọc 1 email, hội thoại, đánh dấu đã đọc / gắn sao.
 *
 * Kiểm quyền: người dùng chỉ truy cập được email thuộc mailbox mà mình sở hữu
 * HOẶC mailbox dùng chung (`IS_SHARED = 1`) trong cùng công ty (`CTR_CD`).
 */
const mailRepo = require("./mailRepository");
const msgRepo = require("./mailMessageRepository");
const mailStorage = require("./mailStorage");

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

/** Danh sách account id mà người dùng được phép xem. */
async function accessibleAccounts(ctrCd, emplNo) {
  const rows = await mailRepo.listAccounts({ ctrCd, emplNo });
  return rows.map((r) => ({ ID: r.ID, EMAIL_ADDRESS: r.EMAIL_ADDRESS, DISPLAY_NAME: r.DISPLAY_NAME }));
}

/** Xác nhận email thuộc quyền truy cập của người dùng; trả về row hoặc null. */
async function loadOwnedMessage(id, ctrCd, emplNo) {
  const message = await msgRepo.getMessageWithAccount(id);
  if (!message) return null;
  if (String(message.CTR_CD) !== String(ctrCd)) return null;
  if (message.IS_SHARED === true || message.IS_SHARED === 1) return message;
  if (String(message.ACCOUNT_EMPL_NO || "").trim().toUpperCase() === emplNo) return message;
  return null;
}

/** Map 1 dòng message ⇒ object gọn cho danh sách. */
function mapListItem(row) {
  return {
    id: row.ID,
    accountId: row.MAIL_ACCOUNT_ID,
    threadId: row.THREAD_ID,
    from: { address: row.FROM_ADDRESS, name: row.FROM_NAME },
    subject: row.SUBJECT || "(Không có tiêu đề)",
    preview: row.PREVIEW_TEXT || "",
    sentAt: row.SENT_AT,
    receivedAt: row.RECEIVED_AT,
    isRead: row.IS_READ === true || row.IS_READ === 1,
    isStarred: row.IS_STARRED === true || row.IS_STARRED === 1,
    isImportant: row.IS_IMPORTANT === true || row.IS_IMPORTANT === 1,
    hasAttachment: row.HAS_ATTACHMENT === true || row.HAS_ATTACHMENT === 1,
    attachmentCount: row.ATTACHMENT_COUNT || 0,
    folder: row.EFFECTIVE_FOLDER || row.FOLDER,
  };
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

exports.emailBootstrap = async (req, res) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    await mailRepo.ensureSystemFolders({ ctrCd, emplNo });
    const [folders, accounts] = await Promise.all([
      mailRepo.listFolders({ ctrCd, emplNo }),
      accessibleAccounts(ctrCd, emplNo),
    ]);
    const accountIds = accounts.map((a) => a.ID);
    const unreadTotal = await msgRepo.countUnread({ accountIds, emplNo });

    // Đếm nhanh cho từng thư mục hệ thống (INBOX/STARRED quan trọng nhất).
    const counts = {};
    for (const key of ["INBOX", "STARRED"]) {
      if (key === "STARRED") {
        const rows = await mailRepo.queryRows(
          `SELECT COUNT(*) AS C FROM ZTB_MAIL_MESSAGE m
           LEFT JOIN ZTB_MAIL_USERSTATE us ON us.MESSAGE_ID = m.ID AND us.EMPL_NO = @EMPL
           WHERE m.MAIL_ACCOUNT_ID IN (${accountIds.length ? accountIds.join(",") : "NULL"})
             AND m.DELETED_AT IS NULL AND us.DELETED_AT IS NULL
             AND ISNULL(us.IS_STARRED, m.IS_STARRED) = 1`,
          { EMPL: emplNo }
        );
        counts.STARRED = Number(rows[0]?.C || 0);
      } else {
        counts.INBOX = await msgRepo.countUnread({ accountIds, emplNo });
      }
    }

    ok(res, { folders, accounts, unreadTotal, counts, myEmplNo: emplNo });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Danh sách                                                           */
/* ------------------------------------------------------------------ */

exports.emailInbox = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const accounts = await accessibleAccounts(ctrCd, emplNo);
    const accountIds = accounts.map((a) => a.ID);
    const limit = Math.min(Math.max(Number(DATA.limit) || 30, 1), 100);
    const folder = String(DATA.folder || "INBOX").toUpperCase();

    const rows = await msgRepo.listInbox({
      accountIds,
      emplNo,
      folder,
      limit: limit + 1,
      cursor: DATA.cursor || null,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    ok(res, {
      messages: page.map(mapListItem),
      hasMore,
      nextCursor: hasMore && last ? { receivedAt: last.RECEIVED_AT, id: last.ID } : null,
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Chi tiết                                                            */
/* ------------------------------------------------------------------ */

exports.emailGet = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID email", "INVALID");

    const message = await loadOwnedMessage(id, ctrCd, emplNo);
    if (!message) return fail(res, "Không tìm thấy email hoặc bạn không có quyền", "FORBIDDEN");

    const attachments = await msgRepo.listAttachmentsByMessage(id);
    const thread = message.THREAD_ID ? await msgRepo.listThreadMessages(message.THREAD_ID) : [];

    // Body nhỏ lưu inline; body lớn trả URL để FE tải qua /mailfile/body/:id (không nạp hết vào JSON).
    const hasExternalBody = !message.BODY_INLINE && !!message.BODY_STORAGE_PATH;
    ok(res, {
      message: {
        id: message.ID,
        accountId: message.MAIL_ACCOUNT_ID,
        threadId: message.THREAD_ID,
        messageId: message.MESSAGE_ID,
        inReplyTo: message.IN_REPLY_TO,
        from: { address: message.FROM_ADDRESS, name: message.FROM_NAME },
        to: safeJson(message.TO_JSON),
        cc: safeJson(message.CC_JSON),
        bcc: safeJson(message.BCC_JSON),
        subject: message.SUBJECT || "(Không có tiêu đề)",
        sentAt: message.SENT_AT,
        receivedAt: message.RECEIVED_AT,
        bodyHtml: message.BODY_INLINE || null,
        bodyExternal: hasExternalBody,
        isRead: message.IS_READ === true || message.IS_READ === 1,
        isStarred: message.IS_STARRED === true || message.IS_STARRED === 1,
        hasAttachment: message.HAS_ATTACHMENT === true || message.HAS_ATTACHMENT === 1,
        folder: message.FOLDER,
      },
      attachments: attachments.map(mapAttachment),
      thread: thread.map((t) => ({
        id: t.ID,
        from: { address: t.FROM_ADDRESS, name: t.FROM_NAME },
        subject: t.SUBJECT,
        sentAt: t.SENT_AT,
        receivedAt: t.RECEIVED_AT,
        preview: t.PREVIEW_TEXT,
        isRead: t.IS_READ === true || t.IS_READ === 1,
      })),
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailListAttachments = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID email", "INVALID");
    const message = await loadOwnedMessage(id, ctrCd, emplNo);
    if (!message) return fail(res, "Không có quyền", "FORBIDDEN");
    const attachments = await msgRepo.listAttachmentsByMessage(id);
    ok(res, attachments.map(mapAttachment));
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Trạng thái đọc / sao                                                */
/* ------------------------------------------------------------------ */

exports.emailMarkRead = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID email", "INVALID");
    const message = await loadOwnedMessage(id, ctrCd, emplNo);
    if (!message) return fail(res, "Không có quyền", "FORBIDDEN");
    const isRead = DATA.IS_READ !== false;
    await msgRepo.upsertUserState({ messageId: id, emplNo, isRead });
    ok(res, { id, isRead });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

exports.emailStar = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const id = Number(DATA.ID);
    if (!Number.isInteger(id) || id <= 0) return fail(res, "Thiếu ID email", "INVALID");
    const message = await loadOwnedMessage(id, ctrCd, emplNo);
    if (!message) return fail(res, "Không có quyền", "FORBIDDEN");
    const isStarred = DATA.IS_STARRED === true || DATA.IS_STARRED === 1;
    await msgRepo.upsertUserState({ messageId: id, emplNo, isStarred });
    ok(res, { id, isStarred });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function safeJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapAttachment(a) {
  return {
    id: a.ID,
    messageId: a.MESSAGE_ID,
    fileName: a.FILE_NAME || "tệp đính kèm",
    contentType: a.CONTENT_TYPE || "application/octet-stream",
    fileSize: a.FILE_SIZE || 0,
    isInline: a.IS_INLINE === true || a.IS_INLINE === 1,
    contentId: a.CONTENT_ID || null,
    status: a.STATUS,
    available: !!(a.STORAGE_PATH && mailStorage.exists(a.STORAGE_PATH)),
  };
}
