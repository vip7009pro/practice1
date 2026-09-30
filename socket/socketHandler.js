const { Server } = require("socket.io");
const { corsOptions } = require("../config/env");
const repo = require("../services/chat/chatRepository");
const chatCore = require("../services/chat/chatMessageCore");
const { pushOfflineChat } = require("../services/chat/chatPush");
const {
  markOnline,
  markOffline,
  touchActive,
  isUserOnline,
  getOnlineEmplNos,
} = require("./presence");
const { verifyAuthToken } = require("../middleware/auth");

// Các instance socket.io đã khởi tạo — để tầng service phát được sự kiện realtime
// (ví dụ: phê duyệt từ thông báo đẩy xong thì chuông trong app phải cập nhật ngay).
const ioInstances = [];

const userRoom = (emplNo) => `user:${emplNo}`;
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

module.exports = (httpServer, httpsServer) => {
  const io = new Server(httpServer, { cors: { origin: corsOptions.origin } });
  const ios = new Server(httpsServer, { cors: { origin: corsOptions.origin } });
  let client_array = [];

  // Xác thực ngay khi handshake: KHÔNG tin EMPL_NO/CTR_CD do client tự khai.
  const authenticate = (socket, next) => {
    console.log(`[socket-auth] handshake in id=${socket.id} transport=${socket.conn?.transport?.name}`);
    const cookieHeader = socket.handshake.headers?.cookie;
    const cookieToken =
      typeof cookieHeader === "string"
        ? (cookieHeader.match(/(?:^|;\s*)token=([^;]+)/) || [])[1]
        : null;

    const token = socket.handshake.auth?.token || socket.handshake.query?.token_string || cookieToken;

    if (!token) {
      // Vẫn cho kết nối để các event cũ (login/notification/online_list) không bị gián đoạn,
      // nhưng socket này KHÔNG được phép dùng cho chat.
      socket.data.authenticated = false;
      console.log(`[socket-auth] no token id=${socket.id}`);
      return next();
    }

    try {
      const payload = verifyAuthToken(decodeURIComponent(String(token)));
      socket.data.authenticated = true;
      socket.data.emplNo = String(payload?.EMPL_NO || "").trim().toUpperCase();
      socket.data.ctrCd = String(payload?.CTR_CD || "").trim();
      socket.data.emplName = [payload?.MIDLAST_NAME, payload?.FIRST_NAME]
        .filter(Boolean)
        .join(" ")
        .trim();
      // deviceId do client sinh (localStorage) — dùng để quyết định push theo THIẾT BỊ.
      // Không bắt buộc: thiếu thì chỉ mất khả năng lọc push theo thiết bị.
      socket.data.deviceId = String(
        socket.handshake.auth?.deviceId || socket.handshake.query?.device_id || ""
      )
        .trim()
        .slice(0, 120);
      console.log(
        `[socket-auth] OK id=${socket.id} empl=${socket.data.emplNo} device=${socket.data.deviceId || "-"}`
      );
    } catch (error) {
      socket.data.authenticated = false;
      console.log(`[socket-auth] token lỗi id=${socket.id}: ${error?.message || error}`);
    }
    return next();
  };

  io.use(authenticate);
  ios.use(authenticate);

  const handleConnection = (client, ioInstance) => {
    console.log("A client connected");
    console.log("IO: Connected clients: " + ioInstance.engine.clientsCount);

    // Room riêng của user: nhận tin nhắn/mời kết bạn bất kể đang ở phòng nào.
    if (client.data.authenticated && client.data.emplNo) {
      client.join(userRoom(client.data.emplNo));
      markOnline(client.data.emplNo, client.id, client.data.deviceId);
      // Phát cho MỌI instance (io + ios) và gửi kèm danh sách online đầy đủ,
      // nếu không client mới mở trang sẽ thấy tất cả là "không hoạt động".
      emitToAll("chat:presence", { emplNo: client.data.emplNo, online: true });
      emitToAll("chat:presence-list", { emplNos: getOnlineEmplNos() });
    }
    client.on("send", (data) => {
      ioInstance.sockets.emit("send", data);
    });
    client.on("changeServer", (data) => {
      ioInstance.sockets.emit("changeServer", data);
    });
    ioInstance.sockets.emit("request_check_online2", { check: 'online' });
    ioInstance.sockets.emit("online_list", client_array);
    client.on("respond_check_online", (data) => {
      //console.log('co responde check online',data.EMPL_NO)
      if (client_array.filter(item => item.EMPL_NO === data.EMPL_NO).length === 0) client_array.push(data);
    });
    client.on("notification", (data) => {
      ioInstance.sockets.emit("notification", data);
      console.log(data);
    });
    client.on("notification_panel", (data) => {
      ioInstance.sockets.emit("notification_panel", data);
      console.log(data);    
    })
    client.on("online_list", (data) => {
      console.log(data);
    });
    client.on("setWebVer", (data) => {
      ioInstance.sockets.emit("setWebVer", data);
      console.log(data);
    });
    client.on("login", (data) => {
      if (client_array.filter(item => item.EMPL_NO === data.EMPL_NO).length === 0) client_array.push(data);
      ioInstance.sockets.emit("online_list", client_array);
      ioInstance.sockets.emit("login", data + "da dang nhap");
      console.log(data + " da dang nhap");
    });
    client.on("logout", (data) => {
      client_array = client_array.filter(obj => obj.EMPL_NO !== data.EMPL_NO);
      console.log('client_array', client_array.map((e, i) => e.EMPL_NO));
      ioInstance.sockets.emit("online_list", client_array);
      console.log(data + " da dang xuat");
    });

    /* ----------------------------- Chat events ----------------------------- */

    client.on("chat:join", async (payload, ack) => {
      try {
        if (!client.data.authenticated) return ack?.({ ok: false, code: "UNAUTHENTICATED" });
        const conversationId = Number(payload?.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
          return ack?.({ ok: false, code: "BAD_REQUEST" });
        }
        // Server kiểm tra membership — client không tự quyết định được room.
        const membership = await chatCore.getActiveMembership(conversationId, client.data.emplNo);
        if (!membership) return ack?.({ ok: false, code: "FORBIDDEN" });

        client.join(conversationRoom(conversationId));
        ack?.({ ok: true, conversationId });
      } catch (error) {
        console.error("[chat:join]", error);
        ack?.({ ok: false, code: "ERROR" });
      }
    });

    client.on("chat:leave", (payload) => {
      const conversationId = Number(payload?.conversationId);
      if (Number.isInteger(conversationId) && conversationId > 0) {
        client.leave(conversationRoom(conversationId));
      }
    });

    /**
     * Nhịp "thiết bị này đang thực sự được dùng" (tab đang hiển thị/focus).
     * Dùng để phân biệt CONNECTED (socket mở) với ACTIVE (người dùng đang nhìn màn hình)
     * ⇒ quyết định push theo từng thiết bị. Không ghi DB, chỉ cập nhật bộ nhớ.
     */
    client.on("chat:active", () => {
      if (!client.data.authenticated || !client.data.emplNo) return;
      touchActive(client.data.emplNo, client.id);
    });

    client.on("chat:send", async (payload, ack) => {
      try {
        if (!client.data.authenticated) {
          return ack?.({ ok: false, code: "UNAUTHENTICATED", message: "Chưa xác thực" });
        }

        const conversationId = Number(payload?.conversationId);
        const result = await chatCore.sendMessage({
          ctrCd: client.data.ctrCd,
          conversationId,
          senderEmplNo: client.data.emplNo,
          msgType: payload?.msgType,
          content: payload?.content,
          clientMessageId: payload?.clientMessageId,
          mentions: payload?.mentions,
          replyToMessageId: payload?.replyToMessageId,
          attachmentIds: payload?.attachmentIds,
        });

        if (!result.ok) {
          return ack?.({ ok: false, code: result.code, message: result.message });
        }

        // Persist xong mới phát realtime (persist-before-emit).
        // Phải enrich để tin nhắn vừa gửi có luôn ĐÍNH KÈM + cảm xúc + trích dẫn.
        const clientMessage = await chatCore.enrichMessage(
          conversationId,
          result.message,
          result.attachments
        );

        // 1) Room phòng chat: cho những client đang mở đúng hội thoại.
        emitToConversation(conversationId, "chat:message", { conversationId, message: clientMessage });
        // 2) Room riêng từng thành viên: đảm bảo badge/số chưa đọc và danh sách
        //    phòng cập nhật NGAY cả khi chưa mở hội thoại (không cần F5).
        emitToUsers(result.memberNos, "chat:message", { conversationId, message: clientMessage });
        // 3) Echo trực tiếp cho socket gửi (phòng trường hợp socket chưa vào room user).
        client.emit("chat:message", { conversationId, message: clientMessage });

        ack?.({ ok: true, message: clientMessage, duplicated: result.duplicated });

        // Chỉ push cho thành viên KHÔNG còn socket active (theo yêu cầu nghiệp vụ).
        void pushOfflineChat({
          ctrCd: client.data.ctrCd,
          memberNos: result.memberNos,
          senderEmplNo: client.data.emplNo,
          senderName: client.data.emplName || client.data.emplNo,
          conversationTitle:
            result.conversation?.CONV_TYPE === "GROUP" ? result.conversation?.TITLE : undefined,
          content: clientMessage.CONTENT,
          conversationId,
          msgType: clientMessage.MSG_TYPE,
        });
      } catch (error) {
        console.error("[chat:send]", error);
        ack?.({ ok: false, code: "ERROR", message: "Không gửi được tin nhắn" });
      }
    });

    client.on("chat:reaction", async (payload, ack) => {
      try {
        if (!client.data.authenticated) return ack?.({ ok: false, code: "UNAUTHENTICATED" });
        const conversationId = Number(payload?.conversationId);
        const messageId = Number(payload?.messageId);
        if (!Number.isInteger(conversationId) || !Number.isInteger(messageId)) {
          return ack?.({ ok: false, code: "BAD_REQUEST" });
        }

        const membership = await chatCore.getActiveMembership(conversationId, client.data.emplNo);
        if (!membership) return ack?.({ ok: false, code: "FORBIDDEN" });

        const rows = await repo.listMessagesByIds({
          conversationId,
          messageIds: [messageId],
          emplNo: client.data.emplNo,
        });
        if (!rows || rows.length === 0) return ack?.({ ok: false, code: "NOT_FOUND" });

        const normalized = String(payload?.reaction || "").trim().toUpperCase();
        const removed = !normalized || normalized === "NONE";

        if (removed) {
          await repo.removeReaction({ messageId, emplNo: client.data.emplNo });
        } else {
          if (!chatCore.REACTION_TYPES.has(normalized)) {
            return ack?.({ ok: false, code: "BAD_REACTION" });
          }
          await repo.setReaction({
            ctrCd: client.data.ctrCd,
            messageId,
            emplNo: client.data.emplNo,
            reaction: normalized,
          });
        }

        const event = {
          conversationId,
          messageId,
          emplNo: client.data.emplNo,
          reaction: removed ? null : normalized,
          removed,
          // Gửi kèm bản tổng hợp mới nhất để client thay thế nguyên trạng (khỏi lệch số).
          reactions: chatCore.buildReactions(
            await repo.listReactionsForMessages({ messageIds: [messageId] })
          ),
        };
        emitToConversation(conversationId, "chat:reaction", event);
        const members = await repo.listActiveMemberNos({ conversationId });
        emitToUsers(members.map((row) => row.EMPL_NO), "chat:reaction", event);

        ack?.({ ok: true, ...event });
      } catch (error) {
        console.error("[chat:reaction]", error);
        ack?.({ ok: false, code: "ERROR" });
      }
    });

    client.on("chat:typing", (payload) => {
      if (!client.data.authenticated) return;
      const conversationId = Number(payload?.conversationId);
      if (!Number.isInteger(conversationId) || conversationId <= 0) return;
      client.to(conversationRoom(conversationId)).emit("chat:typing", {
        conversationId,
        emplNo: client.data.emplNo,
        emplName: client.data.emplName,
        typing: Boolean(payload?.typing),
      });
    });

    client.on("chat:read", async (payload) => {
      try {
        if (!client.data.authenticated) return;
        const conversationId = Number(payload?.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) return;

        const membership = await chatCore.getActiveMembership(conversationId, client.data.emplNo);
        if (!membership) return;

        await repo.markRead({
          ctrCd: client.data.ctrCd,
          conversationId,
          emplNo: client.data.emplNo,
          lastMessageId: payload?.lastMessageId,
        });
        client.to(conversationRoom(conversationId)).emit("chat:read", {
          conversationId,
          emplNo: client.data.emplNo,
          lastMessageId: Number(payload?.lastMessageId) || 0,
        });
      } catch (error) {
        console.error("[chat:read]", error);
      }
    });

    client.on("disconnect", (data) => {
      console.log(data);
      console.log("A client disconnected !");
      console.log("Connected clients: " + io.engine.clientsCount);
      if (client.data.authenticated && client.data.emplNo) {
        markOffline(client.data.emplNo, client.id);
        if (!isUserOnline(client.data.emplNo)) {
          emitToAll("chat:presence", { emplNo: client.data.emplNo, online: false });
        }
        emitToAll("chat:presence-list", { emplNos: getOnlineEmplNos() });
      }
      ioInstance.sockets.emit("request_check_online2", { check: 'online' });
      ioInstance.sockets.emit("online_list", client_array);
    });
  };

  io.on("connection", (client) => handleConnection(client, io));
  ios.on("connection", (client) => handleConnection(client, ios));

  ioInstances.push(io, ios);
};

