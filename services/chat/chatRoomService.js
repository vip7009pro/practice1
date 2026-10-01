/**
 * Command handler cho phòng chat & tin nhắn (đi qua POST /api).
 *
 * Quyền (theo yêu cầu nghiệp vụ):
 *  - OWNER   : toàn quyền, có thể chuyển owner, xoá nhóm.
 *  - ADMIN   : sửa nhóm, thêm/xoá thành viên, cấp/thu quyền MODERATOR.
 *  - MODERATOR: xoá tin nhắn của người khác, mời/loại MEMBER.
 *  - MEMBER  : gửi/sửa/xoá tin của mình, rời nhóm.
 *  - OWNER muốn rời nhóm BẮT BUỘC phải chuyển owner cho người khác trước.
 */
const repo = require("./chatRepository");
const core = require("./chatMessageCore");
const { fetchLinkPreview } = require("./linkPreview");
const { pushOfflineChat } = require("./chatPush");
const { emitToConversation, emitToUsers } = require("../../socket/socketHandler");
const { getOnlineEmplNos } = require("../../socket/presence");

const MAX_GROUP_MEMBERS =
  parseInt(process.env.CHAT_MAX_GROUP_MEMBERS || "0", 10) || 1000;

/**
 * Tài khoản được phép "Chọn tất cả" để tạo phòng TOÀN CÔNG TY
 * (lấy hết danh sách nhân sự đang làm việc trong 1 lần gọi).
 * Đổi bằng env `CHAT_SUPER_ADMINS="NHU1903,ABC123"`.
 */
const SUPER_ADMIN_EMPL_NOS = new Set(
  String(process.env.CHAT_SUPER_ADMINS || "NHU1903")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
);

/** Trần số nhân sự lấy về cho chế độ "chọn tất cả" (tránh payload vô hạn). */
const ALL_EMPLOYEES_LIMIT =
  parseInt(process.env.CHAT_ALL_EMPLOYEES_LIMIT || "0", 10) || 5000;

/**
 * Độ lệch múi giờ của MÁY CHỦ so với UTC, tính bằng ms (VN = +7h).
 * Cần vì SQL Server dùng `GETDATE()` (giờ máy chủ) cho các cột DATETIME, nhưng driver mssql
 * cấu hình `useUTC: true` nên khi GHI sẽ lấy thành phần UTC của đối tượng Date.
 * Đổi máy chủ sang múi giờ khác: đặt env `CHAT_SERVER_TZ_OFFSET_HOURS`.
 */
const SERVER_TZ_OFFSET_MS =
  (Number.isFinite(Number(process.env.CHAT_SERVER_TZ_OFFSET_HOURS))
    ? Number(process.env.CHAT_SERVER_TZ_OFFSET_HOURS)
    : 7) * 3600 * 1000;

/**
 * Icon avatar phòng mặc định — PHẢI khớp danh sách ở FE (`chatAvatars.tsx`).
 * Lưu dạng `icon:<id>` để phân biệt với ảnh upload (`/chatavatar/<file>`).
 */
const AVATAR_ICONS = new Set([
  "users",
  "rocket",
  "briefcase",
  "factory",
  "chart",
  "box",
  "tools",
  "shield",
  "star",
  "heart",
  "flag",
  "bolt",
  "wrench",
  "cart",
  "clipboard",
  "megaphone",
]);

/**
 * Chuẩn hoá giá trị avatar phòng.
 * Trả về: chuỗi rỗng (xoá), giá trị hợp lệ, hoặc null (không hợp lệ).
 */
function normalizeAvatar(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const icon = /^icon:([a-z0-9-]+)$/.exec(raw);
  if (icon && AVATAR_ICONS.has(icon[1])) return raw;
  if (/^\/chatavatar\/[A-Za-z0-9._-]+$/.test(raw)) return raw;
  return null;
}

function getCtx(req, DATA) {
  const payload = req.payload_data || {};
  return {
    ctrCd: String(payload.CTR_CD || DATA?.CTR_CD || "").trim(),
    // EMPL_NO trong ZTBEMPLINFO là kiểu char ⇒ bị đệm khoảng trắng, phải trim.
    emplNo: String(payload.EMPL_NO || "").trim().toUpperCase(),
    emplName: [payload.MIDLAST_NAME, payload.FIRST_NAME].filter(Boolean).join(" ").trim(),
  };
}

function ok(res, data) {
  res.send({ tk_status: "OK", data });
}

function fail(res, message, code) {
  res.send({ tk_status: "NG", code, message });
}

