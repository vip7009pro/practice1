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
const { emitToConversation, emitToUsers } = require("../../socket/socketHandler");

const MAX_GROUP_MEMBERS = 200;

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
  return [row.MIDLAST_NAME, row.FIRST_NAME].filter(Boolean).join(" ").trim();
}

function memberView(row) {
  return {
    EMPL_NO: row.EMPL_NO,
    CMS_ID: row.CMS_ID || null,
    FULL_NAME: fullName(row) || row.EMPL_NO,
    EMPL_IMAGE: row.EMPL_IMAGE || "N",
    JOB_NAME: row.JOB_NAME || null,
    ROLE: row.ROLE,
    LEFT_AT: row.LEFT_AT || null,
  };
}

/** Ghép dữ liệu phòng + thành viên thành payload hiển thị cho FE. */
function buildConversationView(conversation, members, myEmplNo) {
  const active = members.filter((m) => !m.LEFT_AT);
  const others = active.filter((m) => m.EMPL_NO !== myEmplNo);
  const isDirect = conversation.CONV_TYPE === "DIRECT";
  const peer = isDirect ? others[0] : null;

  const displayName = isDirect
    ? (peer && (peer.FULL_NAME || peer.EMPL_NO)) || "Hội thoại"
    : conversation.TITLE || active.map((m) => m.FULL_NAME || m.EMPL_NO).join(", ");

  return {
    CONVERSATION_ID: conversation.CONVERSATION_ID,
    CONV_TYPE: conversation.CONV_TYPE,
    TITLE: conversation.TITLE || null,
    AVATAR: conversation.AVATAR || null,
    DISPLAY_NAME: displayName,
    DISPLAY_AVATAR: isDirect && peer && peer.EMPL_IMAGE === "Y" ? `/Picture_NS/NS_${peer.EMPL_NO}.jpg` : null,
    PEER_EMPL_NO: peer ? peer.EMPL_NO : null,
    PEER_ONLINE_KEY: peer ? peer.EMPL_NO : null,
    OWNER_EMPL_NO: conversation.OWNER_EMPL_NO || null,
    MY_ROLE: (members.find((m) => m.EMPL_NO === myEmplNo) || {}).ROLE || "MEMBER",
    MUTED: Boolean(conversation.MUTED),
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
    MEMBERS: active.map(memberView),
  };
}