/** Phát sự kiện tới mọi client đang kết nối (cả cổng HTTP và HTTPS). */
function emitToAll(event, payload) {
  ioInstances.forEach((instance) => instance.emit(event, payload));
}

/** Phát sự kiện tới room của 1 phòng chat. */
function emitToConversation(conversationId, event, payload) {
  ioInstances.forEach((instance) =>
    instance.to(conversationRoom(conversationId)).emit(event, payload)
  );
}

/**
 * Phát sự kiện tới room riêng của từng user (phủ cả HTTP và HTTPS).
 *
 * Quan trọng cho chat: người nhận PHẢI nhận được tin kể cả khi chưa mở đúng
 * phòng chat (chưa chat:join) — nếu chỉ phát vào room phòng chat thì tin sẽ
 * không tới và người dùng phải F5 mới thấy.
 */
function emitToUsers(emplNos, event, payload) {
  const targets = [
    ...new Set((emplNos || []).filter(Boolean).map((v) => String(v).trim().toUpperCase())),
  ];
  if (targets.length === 0) return;
  ioInstances.forEach((instance) => {
    targets.forEach((emplNo) => instance.to(userRoom(emplNo)).emit(event, payload));
  });
}

module.exports.emitToAll = emitToAll;
module.exports.emitToConversation = emitToConversation;
module.exports.emitToUsers = emitToUsers;
module.exports.isUserOnline = isUserOnline;
module.exports.getOnlineEmplNos = getOnlineEmplNos;