function fullName(row) {
  // MIDLAST_NAME trong DB có thể đã có khoảng trắng ở cuối ⇒ gộp nhiều khoảng trắng thành 1.
  return [row.MIDLAST_NAME, row.FIRST_NAME]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hậu tố bộ phận hiển thị kèm tên: ` [Bộ phận]`.
 * Trước đây hiện cả `[Phòng ban chính]-[Bộ phận]`, nay chỉ giữ BỘ PHẬN cho gọn.
 * Trả về chuỗi rỗng khi nhân sự chưa gán bộ phận (không hiện "[]").
 */
function deptSuffix(row) {
  const sub = String(row?.SUBDEPTNAME || "").trim();
  return sub ? ` [${sub}]` : "";
}

function memberView(row) {
  return {
    EMPL_NO: row.EMPL_NO,
    CMS_ID: row.CMS_ID || null,
    FULL_NAME: fullName(row) || row.EMPL_NO,
    EMPL_IMAGE: row.EMPL_IMAGE || "N",
    JOB_NAME: row.JOB_NAME || null,
    MAINDEPTNAME: row.MAINDEPTNAME || null,
    SUBDEPTNAME: row.SUBDEPTNAME || null,
    ROLE: row.ROLE,
    LEFT_AT: row.LEFT_AT || null,
    // Mốc tin nhắn cuối cùng người này đã đọc — FE dùng để đếm/liệt kê "ai đã xem".
    LAST_READ_MESSAGE_ID: Number(row.LAST_READ_MESSAGE_ID) || 0,
  };
}

/** Mốc "không hết hạn" cho lựa chọn tắt thông báo "cho tới khi mở lại phòng". */
const MUTE_UNTIL_OPEN = new Date(Date.UTC(9999, 11, 31));
/** Số giây coi như "vô hạn" (≥ 1 năm) — FE hiểu là chế độ "cho tới khi mở lại". */
const MUTE_UNTIL_OPEN_SECONDS = 365 * 24 * 3600;

/**
 * Mốc thời gian N giây tới, theo GIỜ MÁY CHỦ (giống `GETDATE()`).
 * Driver mssql bật `useUTC` nên khi GHI sẽ lấy thành phần UTC của Date ⇒ phải cộng
 * thêm độ lệch múi giờ VN, nếu không mốc lưu vào DB sẽ bị lùi 7 giờ (hết hạn ngay).
 */
function serverNowPlus(ms) {
  return new Date(Date.now() + SERVER_TZ_OFFSET_MS + ms);
}

/** Chuyển mốc ghim thô thành payload hiển thị ở thanh ghim. */
function pinnedView(row) {
  return {
    MESSAGE_ID: row.MESSAGE_ID,
    SENDER_EMPL_NO: row.SENDER_EMPL_NO,
    MSG_TYPE: row.MSG_TYPE,
    CONTENT: row.DELETED_AT ? null : row.CONTENT,
    CREATED_AT: row.CREATED_AT,
    PINNED_AT: row.PINNED_AT,
    PINNED_BY: row.PINNED_BY,
  };
}

/** Tin nhắn đang ghim của nhiều phòng: Map<conversationId, pinned[]> (ghim mới nhất trước). */
async function loadPinnedByConversation({ conversationIds }) {
  const rows = await repo.listPinnedMessagesForConversations({ conversationIds });
  const map = new Map();
  rows.forEach((row) => {
    const list = map.get(row.CONVERSATION_ID) || [];
    list.push(pinnedView(row));
    map.set(row.CONVERSATION_ID, list);
  });
  return map;
}

/**
 * Ghép dữ liệu phòng + thành viên thành payload hiển thị cho FE.
 *
 * `members` phải là DÒNG THÔ từ `repo.listMembersForConversations` — hàm này tự gọi
 * `memberView` đúng MỘT lần. Trước đây caller đã map sẵn rồi truyền vào và ở đây map lại
 * ⇒ mất `MIDLAST_NAME`/`FIRST_NAME` nên `FULL_NAME` rơi về mã nhân viên (tag tên không ra tên).
 */
function buildConversationView(conversation, members, myEmplNo, pinned = []) {
  const all = (members || []).map(memberView);
  const active = all.filter((m) => !m.LEFT_AT);
  const isSelf = conversation.CONV_TYPE === "SELF";
  const isDirect = conversation.CONV_TYPE === "DIRECT";
  // DIRECT: lấy người còn lại từ TẤT CẢ thành viên (kể cả đang rời) để vẫn hiện đúng
  // tên/avatar khi phòng vừa tạo — phòng rỗng ẩn với đối phương nhưng người tạo vẫn thấy tên.
  const peer = isDirect ? all.find((m) => m.EMPL_NO !== myEmplNo) || null : null;
  const mutedSecondsLeft = Number(conversation.MUTED_SECONDS_LEFT);
  const muted = Number.isFinite(mutedSecondsLeft) && mutedSecondsLeft > 0;

  const displayName = isSelf
    ? conversation.TITLE || "My Files"
    : isDirect
      ? // Chat 1-1: hiện TÊN + phòng ban để biết đồng nghiệp thuộc bộ phận nào.
        (peer && `${peer.FULL_NAME || peer.EMPL_NO}${deptSuffix(peer)}`) || "Hội thoại"
      : conversation.TITLE || active.map((m) => m.FULL_NAME || m.EMPL_NO).join(", ");

  return {
    CONVERSATION_ID: conversation.CONVERSATION_ID,
    CONV_TYPE: conversation.CONV_TYPE,
    TITLE: conversation.TITLE || null,
    AVATAR: conversation.AVATAR || null,
    DISPLAY_NAME: displayName,
    DISPLAY_AVATAR: isSelf
      ? null
      : isDirect
        ? peer && peer.EMPL_IMAGE === "Y"
          ? `/Picture_NS/NS_${peer.EMPL_NO}.jpg`
          : null
        : conversation.AVATAR || null,
    PEER_EMPL_NO: peer ? peer.EMPL_NO : null,
    PEER_ONLINE_KEY: peer ? peer.EMPL_NO : null,
    OWNER_EMPL_NO: conversation.OWNER_EMPL_NO || null,
    MY_ROLE: (all.find((m) => m.EMPL_NO === myEmplNo) || {}).ROLE || "MEMBER",
    MUTED: muted,
    // Số giây còn tắt thông báo (null = đang nhận). ≥ 1 năm ⇒ chế độ "cho tới khi mở lại".
    MUTED_SECONDS_LEFT: muted ? Math.round(mutedSecondsLeft) : null,
    MUTED_UNTIL_OPEN: muted && mutedSecondsLeft >= MUTE_UNTIL_OPEN_SECONDS,
    // Ghim là thuộc tính RIÊNG của từng người (lưu ở participant).
    PINNED_AT: conversation.PINNED_AT || null,
    // Tin nhắn đang ghim của phòng (ghim mới nhất trước) — hiển thị ở thanh dưới header.
    PINNED: pinned || [],
    // Mốc thời gian tạo — FE dùng làm khoá sắp xếp khi phòng chưa có tin nhắn.
    CREATED_AT: conversation.CREATED_AT || null,
    UNREAD_COUNT: Number(conversation.UNREAD_COUNT) || 0,
    LAST_MESSAGE: conversation.LAST_MESSAGE_ID
      ? {
          MESSAGE_ID: conversation.LAST_MESSAGE_ID,
          SENDER_EMPL_NO: conversation.LAST_SENDER,
          MSG_TYPE: conversation.LAST_TYPE,
          CONTENT: conversation.LAST_DELETED_AT ? null : conversation.LAST_CONTENT,
          CREATED_AT: conversation.LAST_CREATED_AT,
          DELETED_AT: conversation.LAST_DELETED_AT || null,
        }
      : null,
    MEMBERS: active,
  };
}

async function loadConversationView({ ctrCd, conversationId, myEmplNo }) {
  const conversation = await repo.getConversationById({ ctrCd, conversationId });
  if (!conversation) return null;
  // Truyền DÒNG THÔ — buildConversationView tự map.
  const members = await repo.listMembersForConversations({
    ctrCd,
    conversationIds: [conversationId],
  });
  const [participant, pinnedMap] = await Promise.all([
    repo.getParticipant({ conversationId, emplNo: myEmplNo }),
    loadPinnedByConversation({ conversationIds: [conversationId] }),
  ]);
  const mutedUntil = participant?.MUTED_UNTIL ? new Date(participant.MUTED_UNTIL) : null;
  // Giới hạn 1 năm cho chế độ "cho tới khi mở lại" (xem MUTE_UNTIL_OPEN_SECONDS).
  const mutedSecondsLeft =
    mutedUntil && mutedUntil.getTime() > Date.now()
      ? Math.min((mutedUntil.getTime() - Date.now()) / 1000, MUTE_UNTIL_OPEN_SECONDS)
      : 0;
  return buildConversationView(
    { ...conversation, UNREAD_COUNT: 0, MUTED_SECONDS_LEFT: mutedSecondsLeft },
    members,
    myEmplNo,
    pinnedMap.get(conversationId) || []
  );
}

async function createConversationWithMembers({
  ctrCd,
  convType,
  title,
  avatar,
  ownerEmplNo,
  memberEmplNos,
  directKey,
}) {
  return repo.withTransaction(async ({ query }) => {
    const inserted = await query(
      `INSERT INTO ZTB_CHAT_CONVERSATION
         (CTR_CD, CONV_TYPE, TITLE, AVATAR, DIRECT_KEY, OWNER_EMPL_NO, CREATED_BY)
       OUTPUT INSERTED.*
       VALUES (@CTR_CD, @CONV_TYPE, @TITLE, @AVATAR, @DIRECT_KEY, @OWNER_EMPL_NO, @CREATED_BY)`,
      {
        CTR_CD: ctrCd,
        CONV_TYPE: convType,
        TITLE: title || null,
        AVATAR: avatar || null,
        DIRECT_KEY: directKey || null,
        OWNER_EMPL_NO: ownerEmplNo,
        CREATED_BY: ownerEmplNo,
      }
    );

    const conversation = inserted.recordset[0];
    const unique = [...new Set(memberEmplNos.map((v) => String(v).trim().toUpperCase()).filter(Boolean))];

    for (const emplNo of unique) {
      // DIRECT vừa tạo chưa có tin ⇒ ẩn phòng với ĐỐI PHƯƠNG (chỉ người tạo thấy),
      // cho tới khi ai đó gửi tin đầu tiên (repo.startConversation mở lại cho mọi người).
      const hidden = convType === "DIRECT" && emplNo !== ownerEmplNo ? 1 : 0;
      await query(
        `INSERT INTO ZTB_CHAT_PARTICIPANT (CONVERSATION_ID, EMPL_NO, CTR_CD, ROLE, HIDDEN)
         VALUES (@CONVERSATION_ID, @EMPL_NO, @CTR_CD, @ROLE, @HIDDEN)`,
        {
          CONVERSATION_ID: conversation.CONVERSATION_ID,
          EMPL_NO: emplNo,
          CTR_CD: ctrCd,
          ROLE: emplNo === ownerEmplNo ? "OWNER" : "MEMBER",
          HIDDEN: hidden,
        }
      );
    }

    return conversation;
  });
}

/* ------------------------------------------------------------------ */
/* Commands                                                           */
/* ------------------------------------------------------------------ */

exports.chatBootstrap = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    // Mỗi user luôn có sẵn phòng "My Files" (cloud cá nhân) — tạo nếu chưa có.
    try {
      await repo.ensureSelfConversation({ ctrCd, emplNo });
    } catch (error) {
      console.warn("[chatBootstrap] không tạo được My Files:", error?.message || error);
    }

    const [rows, members, friendRows, requestRows] = await Promise.all([
      repo.listConversations({ ctrCd, emplNo }),
      repo.listMembersForConversations({ ctrCd, conversationIds: [] }),
      repo.listFriends({ ctrCd, emplNo }),
      repo.listFriendRequests({ ctrCd, emplNo }),
    ]);

    const conversationIds = rows.map((r) => r.CONVERSATION_ID);
    const [allMembers, pinnedMap] = await Promise.all([
      repo.listMembersForConversations({ ctrCd, conversationIds }),
      loadPinnedByConversation({ conversationIds }),
    ]);
    const membersByConversation = new Map();
    allMembers.forEach((row) => {
      const list = membersByConversation.get(row.CONVERSATION_ID) || [];
      list.push(row); // dòng thô
      membersByConversation.set(row.CONVERSATION_ID, list);
    });

    const conversations = rows.map((row) =>
      buildConversationView(
        {
          ...row,
          UNREAD_COUNT: row.UNREAD_COUNT,
          LAST_MESSAGE_ID: row.LAST_MESSAGE_ID,
          LAST_SENDER: row.LAST_SENDER,
          LAST_TYPE: row.LAST_TYPE,
          LAST_CONTENT: row.LAST_CONTENT,
          LAST_CREATED_AT: row.LAST_CREATED_AT,
          LAST_DELETED_AT: row.LAST_DELETED_AT,
        },
        membersByConversation.get(row.CONVERSATION_ID) || [],
        emplNo,
        pinnedMap.get(row.CONVERSATION_ID) || []
      )
    );

    ok(res, {
      conversations,
      unreadTotal: conversations.reduce((sum, c) => sum + c.UNREAD_COUNT, 0),
      // Danh sách đang online để FE hiển thị đúng trạng thái ngay khi mở panel.
      onlineEmplNos: getOnlineEmplNos(),
      friends: friendRows.map((f) => ({
        FRIEND_ID: f.FRIEND_ID,
        PARTNER: f.REQUESTER === emplNo ? f.RECIPIENT : f.REQUESTER,
        STATUS: f.STATUS,
      })),
      requests: requestRows.map((f) => ({
        FRIEND_ID: f.FRIEND_ID,
        DIRECTION: f.REQUESTER === emplNo ? "OUTGOING" : "INCOMING",
        PARTNER: f.REQUESTER === emplNo ? f.RECIPIENT : f.REQUESTER,
        STATUS: f.STATUS,
        CREATED_AT: f.CREATED_AT,
      })),
      memberCount: members.length,
    });
  } catch (error) {
    console.error("[chatBootstrap]", error);
    fail(res, "Không tải được dữ liệu chat");
  }
};