async function loadConversationView({ ctrCd, conversationId, myEmplNo }) {
  const conversation = await repo.getConversationById({ ctrCd, conversationId });
  if (!conversation) return null;
  const members = (await repo.listMembersForConversations({
    ctrCd,
    conversationIds: [conversationId],
  })).map(memberView);
  return buildConversationView({ ...conversation, UNREAD_COUNT: 0 }, members, myEmplNo);
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
      await query(
        `INSERT INTO ZTB_CHAT_PARTICIPANT (CONVERSATION_ID, EMPL_NO, CTR_CD, ROLE)
         VALUES (@CONVERSATION_ID, @EMPL_NO, @CTR_CD, @ROLE)`,
        {
          CONVERSATION_ID: conversation.CONVERSATION_ID,
          EMPL_NO: emplNo,
          CTR_CD: ctrCd,
          ROLE: emplNo === ownerEmplNo ? "OWNER" : "MEMBER",
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

    const [rows, members, friendRows, requestRows] = await Promise.all([
      repo.listConversations({ ctrCd, emplNo }),
      repo.listMembersForConversations({ ctrCd, conversationIds: [] }),
      repo.listFriends({ ctrCd, emplNo }),
      repo.listFriendRequests({ ctrCd, emplNo }),
    ]);

    const conversationIds = rows.map((r) => r.CONVERSATION_ID);
    const allMembers = await repo.listMembersForConversations({ ctrCd, conversationIds });
    const membersByConversation = new Map();
    allMembers.forEach((row) => {
      const list = membersByConversation.get(row.CONVERSATION_ID) || [];
      list.push(memberView(row));
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
        emplNo
      )
    );

    ok(res, {
      conversations,
      unreadTotal: conversations.reduce((sum, c) => sum + c.UNREAD_COUNT, 0),
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

    const rows = await repo.listConversations({ ctrCd, emplNo });
    const ids = rows.map((r) => r.CONVERSATION_ID);
    const members = await repo.listMembersForConversations({ ctrCd, conversationIds: ids });
    const byConversation = new Map();
    members.forEach((row) => {
      const list = byConversation.get(row.CONVERSATION_ID) || [];
      list.push(memberView(row));
      byConversation.set(row.CONVERSATION_ID, list);
    });

    const conversations = rows.map((row) =>
      buildConversationView(row, byConversation.get(row.CONVERSATION_ID) || [], emplNo)
    );
    ok(res, {
      conversations,
      unreadTotal: conversations.reduce((sum, c) => sum + c.UNREAD_COUNT, 0),
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
    const rows = await repo.searchEmployees({
      ctrCd,
      keyword: DATA?.keyword || "",
      limit: DATA?.limit || 30,
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
    await repo.ensureParticipant({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      emplNo,
      role: ownerEmplNo === emplNo ? "OWNER" : "MEMBER",
    });
    await repo.ensureParticipant({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      emplNo: other,
      role: ownerEmplNo === other ? "OWNER" : "MEMBER",
    });

    const view = await loadConversationView({
      ctrCd,
      conversationId: conversation.CONVERSATION_ID,
      myEmplNo: emplNo,
    });

    if (changed) {
      // Cả 2 phía cần biết phòng mới/được mở lại để hiển thị ngay.
      emitToUsers([emplNo, other], "chat:conversation-updated", {
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

    const conversation = await createConversationWithMembers({
      ctrCd,
      convType: "GROUP",
      title,
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
    });
    const enriched = await core.attachFiles(conversationId, rows);
    ok(res, {
      conversationId,
      messages: enriched.map((row) => core.toClientMessage(row, row.ATTACHMENTS || [])),
      hasMore: rows.length >= Math.min(Number(DATA?.limit) || 40, 100),
    });
  } catch (error) {
    console.error("[chatLoadMessages]", error);
    fail(res, "Không tải được tin nhắn");
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
      message: core.toClientMessage(result.message),
    };
    emitToConversation(payload.conversationId, "chat:message", payload);
    // Phát thêm tới room riêng từng thành viên: nếu client gửi qua HTTP (socket không
    // kết nối) thì người nhận vẫn nhận realtime thay vì phải F5.
    emitToUsers(result.memberNos, "chat:message", payload);

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

    await repo.withTransaction(async ({ query }) => {
      await query(
        `UPDATE ZTB_CHAT_PARTICIPANT SET LEFT_AT = GETDATE(), ROLE = 'MEMBER'
         WHERE CONVERSATION_ID = @CONVERSATION_ID AND EMPL_NO = @EMPL_NO`,
        { CONVERSATION_ID: conversationId, EMPL_NO: emplNo }
      );
      // Nhóm rỗng ⇒ đóng mềm, KHÔNG xoá vật lý.
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

    emitToUsers([emplNo], "chat:conversation-removed", { conversationId });
    emitToConversation(conversationId, "chat:members-changed", { conversationId });

    const systemMsg = await core.sendMessage({
      ctrCd,
      conversationId,
      senderEmplNo: emplNo,
      msgType: "SYSTEM",
      content: `${getCtx(req, DATA).emplName || emplNo} đã rời nhóm`,
    });
    if (systemMsg.ok) {
      emitToConversation(conversationId, "chat:message", {
        conversationId,
        message: core.toClientMessage(systemMsg.message),
      });
    }

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

    await repo.withTransaction(async ({ query }) => {
      await query(
        `UPDATE ZTB_CHAT_CONVERSATION
         SET TITLE = CASE WHEN @TITLE IS NULL THEN TITLE ELSE @TITLE END,
             AVATAR = CASE WHEN @AVATAR IS NULL THEN AVATAR ELSE @AVATAR END,
             UPDATED_AT = GETDATE()
         WHERE CONVERSATION_ID = @CONVERSATION_ID`,
        {
          TITLE: title === undefined ? null : title,
          AVATAR: DATA?.avatar === undefined ? null : String(DATA.avatar),
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
