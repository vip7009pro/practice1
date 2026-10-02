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
    const own = await mailRepo.getAccountByEmpl({ ctrCd, emplNo });
    // Mailbox người dùng đã TẮT thông báo đẩy (Phase 7).
    const mutedAccountIds = await mailRepo.listMutedAccountIds(emplNo).catch(() => []);

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

    ok(res, {
      folders,
      accounts,
      unreadTotal,
      counts,
      myEmplNo: emplNo,
      hasOwnAccount: !!own,
      ownAccountId: own?.ID || null,
      mutedAccountIds,
    });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Tắt/bật thông báo đẩy (Phase 7)                                     */
/* ------------------------------------------------------------------ */

/** Danh sách mailbox người dùng đã tắt thông báo đẩy. */
exports.emailMuteList = async (req, res) => {
  try {
    const { emplNo } = ctx(req);
    const mutedAccountIds = await mailRepo.listMutedAccountIds(emplNo);
    ok(res, { mutedAccountIds });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/** Bật/tắt thông báo đẩy cho 1 mailbox (chỉ với mailbox người dùng có quyền). */
exports.emailMuteAccount = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const accountId = Number(DATA.ACCOUNT_ID);
    if (!Number.isInteger(accountId) || accountId <= 0) return fail(res, "Thiếu ACCOUNT_ID", "INVALID");

    const accounts = await accessibleAccounts(ctrCd, emplNo);
    if (!accounts.some((a) => Number(a.ID) === accountId)) return fail(res, "Không có quyền với mailbox này", "FORBIDDEN");

    const muted = DATA.MUTED === true || DATA.MUTED === 1 || DATA.MUTED === "1";
    await mailRepo.setMailMute({ ctrCd, emplNo, accountId, muted });
    const mutedAccountIds = await mailRepo.listMutedAccountIds(emplNo);
    ok(res, { accountId, muted, mutedAccountIds });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Trạng thái đồng bộ                                                  */
/* ------------------------------------------------------------------ */

exports.emailSyncStatus = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const rows = await mailRepo.listSyncStatus({ ctrCd, emplNo: DATA.all ? null : emplNo });
    const accounts = rows.map((r) => {
      const imported = Number(r.IMPORTED || 0);
      const serverTotal = Number(r.SERVER_TOTAL || 0);
      return {
        accountId: r.ACCOUNT_ID,
        emailAddress: r.EMAIL_ADDRESS,
        displayName: r.DISPLAY_NAME,
        isActive: r.IS_ACTIVE === true || r.IS_ACTIVE === 1,
        lastSyncAt: r.LAST_SYNC_AT,
        lastSyncStatus: r.LAST_SYNC_STATUS,
        lastError: r.LAST_ERROR,
        inProgress: r.IN_PROGRESS === true || r.IN_PROGRESS === 1,
        serverTotal,
        imported,
        // serverTotal có thể = 0 nếu server không trả STAT ⇒ pending = 0 (không báo sai).
        pending: Math.max(0, serverTotal - imported),
      };
    });
    const totals = accounts.reduce(
      (acc, a) => ({
        serverTotal: acc.serverTotal + a.serverTotal,
        imported: acc.imported + a.imported,
        pending: acc.pending + a.pending,
        syncing: acc.syncing + (a.inProgress ? 1 : 0),
      }),
      { serverTotal: 0, imported: 0, pending: 0, syncing: 0 }
    );
    ok(res, { accounts, totals });
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
/* Tìm kiếm (Phase 5)                                                  */
/* ------------------------------------------------------------------ */

/** Chuẩn hoá mốc thời gian cho bộ lọc `after`/`before` (nhận ISO, `YYYY-MM-DD`, số ms). */
function parseSearchDate(value, { endOfDay = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    // Ngày thuần VN (GMT+7): after = 00:00, before = 00:00 ngày kế tiếp.
    const base = new Date(`${text}T00:00:00+07:00`);
    if (Number.isNaN(base.getTime())) return null;
    return endOfDay ? new Date(base.getTime() + 24 * 60 * 60 * 1000) : base;
  }
  const numeric = Number(text);
  const parsed = Number.isFinite(numeric) && text.length > 8 ? new Date(numeric) : new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * `emailSearch` — tìm kiếm server-side (không kéo toàn bộ hộp thư về browser).
 *
 * DATA:
 *  - `Q`/`TERMS`: từ khoá (mọi từ phải khớp), tìm trong subject/preview/body-inline/from/to.
 *  - `FROM`, `TO`, `SUBJECT`, `BODY`, `FILENAME`: lọc theo trường.
 *  - `FOLDER` (mặc định ALL), `ACCOUNT_ID`.
 *  - `HAS_ATTACHMENT`, `IS_UNREAD`, `IS_READ`, `IS_STARRED` (bool).
 *  - `AFTER`, `BEFORE` (ISO hoặc YYYY-MM-DD, hiểu theo giờ VN).
 *  - `SORT`: newest | oldest | sender | subject. `LIMIT`, `CURSOR`, `OFFSET`, `INCLUDE_COUNT`.
 */
exports.emailSearch = async (req, res, DATA = {}) => {
  const started = Date.now();
  try {
    const { ctrCd, emplNo } = ctx(req);
    const accounts = await accessibleAccounts(ctrCd, emplNo);
    const accountIds = accounts.map((a) => a.ID);
    const limit = Math.min(Math.max(Number(DATA.limit ?? DATA.LIMIT) || 30, 1), 100);

    const bool = (value) => (value === true || value === 1 || value === "1" || value === "true" ? true : undefined);
    const filters = {
      terms: Array.isArray(DATA.TERMS) ? DATA.TERMS.slice(0, 8) : [],
      keyword: typeof DATA.Q === "string" ? DATA.Q.trim() : "",
      from: DATA.FROM ? String(DATA.FROM).trim() : "",
      to: DATA.TO ? String(DATA.TO).trim() : "",
      subject: DATA.SUBJECT ? String(DATA.SUBJECT).trim() : "",
      body: DATA.BODY ? String(DATA.BODY).trim() : "",
      filename: DATA.FILENAME ? String(DATA.FILENAME).trim() : "",
      folder: String(DATA.FOLDER || "ALL").toUpperCase(),
      accountId: DATA.ACCOUNT_ID || DATA.accountId || null,
      hasAttachment:
        DATA.HAS_ATTACHMENT === true || DATA.HAS_ATTACHMENT === "1"
          ? true
          : DATA.HAS_ATTACHMENT === false || DATA.HAS_ATTACHMENT === "0"
          ? false
          : undefined,
      isUnread: bool(DATA.IS_UNREAD),
      isRead: bool(DATA.IS_READ),
      isStarred: bool(DATA.IS_STARRED),
      after: parseSearchDate(DATA.AFTER),
      before: parseSearchDate(DATA.BEFORE, { endOfDay: true }),
      sort: DATA.SORT || "newest",
    };

    const { rows } = await msgRepo.searchMessages({
      accountIds,
      emplNo,
      filters,
      limit: limit + 1,
      cursor: DATA.CURSOR || null,
      offset: Number(DATA.OFFSET) || 0,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const total = DATA.INCLUDE_COUNT ? await msgRepo.countSearchResults({ accountIds, emplNo, filters }) : undefined;

    ok(res, {
      messages: page.map(mapListItem),
      hasMore,
      nextCursor: hasMore && last ? { receivedAt: last.RECEIVED_AT, id: last.ID } : null,
      total,
      tookMs: Date.now() - started,
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

/** Gửi sự kiện realtime cho CHÍNH người dùng (mọi tab/thiết bị) — không chặn luồng chính. */
function emitToUser(emplNo, event, payload) {
  try {
    const { emitToUsers } = require("../../socket/socketHandler");
    if (typeof emitToUsers !== "function" || !emplNo) return;
    emitToUsers([emplNo], event, payload);
  } catch (error) {
    console.warn(`[mail] emit ${event} bỏ qua: ${error?.message || error}`);
  }
}

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
    // Đồng bộ trạng thái đọc sang các tab/thiết bị khác của cùng người dùng.
    emitToUser(emplNo, "email:state", { messageId: id, isRead, emplNo });
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
    emitToUser(emplNo, "email:state", { messageId: id, isStarred, emplNo });
    ok(res, { id, isStarred });
  } catch (error) {
    fail(res, error?.message || String(error));
  }
};

/* ------------------------------------------------------------------ */
/* Realtime (Phase 6)                                                  */
/* ------------------------------------------------------------------ */

/**
 * `emailSync` — lấy các email MỚI HƠN mốc đã biết (dùng khi có sự kiện `email:new`
 * hoặc sau khi socket kết nối lại). Trả kèm `unreadTotal` để cập nhật badge chính xác.
 *
 * DATA: `FOLDER` (mặc định INBOX), `SINCE` = `{ receivedAt, id }`, `LIMIT`.
 */
exports.emailSync = async (req, res, DATA = {}) => {
  try {
    const { ctrCd, emplNo } = ctx(req);
    const accounts = await accessibleAccounts(ctrCd, emplNo);
    const accountIds = accounts.map((a) => a.ID);
    const folder = String(DATA.FOLDER || "INBOX").toUpperCase();
    const limit = Math.min(Math.max(Number(DATA.LIMIT) || 50, 1), 100);
    const since = DATA.SINCE?.receivedAt && DATA.SINCE?.id ? DATA.SINCE : null;

    const rows = await msgRepo.listMessagesSince({ accountIds, emplNo, folder, since, limit: limit + 1 });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const unreadTotal = await msgRepo.countUnread({ accountIds, emplNo });

    ok(res, {
      messages: page.map(mapListItem),
      hasMore,
      // Danh sách sắp mới nhất trước ⇒ phần tử đầu là mốc mới nhất để lần sau so tiếp.
      latest: page[0] ? { receivedAt: page[0].RECEIVED_AT, id: page[0].ID } : null,
      unreadTotal,
    });
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