exports.chatSync = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    // Bảo đảm phòng "My Files" luôn tồn tại kể cả khi client chỉ gọi chatSync.
    try {
      await repo.ensureSelfConversation({ ctrCd, emplNo });
    } catch (error) {
      console.warn("[chatSync] không tạo được My Files:", error?.message || error);
    }

    const rows = await repo.listConversations({ ctrCd, emplNo });
    const ids = rows.map((r) => r.CONVERSATION_ID);
    const [members, pinnedMap] = await Promise.all([
      repo.listMembersForConversations({ ctrCd, conversationIds: ids }),
      loadPinnedByConversation({ conversationIds: ids }),
    ]);
    const byConversation = new Map();
    members.forEach((row) => {
      const list = byConversation.get(row.CONVERSATION_ID) || [];
      list.push(row); // dòng thô
      byConversation.set(row.CONVERSATION_ID, list);
    });

    const conversations = rows.map((row) =>
      buildConversationView(
        row,
        byConversation.get(row.CONVERSATION_ID) || [],
        emplNo,
        pinnedMap.get(row.CONVERSATION_ID) || []
      )
    );
    ok(res, {
      conversations,
      unreadTotal: conversations.reduce((sum, c) => sum + c.UNREAD_COUNT, 0),
      onlineEmplNos: getOnlineEmplNos(),
    });
  } catch (error) {
    console.error("[chatSync]", error);
    fail(res, "Không đồng bộ được danh sách phòng");
  }
};

exports.chatSearchEmployees = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    if (!ctrCd) return fail(res, "Thiếu thông tin công ty");

    // `all: true` = lấy TOÀN BỘ nhân sự đang làm việc (nút "Chọn tất cả" khi tạo
    // phòng toàn công ty). Chỉ tài khoản chat quản trị mới được dùng.
    const wantAll =
      DATA?.all === true || String(DATA?.all ?? "").toLowerCase() === "true";
    if (wantAll && !SUPER_ADMIN_EMPL_NOS.has(emplNo)) {
      return fail(res, "Bạn không có quyền chọn tất cả nhân sự");
    }

    const rows = await repo.searchEmployees({
      ctrCd,
      keyword: wantAll ? "" : DATA?.keyword || "",
      limit: wantAll ? ALL_EMPLOYEES_LIMIT : DATA?.limit || 30,
    });
    ok(
      res,
      rows
        .filter((row) => row.EMPL_NO !== emplNo)
        .map((row) => ({
          EMPL_NO: row.EMPL_NO,
          CMS_ID: row.CMS_ID,
          FULL_NAME: fullName(row) || row.EMPL_NO,
          EMPL_IMAGE: row.EMPL_IMAGE || "N",
          JOB_NAME: row.JOB_NAME || null,
          MAINDEPTNAME: row.MAINDEPTNAME || null,
          SUBDEPTNAME: row.SUBDEPTNAME || null,
        }))
    );
  } catch (error) {
    console.error("[chatSearchEmployees]", error);
    fail(res, "Không tìm được nhân viên");
  }
};

exports.chatGetOrCreateDirect = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const other = String(DATA?.otherEmplNo || "").trim().toUpperCase();
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!other || other === emplNo) return fail(res, "Người nhận không hợp lệ");
    if (String(DATA?.CTR_CD || ctrCd) !== String(ctrCd)) {
      // Không cho phép tạo phòng chéo công ty.
      return fail(res, "Không thể tạo hội thoại khác công ty");
    }

    const directKey = repo.buildDirectKey(emplNo, other);
    let conversation = await repo.findDirectConversation({ ctrCd, directKey });
    let changed = false;

    if (!conversation) {
      try {
        conversation = await createConversationWithMembers({
          ctrCd,
          convType: "DIRECT",
          ownerEmplNo: emplNo,
          memberEmplNos: [emplNo, other],
          directKey,
        });
        await repo.writeAudit({
          ctrCd,
          conversationId: conversation.CONVERSATION_ID,
          actor: emplNo,
          action: "DIRECT_CREATED",
          target: other,
        });
        changed = true;
      } catch (error) {
        // Hai client mở chat cùng lúc ⇒ unique index chặn 1 bên; đọc lại dòng đã tồn tại.
        conversation = await repo.findDirectConversation({ ctrCd, directKey });
        if (!conversation) throw error;
      }
    } else if (conversation.DELETED_AT) {
      // Hội thoại cũ đã đóng mềm ⇒ MỞ LẠI, không tạo dòng mới (tránh vi phạm UX_CHAT_CONV_DIRECT).
      await repo.reviveConversation({ conversationId: conversation.CONVERSATION_ID });
      await repo.writeAudit({
        ctrCd,
        conversationId: conversation.CONVERSATION_ID,
        actor: emplNo,
        action: "DIRECT_REVIVED",
        target: other,
      });
      changed = true;
    }

    // Bảo đảm cả 2 phía đang hoạt động (trường hợp trước đó đã rời/đóng).
    const ownerEmplNo = conversation.OWNER_EMPL_NO;
    const hasMessages = Boolean(conversation.LAST_MESSAGE_ID);
    const creator = String(ownerEmplNo || "").trim().toUpperCase();

    // Người gọi luôn HIỆN phòng (họ chủ động mở hội thoại này).
    await repo.ensureParticipant({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      emplNo,
      role: ownerEmplNo === emplNo ? "OWNER" : "MEMBER",
      visible: true,
    });

    // Đối phương:
    //  - Phòng đã có tin, HOẶC chính họ là người tạo ⇒ hiện bình thường.
    //  - Ngược lại (DIRECT mới toanh, chưa gõ gì) ⇒ giữ ẩn, KHÔNG đụng tới để tránh
    //    vô tình ẩn mất phòng với người đã từng mở nó trước đó.
    const showOther = hasMessages || creator === String(other).toUpperCase();
    await repo.ensureParticipant({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      emplNo: other,
      role: ownerEmplNo === other ? "OWNER" : "MEMBER",
      ...(showOther ? { visible: true } : {}),
    });

    const view = await loadConversationView({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      myEmplNo: emplNo,
    });

    if (changed) {
      // Người tạo thấy ngay. Chỉ báo cho đối phương khi phòng đã thực sự "bắt đầu"
      // (đã có tin) — nếu không họ sẽ thấy phòng rỗng nhấp nháy rồi biến mất.
      emitToUsers(hasMessages ? [emplNo, other] : [emplNo], "chat:conversation-updated", {
        conversationId: conversation.CONVERSATION_ID,
        created: true,
      });
    }

    ok(res, view);
  } catch (error) {
    console.error("[chatGetOrCreateDirect]", error);
    fail(res, "Không mở được hội thoại");
  }
};

exports.chatCreateGroup = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const title = String(DATA?.title || "").trim();
    const memberEmplNos = Array.isArray(DATA?.memberEmplNos) ? DATA.memberEmplNos : [];
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!title) return fail(res, "Nhóm phải có tên");
    if (memberEmplNos.length === 0) return fail(res, "Nhóm phải có ít nhất 1 thành viên khác");
    if (memberEmplNos.length + 1 > MAX_GROUP_MEMBERS) return fail(res, "Nhóm vượt quá số thành viên cho phép");

    const avatar = normalizeAvatar(DATA?.avatar);
    if (DATA?.avatar !== undefined && avatar === null) {
      return fail(res, "Avatar nhóm không hợp lệ");
    }

    const conversation = await createConversationWithMembers({
      ctrCd,
      convType: "GROUP",
      title,
      avatar: avatar || null,
      ownerEmplNo: emplNo,
      memberEmplNos: [emplNo, ...memberEmplNos],
    });

    await repo.writeAudit({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      actor: emplNo,
      action: "GROUP_CREATED",
      detail: title,
    });

    const created = await core.sendMessage({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      senderEmplNo: emplNo,
      msgType: "SYSTEM",
      content: `${getCtx(req, DATA).emplName || emplNo} đã tạo nhóm`,
    });

    emitToUsers(
      created.memberNos || [],
      "chat:conversation-updated",
      { conversationId: conversation.CONVERSATION_ID, created: true }
    );

    const view = await loadConversationView({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      myEmplNo: emplNo,
    });
    ok(res, view);
  } catch (error) {
    console.error("[chatCreateGroup]", error);
    fail(res, "Không tạo được nhóm");
  }
};

exports.chatLoadMessages = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) return fail(res, "Phòng chat không hợp lệ");

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền xem phòng chat này");

    const rows = await repo.listMessages({
      conversationId,
      beforeMessageId: DATA?.beforeMessageId,
      limit: DATA?.limit || 40,
      emplNo,
    });
    const messages = await core.enrichMessages(conversationId, rows);
    ok(res, {
      conversationId,
      messages,
      hasMore: rows.length >= Math.min(Number(DATA?.limit) || 40, 100),
    });
  } catch (error) {
    console.error("[chatLoadMessages]", error);
    fail(res, "Không tải được tin nhắn");
  }
};

/**
 * Đồng bộ tin nhắn bị LỠ trong lúc mất kết nối (reconnect).
 *
 * Client gửi `afterMessageId` = MESSAGE_ID lớn nhất nó đã nhận được; server trả về
 * đúng các tin MỚI HƠN theo thứ tự tăng dần. Nhờ vậy khi socket nối lại không phải
 * tải lại cả phòng mà vẫn không mất tin.
 */
exports.chatSyncMessages = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const afterMessageId = Number(DATA?.afterMessageId) || 0;
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return fail(res, "Phòng chat không hợp lệ");
    }

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền xem phòng chat này");

    const limit = Math.min(Math.max(Number(DATA?.limit) || 200, 1), 500);
    const rows = await repo.listMessages({ conversationId, afterMessageId, limit, emplNo });
    const messages = await core.enrichMessages(conversationId, rows);
    ok(res, {
      conversationId,
      afterMessageId,
      messages,
      hasMore: rows.length >= limit,
    });
  } catch (error) {
    console.error("[chatSyncMessages]", error);
    fail(res, "Không đồng bộ được tin nhắn");
  }
};

exports.chatSendMessage = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const result = await core.sendMessage({
      ctrCd,
      conversationId: Number(DATA?.conversationId),
      senderEmplNo: emplNo,
      msgType: DATA?.msgType,
      content: DATA?.content,
      clientMessageId: DATA?.clientMessageId,
      mentions: DATA?.mentions,
      replyToMessageId: DATA?.replyToMessageId,
      attachmentIds: DATA?.attachmentIds,
    });

    if (!result.ok) return fail(res, result.message, result.code);

    const payload = {
      conversationId: Number(DATA?.conversationId),
      message: await core.enrichMessage(Number(DATA?.conversationId), result.message, result.attachments),
    };
    emitToConversation(payload.conversationId, "chat:message", payload);
    // Phát thêm tới room riêng từng thành viên: nếu client gửi qua HTTP (socket không
    // kết nối) thì người nhận vẫn nhận realtime thay vì phải F5.
    emitToUsers(result.memberNos, "chat:message", payload);

    // Push cho thành viên offline — PHẢI có ở đây vì tin nhắn gửi qua HTTP (socket chưa
    // kết nối) trước đây không hề phát push.
    void pushOfflineChat({
      ctrCd,
      memberNos: result.memberNos,
      senderEmplNo: emplNo,
      senderName: getCtx(req, DATA).emplName || emplNo,
      conversationTitle:
        result.conversation?.CONV_TYPE === "GROUP" ? result.conversation?.TITLE : undefined,
      content: payload.message.CONTENT,
      conversationId: payload.conversationId,
      msgType: payload.message.MSG_TYPE,
    });

    ok(res, payload);
  } catch (error) {
    console.error("[chatSendMessage]", error);
    fail(res, "Không gửi được tin nhắn");
  }
};

exports.chatMarkRead = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    const affected = await repo.markRead({
      ctrCd,
      conversationId,
      emplNo,
      lastMessageId: DATA?.lastMessageId,
    });
    if (affected > 0) {
      emitToConversation(conversationId, "chat:read", {
        conversationId,
        emplNo,
        lastMessageId: Number(DATA?.lastMessageId) || 0,
      });
    }
    ok(res, { conversationId, updated: affected });
  } catch (error) {
    console.error("[chatMarkRead]", error);
    fail(res, "Không cập nhật được trạng thái đã đọc");
  }
};

exports.chatDeleteMessage = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const messageId = Number(DATA?.messageId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
      return fail(res, "Tin nhắn không hợp lệ");
    }

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    const allowAny = core.hasRole(membership, "MODERATOR");
    const affected = await repo.softDeleteMessage({
      conversationId,
      messageId,
      actorEmplNo: emplNo,
      allowAny,
    });

    if (affected === 0) return fail(res, "Không thể xoá tin nhắn này");

    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "MESSAGE_DELETED",
      target: String(messageId),
    });

    emitToConversation(conversationId, "chat:message-deleted", { conversationId, messageId });
    ok(res, { conversationId, messageId });
  } catch (error) {
    console.error("[chatDeleteMessage]", error);
    fail(res, "Không xoá được tin nhắn");
  }
};

/**
 * "Xoá phòng chat" theo RIÊNG người dùng hiện tại (KHÁC "rời nhóm").
 * Ẩn toàn bộ lịch sử hiện có; phòng biến mất khỏi danh sách cho tới khi có tin MỚI hơn mốc xoá.
 * Không xoá dữ liệu vật lý, các thành viên khác vẫn thấy bình thường.
 */
exports.chatDeleteConversation = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return fail(res, "Phòng chat không hợp lệ");
    }

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    const clearedBefore = await repo.clearConversationForUser({ ctrCd, conversationId, emplNo });
    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "CONVERSATION_CLEARED",
      target: String(conversationId),
      detail: String(clearedBefore),
    });

    // Chỉ ảnh hưởng người xoá ⇒ phát riêng cho họ (các tab khác của họ cũng xoá).
    emitToUsers([emplNo], "chat:conversation-cleared", { conversationId, clearedBefore });
    ok(res, { conversationId, clearedBefore });
  } catch (error) {
    console.error("[chatDeleteConversation]", error);
    fail(res, "Không xoá được phòng chat");
  }
};

/**
 * Xoá NHIỀU tin nhắn một lượt (từ chế độ chọn nhiều).
 *  - mode "hide"   ⇒ "xoá ở phía tôi": ẩn với riêng người dùng.
 *  - mode "recall" ⇒ thu hồi với cả hai phía (chỉ tin của mình / khi có quyền kiểm duyệt).
 */
exports.chatDeleteMessages = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const messageIds = Array.isArray(DATA?.messageIds)
      ? [
          ...new Set(
            DATA.messageIds
              .map((v) => Number(v))
              .filter((v) => Number.isInteger(v) && v > 0)
          ),
        ]
      : [];
    const mode = String(DATA?.mode || "hide").toLowerCase();
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0 || messageIds.length === 0) {
      return fail(res, "Tin nhắn không hợp lệ");
    }
    if (messageIds.length > 200) return fail(res, "Chọn tối đa 200 tin nhắn mỗi lượt");

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    const allowAny = core.hasRole(membership, "MODERATOR");
    const hidden = [];
    const recalled = [];

    if (mode === "recall") {
      for (const messageId of messageIds) {
        const affected = await repo.softDeleteMessage({
          conversationId,
          messageId,
          actorEmplNo: emplNo,
          allowAny,
        });
        if (affected > 0) recalled.push(messageId);
      }
      if (recalled.length > 0) {
        await repo.writeAudit({
          ctrCd,
          conversationId,
          actor: emplNo,
          action: "MESSAGES_DELETED",
          detail: recalled.join(","),
        });
        const payload = { conversationId, messageIds: recalled };
        emitToConversation(conversationId, "chat:messages-deleted", payload);
        const members = await repo.listActiveMemberNos({ conversationId });
        emitToUsers(members.map((row) => row.EMPL_NO), "chat:messages-deleted", payload);
      }
    } else {
      for (const messageId of messageIds) {
        await repo.hideMessageForUser({ messageId, emplNo });
        hidden.push(messageId);
      }
      if (hidden.length > 0) {
        emitToUsers([emplNo], "chat:messages-hidden", { conversationId, messageIds: hidden });
      }
    }

    ok(res, { conversationId, mode, hidden, recalled });
  } catch (error) {
    console.error("[chatDeleteMessages]", error);
    fail(res, "Không xoá được tin nhắn");
  }
};

/* ------------------------ Cảm xúc / ẩn / chuyển tiếp ------------------------ */

/** Thả hoặc bỏ cảm xúc cho 1 tin nhắn (mỗi người tối đa 1 cảm xúc / tin). */
async function applyReaction({ ctrCd, conversationId, messageId, emplNo, reaction }) {
  const membership = await core.getActiveMembership(conversationId, emplNo);
  if (!membership) return { ok: false, message: "Bạn không có quyền truy cập phòng chat này" };

  const rows = await repo.listMessagesByIds({ conversationId, messageIds: [messageId], emplNo });
  if (!rows || rows.length === 0) return { ok: false, message: "Tin nhắn không tồn tại" };

  const normalized = String(reaction || "").trim().toUpperCase();
  const removed = !normalized || normalized === "NONE";

  if (removed) {
    await repo.removeReaction({ messageId, emplNo });
  } else {
    if (!core.REACTION_TYPES.has(normalized)) return { ok: false, message: "Cảm xúc không hợp lệ" };
    await repo.setReaction({ ctrCd, messageId, emplNo, reaction: normalized });
  }

  const payload = {
    conversationId,
    messageId,
    emplNo,
    reaction: removed ? null : normalized,
    removed,
    // Bản tổng hợp mới nhất để client thay thế nguyên trạng.
    reactions: core.buildReactions(await repo.listReactionsForMessages({ messageIds: [messageId] })),
  };

  // Phát cho người đang mở phòng + room riêng từng thành viên (panel đang đóng vẫn cập nhật).
  const members = await repo.listActiveMemberNos({ conversationId });
  emitToConversation(conversationId, "chat:reaction", payload);
  emitToUsers(members.map((row) => row.EMPL_NO), "chat:reaction", payload);
  return { ok: true, ...payload };
}

exports.chatReact = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const messageId = Number(DATA?.messageId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
      return fail(res, "Tin nhắn không hợp lệ");
    }

    const result = await applyReaction({
      ctrCd,
      conversationId,
      messageId,
      emplNo,
      reaction: DATA?.reaction,
    });
    if (!result.ok) return fail(res, result.message);

    ok(res, result);
  } catch (error) {
    console.error("[chatReact]", error);
    fail(res, "Không thả được cảm xúc");
  }
};

/** "Xoá ở phía tôi": chỉ ẩn với người dùng hiện tại, người khác vẫn thấy. */
exports.chatHideMessage = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const messageId = Number(DATA?.messageId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    await repo.hideMessageForUser({ messageId, emplNo });
    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "MESSAGE_HIDDEN_ONE_SIDE",
      target: String(messageId),
    });

    // Chỉ phát cho chính user này (các tab khác của họ cũng ẩn).
    emitToUsers([emplNo], "chat:message-hidden", { conversationId, messageId });
    ok(res, { conversationId, messageId });
  } catch (error) {
    console.error("[chatHideMessage]", error);
    fail(res, "Không xoá được tin nhắn");
  }
};

/** Chuyển tiếp 1 tin nhắn sang một hoặc nhiều phòng khác. */
exports.chatForward = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo, emplName } = getCtx(req, DATA);
    const sourceConversationId = Number(DATA?.conversationId);
    const messageId = Number(DATA?.messageId);
    const targets = Array.isArray(DATA?.targetConversationIds)
      ? DATA.targetConversationIds.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0)
      : [];

    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(messageId) || targets.length === 0) {
      return fail(res, "Thiếu thông tin chuyển tiếp");
    }

    const sourceMembership = await core.getActiveMembership(sourceConversationId, emplNo);
    if (!sourceMembership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    const [sourceRows, sourceAttachments] = await Promise.all([
      repo.listMessagesByIds({ conversationId: sourceConversationId, messageIds: [messageId], emplNo }),
      repo.listAttachmentsByMessageIds({ conversationId: sourceConversationId, messageIds: [messageId] }),
    ]);

    const source = sourceRows && sourceRows[0];
    if (!source) return fail(res, "Tin nhắn nguồn không tồn tại");

    const forwarded = [];
    for (const targetId of [...new Set(targets)]) {
      const targetMembership = await core.getActiveMembership(targetId, emplNo);
      if (!targetMembership) continue;

      // Nhân bản đính kèm sang phòng đích (dùng lại file vật lý, không copy file).
      const clonedIds = await repo.cloneAttachments({
        attachmentIds: sourceAttachments.map((row) => row.ATTACHMENT_ID),
        targetConversationId: targetId,
        ctrCd,
        emplNo,
      });

      const result = await core.sendMessage({
        ctrCd,
        conversationId: targetId,
        senderEmplNo: emplNo,
        msgType: source.MSG_TYPE === "SYSTEM" ? "TEXT" : source.MSG_TYPE,
        content: source.CONTENT,
        attachmentIds: clonedIds,
        forwardedFromMessageId: messageId,
      });

      if (!result.ok) continue;

      const payload = {
        conversationId: targetId,
        message: await core.enrichMessage(targetId, result.message, result.attachments),
      };
      emitToConversation(targetId, "chat:message", payload);
      emitToUsers(result.memberNos, "chat:message", payload);

      void pushOfflineChat({
        ctrCd,
        memberNos: result.memberNos,
        senderEmplNo: emplNo,
        senderName: emplName || emplNo,
        conversationTitle:
          result.conversation?.CONV_TYPE === "GROUP" ? result.conversation?.TITLE : undefined,
        content: payload.message.CONTENT,
        conversationId: targetId,
        msgType: payload.message.MSG_TYPE,
      });

      forwarded.push(targetId);
    }

    if (forwarded.length === 0) return fail(res, "Không chuyển tiếp được tới phòng nào");

    await repo.writeAudit({
      ctrCd,
      conversationId: sourceConversationId,
      actor: emplNo,
      action: "MESSAGE_FORWARDED",
      target: String(messageId),
      detail: forwarded.join(","),
    });

    ok(res, { messageId, forwarded });
  } catch (error) {
    console.error("[chatForward]", error);
    fail(res, "Không chuyển tiếp được tin nhắn");
  }
};

/* ------------------------------ Thành viên ------------------------- */
async function assertManager({ conversationId, emplNo }) {
  const membership = await core.getActiveMembership(conversationId, emplNo);
  if (!membership) return { error: "Bạn không có quyền truy cập phòng chat này" };
  if (!core.hasRole(membership, "ADMIN")) {
    return { error: "Chỉ quản trị nhóm mới thực hiện được thao tác này" };
  }
  return { membership };
}

exports.chatAddMembers = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const memberEmplNos = Array.isArray(DATA?.memberEmplNos) ? DATA.memberEmplNos : [];
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (memberEmplNos.length === 0) return fail(res, "Chưa chọn thành viên");

    const conversation = await repo.getConversationById({ ctrCd, conversationId });
    if (!conversation) return fail(res, "Phòng chat không tồn tại");
    if (conversation.CONV_TYPE === "DIRECT") return fail(res, "Hội thoại 1-1 không thêm được thành viên");

    const guard = await assertManager({ conversationId, emplNo });
    if (guard.error) return fail(res, guard.error);

    const active = await repo.listActiveMemberNos({ conversationId });
    if (active.length + memberEmplNos.length > MAX_GROUP_MEMBERS) {
      return fail(res, "Nhóm vượt quá số thành viên cho phép");
    }

    for (const target of memberEmplNos) {
      const clean = String(target).trim().toUpperCase();
      if (!clean) continue;
      await repo.withTransaction(async ({ query }) => {
        await query(
          `IF EXISTS (SELECT 1 FROM ZTB_CHAT_PARTICIPANT WHERE CONVERSATION_ID=@CONVERSATION_ID AND EMPL_NO=@EMPL_NO)
             UPDATE ZTB_CHAT_PARTICIPANT SET LEFT_AT = NULL, JOINED_AT = GETDATE()
             WHERE CONVERSATION_ID=@CONVERSATION_ID AND EMPL_NO=@EMPL_NO
           ELSE
             INSERT INTO ZTB_CHAT_PARTICIPANT (CONVERSATION_ID, EMPL_NO, CTR_CD, ROLE)
             VALUES (@CONVERSATION_ID, @EMPL_NO, @CTR_CD, 'MEMBER')`,
          { CONVERSATION_ID: conversationId, EMPL_NO: clean, CTR_CD: ctrCd }
        );
      });
    }

    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "MEMBER_ADDED",
      detail: memberEmplNos.join(","),
    });

    emitToUsers(memberEmplNos, "chat:conversation-updated", { conversationId, added: true });
    emitToConversation(conversationId, "chat:members-changed", { conversationId });

    const view = await loadConversationView({ ctrCd, conversationId, myEmplNo: emplNo });
    ok(res, view);
  } catch (error) {
    console.error("[chatAddMembers]", error);
    fail(res, "Không thêm được thành viên");
  }
};

exports.chatRemoveMember = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const target = String(DATA?.emplNo || "").trim().toUpperCase();
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!target || target === emplNo) return fail(res, "Thành viên không hợp lệ");

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");
    if (!core.hasRole(membership, "MODERATOR")) return fail(res, "Bạn không có quyền xoá thành viên");

    const targetMembership = await core.getActiveMembership(conversationId, target);
    if (!targetMembership) return fail(res, "Thành viên không còn trong nhóm");
    if (targetMembership.ROLE === "OWNER") return fail(res, "Không thể xoá chủ nhóm");
    if (!core.hasRole(membership, "ADMIN") && targetMembership.ROLE !== "MEMBER") {
      return fail(res, "Moderator chỉ có thể xoá thành viên thường");
    }

    await repo.withTransaction(async ({ query }) => {
      await query(
        `UPDATE ZTB_CHAT_PARTICIPANT SET LEFT_AT = GETDATE(), ROLE = 'MEMBER'
         WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @EMPL_NO`,
        { CONVERSATION_ID: conversationId, EMPL_NO: target }
      );
    });

    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "MEMBER_REMOVED",
      target,
    });

    emitToUsers([target], "chat:conversation-removed", { conversationId });
    emitToConversation(conversationId, "chat:members-changed", { conversationId });
    ok(res, { conversationId, emplNo: target });
  } catch (error) {
    console.error("[chatRemoveMember]", error);
    fail(res, "Không xoá được thành viên");
  }
};

exports.chatSetRole = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const target = String(DATA?.emplNo || "").trim().toUpperCase();
    const role = String(DATA?.role || "").trim().toUpperCase();
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!["MODERATOR", "MEMBER"].includes(role)) return fail(res, "Vai trò không hợp lệ");

    const guard = await assertManager({ conversationId, emplNo });
    if (guard.error) return fail(res, guard.error);

    const targetMembership = await core.getActiveMembership(conversationId, target);
    if (!targetMembership) return fail(res, "Thành viên không còn trong nhóm");
    if (targetMembership.ROLE === "OWNER") return fail(res, "Không thể đổi vai trò của chủ nhóm");

    await repo.withTransaction(async ({ query }) => {
      await query(
        `UPDATE ZTB_CHAT_PARTICIPANT SET ROLE = @ROLE
         WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @EMPL_NO`,
        { ROLE: role, CONVERSATION_ID: conversationId, EMPL_NO: target }
      );
    });

    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "ROLE_CHANGED",
      target,
      detail: role,
    });

    emitToUsers([target], "chat:conversation-updated", { conversationId, roleChanged: true });
    emitToConversation(conversationId, "chat:members-changed", { conversationId });
    ok(res, { conversationId, emplNo: target, role });
  } catch (error) {
    console.error("[chatSetRole]", error);
    fail(res, "Không đổi được vai trò");
  }
};

exports.chatTransferOwner = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const newOwner = String(DATA?.newOwnerEmplNo || "").trim().toUpperCase();
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const conversation = await repo.getConversationById({ ctrCd, conversationId });
    if (!conversation) return fail(res, "Phòng chat không tồn tại");
    if (conversation.CONV_TYPE !== "GROUP") return fail(res, "Chỉ nhóm mới chuyển được chủ nhóm");
    if (conversation.OWNER_EMPL_NO !== emplNo) return fail(res, "Chỉ chủ nhóm mới chuyển được quyền");

    const targetMembership = await core.getActiveMembership(conversationId, newOwner);
    if (!targetMembership) return fail(res, "Người nhận không còn trong nhóm");
    if (newOwner === emplNo) return fail(res, "Bạn đang là chủ nhóm");

    await repo.withTransaction(async ({ query }) => {
      await query(
        `UPDATE ZTB_CHAT_PARTICIPANT SET ROLE = 'OWNER'
         WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @NEW_OWNER`,
        { CONVERSATION_ID: conversationId, NEW_OWNER: newOwner }
      );
      await query(
        `UPDATE ZTB_CHAT_PARTICIPANT SET ROLE = 'ADMIN'
         WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @OLD_OWNER`,
        { CONVERSATION_ID: conversationId, OLD_OWNER: emplNo }
      );
      await query(
        `UPDATE ZTB_CHAT_CONVERSATION SET OWNER_EMPL_NO = @NEW_OWNER, UPDATED_AT = GETDATE()
         WHERE CONVERSATION_ID = @CONVERSATION_ID`,
        { CONVERSATION_ID: conversationId, NEW_OWNER: newOwner }
      );
    });

    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "OWNER_TRANSFERRED",
      target: newOwner,
    });

    emitToConversation(conversationId, "chat:members-changed", { conversationId });
    emitToUsers([newOwner], "chat:conversation-updated", { conversationId, ownerChanged: true });
    ok(res, { conversationId, newOwnerEmplNo: newOwner });
  } catch (error) {
    console.error("[chatTransferOwner]", error);
    fail(res, "Không chuyển được quyền chủ nhóm");
  }
};

exports.chatLeaveGroup = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const conversation = await repo.getConversationById({ ctrCd, conversationId });
    if (!conversation) return fail(res, "Phòng chat không tồn tại");

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không còn trong phòng chat này");

    const active = await repo.listActiveMemberNos({ conversationId });

    // Chủ nhóm phải chỉ định người kế nhiệm trước khi rời (yêu cầu nghiệp vụ).
    if (conversation.CONV_TYPE === "GROUP" && conversation.OWNER_EMPL_NO === emplNo) {
      if (active.length > 1) {
        return fail(
          res,
          "Bạn là chủ nhóm — hãy chuyển quyền chủ nhóm cho người khác trước khi rời",
          "NEED_TRANSFER"
        );
      }
    }

    // Thông báo hệ thống phải tạo TRƯỚC khi đánh dấu rời — sau đó người gửi không còn
    // là thành viên nên `core.sendMessage` sẽ từ chối (FORBIDDEN) và tin báo không hiện.
    const systemMsg = await core.sendMessage({
      ctrCd,
      conversationId,
      senderEmplNo: emplNo,
      msgType: "SYSTEM",
      content: `${getCtx(req, DATA).emplName || emplNo} ${
        conversation.CONV_TYPE === "GROUP" ? "đã rời nhóm" : "đã rời hội thoại"
      }`,
    });

    await repo.withTransaction(async ({ query }) => {
      await query(
        `UPDATE ZTB_CHAT_PARTICIPANT SET LEFT_AT = GETDATE(), ROLE = 'MEMBER'
         WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @EMPL_NO`,
        { CONVERSATION_ID: conversationId, EMPL_NO: emplNo }
      );
      // Nhóm rỗng ⇒ đóng mềm, KHÔNG xoá vật lý (DIRECT vẫn giữ cho bên còn lại).
      if (active.length <= 1 && conversation.CONV_TYPE === "GROUP") {
        await query(
          `UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @CONVERSATION_ID`,
          { CONVERSATION_ID: conversationId }
        );
      }
    });

    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "MEMBER_LEFT",
    });

    if (systemMsg.ok) {
      emitToConversation(conversationId, "chat:message", {
        conversationId,
        message: core.toClientMessage(systemMsg.message),
      });
    }
    emitToUsers([emplNo], "chat:conversation-removed", { conversationId });
    emitToConversation(conversationId, "chat:members-changed", { conversationId });

    ok(res, { conversationId });
  } catch (error) {
    console.error("[chatLeaveGroup]", error);
    fail(res, "Không rời được nhóm");
  }
};

exports.chatUpdateGroup = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const conversation = await repo.getConversationById({ ctrCd, conversationId });
    if (!conversation) return fail(res, "Phòng chat không tồn tại");
    if (conversation.CONV_TYPE !== "GROUP") return fail(res, "Chỉ nhóm mới đổi được thông tin");

    const guard = await assertManager({ conversationId, emplNo });
    if (guard.error) return fail(res, guard.error);

    const title = DATA?.title !== undefined ? String(DATA.title).trim() : undefined;
    if (title !== undefined && !title) return fail(res, "Tên nhóm không được để trống");

    // undefined = không đổi; "" = xoá avatar; ngược lại phải là icon mặc định hoặc ảnh upload.
    const avatar = DATA?.avatar === undefined ? undefined : normalizeAvatar(DATA.avatar);
    if (avatar === null) return fail(res, "Avatar nhóm không hợp lệ");

    await repo.withTransaction(async ({ query }) => {
      await query(
        `UPDATE ZTB_CHAT_CONVERSATION
         SET TITLE = CASE WHEN @TITLE IS NULL THEN TITLE ELSE @TITLE END,
             AVATAR = CASE
                        WHEN @CLEAR_AVATAR = 1 THEN NULL
                        WHEN @AVATAR IS NULL THEN AVATAR
                        ELSE @AVATAR END,
             UPDATED_AT = GETDATE()
         WHERE CONVERSATION_ID = @CONVERSATION_ID`,
        {
          TITLE: title === undefined ? null : title,
          AVATAR: !avatar ? null : avatar,
          CLEAR_AVATAR: avatar === "" ? 1 : 0,
          CONVERSATION_ID: conversationId,
        }
      );
    });

    await repo.writeAudit({
      ctrCd,
      conversationId,
      actor: emplNo,
      action: "GROUP_UPDATED",
      detail: title || "",
    });

    emitToConversation(conversationId, "chat:conversation-updated", { conversationId, updated: true });
    const view = await loadConversationView({ ctrCd, conversationId, myEmplNo: emplNo });
    ok(res, view);
  } catch (error) {
    console.error("[chatUpdateGroup]", error);
    fail(res, "Không cập nhật được nhóm");
  }
};

/**
 * Ghim / bỏ ghim cuộc trò chuyện cho RIÊNG người dùng hiện tại.
 * Ghim là tuỳ chọn cá nhân (không ảnh hưởng người khác trong phòng) nên KHÔNG phát socket.
 */
exports.chatPinConversation = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return fail(res, "Phòng chat không hợp lệ");
    }

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không thuộc phòng chat này");

    // Mặc định ghim; client gửi pinned=false để bỏ ghim.
    const pinned = DATA?.pinned === undefined ? true : Boolean(DATA.pinned);
    const row = await repo.setConversationPinned({ ctrCd, conversationId, emplNo, pinned });
    if (!row) return fail(res, "Không ghim được cuộc trò chuyện");

    ok(res, { conversationId, pinned, pinnedAt: row.PINNED_AT || null });
  } catch (error) {
    console.error("[chatPinConversation]", error);
    fail(res, "Không ghim được cuộc trò chuyện");
  }
};

/**
 * Ghim / bỏ ghim 1 TIN NHẮN trong phòng (ghim chung — mọi thành viên đều thấy).
 * Phát `chat:pinned` để các client khác cập nhật thanh ghim ngay.
 */
exports.chatPinMessage = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    const messageId = Number(DATA?.messageId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return fail(res, "Phòng chat không hợp lệ");
    }
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return fail(res, "Tin nhắn không hợp lệ");
    }

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không thuộc phòng chat này");

    // Mặc định ghim; client gửi pinned=false để bỏ ghim.
    const pinned = DATA?.pinned === undefined ? true : Boolean(DATA.pinned);
    const row = await repo.setMessagePinned({ conversationId, messageId, emplNo, pinned });
    if (!row) return fail(res, "Không ghim được tin nhắn (tin đã bị thu hồi?)");

    const event = {
      conversationId,
      messageId,
      pinned,
      pinnedBy: emplNo,
      pinnedAt: row.PINNED_AT || null,
    };
    emitToConversation(conversationId, "chat:pinned", event);
    // Client có thể chưa join room phòng ⇒ phát thêm vào room riêng từng thành viên.
    const members = await repo.listActiveMemberNos(conversationId);
    emitToUsers(
      members.map((m) => m.EMPL_NO),
      "chat:pinned",
      event
    );

    ok(res, event);
  } catch (error) {
    console.error("[chatPinMessage]", error);
    fail(res, "Không ghim được tin nhắn");
  }
};

/**
 * Tắt/bật thông báo cho RIÊNG người dùng hiện tại ở 1 phòng.
 * `mode`: "off" (bật lại) | "minutes" (kèm `minutes`) | "untilOpen" (tới khi mở lại phòng).
 * Đây là tuỳ chọn cá nhân ⇒ KHÔNG phát socket cho người khác.
 */
exports.chatSetConversationMute = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return fail(res, "Phòng chat không hợp lệ");
    }

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không thuộc phòng chat này");

    const mode = String(DATA?.mode || "").trim();
    let mutedUntil = null;
    let muteSecondsLeft = null;
    if (mode === "untilOpen") {
      mutedUntil = MUTE_UNTIL_OPEN;
      muteSecondsLeft = MUTE_UNTIL_OPEN_SECONDS;
    } else if (mode === "minutes") {
      const minutes = Number(DATA?.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0) return fail(res, "Thời gian không hợp lệ");
      // Trần 30 ngày cho 1 lần chọn.
      const capped = Math.min(minutes, 60 * 24 * 30);
      mutedUntil = serverNowPlus(capped * 60_000);
      muteSecondsLeft = Math.round(capped * 60);
    } else if (mode !== "off") {
      return fail(res, "Chế độ tắt thông báo không hợp lệ");
    }

    const row = await repo.setConversationMute({ ctrCd, conversationId, emplNo, mutedUntil });
    if (!row) return fail(res, "Không cập nhật được trạng thái thông báo");

    ok(res, {
      conversationId,
      muted: Boolean(mutedUntil),
      mutedUntilOpen: mode === "untilOpen",
      mutedSecondsLeft: muteSecondsLeft,
    });
  } catch (error) {
    console.error("[chatSetConversationMute]", error);
    fail(res, "Không cập nhật được trạng thái thông báo");
  }
};

/**
 * Lấy metadata (Open Graph) của một liên kết để FE hiển thị "link preview" trong chat.
 * Phải chạy ở SERVER vì trình duyệt bị chặn CORS khi đọc HTML của trang khác.
 * Xem `linkPreview.js` để biết các chốt chặn SSRF.
 */
exports.chatLinkPreview = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    const url = String(DATA?.url || "").trim();
    if (!url) return fail(res, "Thiếu liên kết");
    const preview = await fetchLinkPreview(url);
    ok(res, preview);
  } catch (error) {
    console.warn("[chatLinkPreview]", error?.message || error);
    fail(res, "Không lấy được thông tin liên kết");
  }
};

/* ------------------------------------------------------------------ */
/* Tìm kiếm & media                                                   */
/* ------------------------------------------------------------------ */

/** Gắn thêm thông tin phòng + tệp đính kèm cho kết quả tìm kiếm. */
async function decorateSearchRows({ ctrCd, emplNo, rows }) {
  if (rows.length === 0) return [];
  const conversationIds = [...new Set(rows.map((r) => r.CONVERSATION_ID))];
  const members = await repo.listMembersForConversations({ ctrCd, conversationIds });
  const byConversation = new Map();
  members.forEach((row) => {
    const list = byConversation.get(row.CONVERSATION_ID) || [];
    list.push(row); // dòng thô
    byConversation.set(row.CONVERSATION_ID, list);
  });

  const attachmentsByMessage = new Map();
  for (const conversationId of conversationIds) {
    const ids = rows.filter((r) => r.CONVERSATION_ID === conversationId).map((r) => r.MESSAGE_ID);
    const attachments = await repo.listAttachmentsByMessageIds({ conversationId, messageIds: ids });
    attachments.forEach((a) => {
      const list = attachmentsByMessage.get(a.MESSAGE_ID) || [];
      list.push({
        attachmentId: a.ATTACHMENT_ID,
        originalName: a.ORIGINAL_NAME,
        mimeType: a.MIME_TYPE,
        fileSize: a.FILE_SIZE,
      });
      attachmentsByMessage.set(a.MESSAGE_ID, list);
    });
  }

  return rows.map((row) => {
    const conversation = buildConversationView(
      {
        CONVERSATION_ID: row.CONVERSATION_ID,
        CONV_TYPE: row.CONV_TYPE,
        TITLE: null,
        UNREAD_COUNT: 0,
      },
      byConversation.get(row.CONVERSATION_ID) || [],
      emplNo
    );
    return {
      MESSAGE_ID: row.MESSAGE_ID,
      CONVERSATION_ID: row.CONVERSATION_ID,
      SENDER_EMPL_NO: row.SENDER_EMPL_NO,
      MSG_TYPE: row.MSG_TYPE,
      CONTENT: row.DELETED_AT ? null : row.CONTENT,
      CREATED_AT: row.CREATED_AT,
      DELETED_AT: row.DELETED_AT || null,
      ATTACHMENTS: attachmentsByMessage.get(row.MESSAGE_ID) || [],
      CONVERSATION_NAME: conversation.DISPLAY_NAME,
      CONVERSATION_TYPE: conversation.CONV_TYPE,
      CONVERSATION_PEER: conversation.PEER_EMPL_NO,
    };
  });
}

/** Tìm tin nhắn/tệp: trong 1 phòng (conversationId) hoặc toàn cục (bỏ trống). */
exports.chatSearchMessages = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const conversationId = Number(DATA?.conversationId);
    const scoped = Number.isInteger(conversationId) && conversationId > 0;
    if (scoped) {
      const membership = await core.getActiveMembership(conversationId, emplNo);
      if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");
    }

    const rows = await repo.searchMessages({
      ctrCd,
      emplNo,
      conversationId: scoped ? conversationId : undefined,
      keyword: DATA?.keyword,
      senderEmplNo: DATA?.senderEmplNo,
      fromDate: DATA?.fromDate,
      toDate: DATA?.toDate,
      fileKind: DATA?.fileKind,
      onlyWithFiles: Boolean(DATA?.onlyWithFiles),
      hasLink: Boolean(DATA?.hasLink),
      beforeMessageId: DATA?.beforeMessageId,
      limit: DATA?.limit,
    });

    const results = await decorateSearchRows({ ctrCd, emplNo, rows });
    ok(res, { results, hasMore: rows.length >= Math.min(Math.max(Number(DATA?.limit) || 30, 1), 100) });
  } catch (error) {
    console.error("[chatSearchMessages]", error);
    fail(res, "Không tìm kiếm được tin nhắn");
  }
};

/** Danh sách media/tệp của 1 phòng cho cửa sổ "Xem media". */
exports.chatListMedia = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return fail(res, "Phòng chat không hợp lệ");
    }

    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    const limit = Math.min(Math.max(Number(DATA?.limit) || 60, 1), 200);
    const rows = await repo.listConversationMedia({
      conversationId,
      emplNo,
      fileKind: DATA?.fileKind,
      keyword: DATA?.keyword,
      senderEmplNo: DATA?.senderEmplNo,
      fromDate: DATA?.fromDate,
      toDate: DATA?.toDate,
      beforeAttachmentId: DATA?.beforeAttachmentId,
      limit,
    });

    const storage = await repo.getConversationStorage({ conversationId });

    ok(res, {
      items: rows.map((row) => ({
        attachmentId: row.ATTACHMENT_ID,
        messageId: row.MESSAGE_ID,
        originalName: row.ORIGINAL_NAME,
        mimeType: row.MIME_TYPE,
        fileSize: row.FILE_SIZE,
        senderEmplNo: row.SENDER_EMPL_NO,
        createdAt: row.CREATED_AT,
      })),
      hasMore: rows.length >= limit,
      storage,
    });
  } catch (error) {
    console.error("[chatListMedia]", error);
    fail(res, "Không tải được danh sách media");
  }
};

/** Dung lượng đã dùng của 1 phòng (dùng cho My Files). */
exports.chatConversationStorage = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const conversationId = Number(DATA?.conversationId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return fail(res, "Phòng chat không hợp lệ");
    }
    const membership = await core.getActiveMembership(conversationId, emplNo);
    if (!membership) return fail(res, "Bạn không có quyền truy cập phòng chat này");

    ok(res, await repo.getConversationStorage({ conversationId }));
  } catch (error) {
    console.error("[chatConversationStorage]", error);
    fail(res, "Không lấy được dung lượng");
  }
};
