/**
 * Command handler cho quan hệ bạn bè (danh bạ chat).
 * Lưu ý: chat 1-1 KHÔNG bắt buộc phải là bạn — module này chỉ phục vụ danh bạ,
 * gợi ý và lời mời kết bạn.
 */
const repo = require("./chatRepository");
const { emitToUsers } = require("../../socket/socketHandler");

const MAX_PENDING_PER_USER = 200;

function getCtx(req, DATA) {
  const payload = req.payload_data || {};
  return {
    ctrCd: String(payload.CTR_CD || DATA?.CTR_CD || "").trim(),
    // EMPL_NO là kiểu char trong ZTBEMPLINFO ⇒ trim để so khớp chính xác.
    emplNo: String(payload.EMPL_NO || "").trim().toUpperCase(),
  };
}

function ok(res, data) {
  res.send({ tk_status: "OK", data });
}

function fail(res, message, code) {
  res.send({ tk_status: "NG", code, message });
}

async function decoratePartners({ ctrCd, emplNo, rows }) {
  const partners = rows.map((row) => (row.REQUESTER === emplNo ? row.RECIPIENT : row.REQUESTER));
  const employees = await repo.getEmployeesByNos({ ctrCd, emplNos: partners });
  const byNo = new Map(employees.map((e) => [e.EMPL_NO, e]));

  return rows.map((row) => {
    const partner = row.REQUESTER === emplNo ? row.RECIPIENT : row.REQUESTER;
    const info = byNo.get(partner) || {};
    return {
      FRIEND_ID: row.FRIEND_ID,
      PARTNER: partner,
      FULL_NAME:
        [info.MIDLAST_NAME, info.FIRST_NAME].filter(Boolean).join(" ").trim() || partner,
      EMPL_IMAGE: info.EMPL_IMAGE || "N",
      JOB_NAME: info.JOB_NAME || null,
      MAINDEPTNAME: info.MAINDEPTNAME || null,
      SUBDEPTNAME: info.SUBDEPTNAME || null,
      STATUS: row.STATUS,
      DIRECTION: row.REQUESTER === emplNo ? "OUTGOING" : "INCOMING",
      CREATED_AT: row.CREATED_AT,
    };
  });
}

exports.chatListFriends = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");

    const [friends, requests] = await Promise.all([
      repo.listFriends({ ctrCd, emplNo }),
      repo.listFriendRequests({ ctrCd, emplNo }),
    ]);

    const [friendViews, requestViews] = await Promise.all([
      decoratePartners({ ctrCd, emplNo, rows: friends }),
      decoratePartners({ ctrCd, emplNo, rows: requests }),
    ]);

    ok(res, { friends: friendViews, requests: requestViews });
  } catch (error) {
    console.error("[chatListFriends]", error);
    fail(res, "Không tải được danh bạ");
  }
};

exports.chatFriendRequest = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const recipient = String(DATA?.recipient || "").trim().toUpperCase();
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!recipient || recipient === emplNo) return fail(res, "Người nhận không hợp lệ");

    const existing = await repo.findFriendRequest({ ctrCd, requester: emplNo, recipient });
    if (existing) {
      if (existing.STATUS === "ACCEPTED") return ok(res, { status: "ALREADY_FRIEND" });
      return ok(res, { status: "PENDING", friendId: existing.FRIEND_ID });
    }

    const pending = await repo.listFriendRequests({ ctrCd, emplNo });
    if (pending.length >= MAX_PENDING_PER_USER) return fail(res, "Bạn có quá nhiều lời mời đang chờ");

    const created = await repo.insertFriendRequest({ ctrCd, requester: emplNo, recipient });
    await repo.writeAudit({ ctrCd, actor: emplNo, action: "FRIEND_REQUESTED", target: recipient });

    emitToUsers([recipient], "chat:friend-request", { from: emplNo, friendId: created.FRIEND_ID });
    ok(res, { status: "PENDING", friendId: created.FRIEND_ID });
  } catch (error) {
    console.error("[chatFriendRequest]", error);
    fail(res, "Không gửi được lời mời kết bạn");
  }
};

exports.chatFriendRespond = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const friendId = Number(DATA?.friendId);
    const action = String(DATA?.action || "").trim().toLowerCase();
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(friendId) || friendId <= 0) return fail(res, "Lời mời không hợp lệ");
    if (!["accept", "reject"].includes(action)) return fail(res, "Hành động không hợp lệ");

    const status = action === "accept" ? "ACCEPTED" : "REJECTED";
    const affected = await repo.updateFriendStatus({ ctrCd, friendId, status, actorEmplNo: emplNo });
    if (affected === 0) return fail(res, "Lời mời không tồn tại hoặc đã được xử lý");

    await repo.writeAudit({ ctrCd, actor: emplNo, action: `FRIEND_${status}`, target: String(friendId) });
    ok(res, { friendId, status });
  } catch (error) {
    console.error("[chatFriendRespond]", error);
    fail(res, "Không xử lý được lời mời");
  }
};

exports.chatFriendCancel = async (req, res, DATA) => {
  try {
    const { ctrCd, emplNo } = getCtx(req, DATA);
    const friendId = Number(DATA?.friendId);
    if (!ctrCd || !emplNo) return fail(res, "Thiếu thông tin tài khoản");
    if (!Number.isInteger(friendId) || friendId <= 0) return fail(res, "Lời mời không hợp lệ");

    const affected = await repo.updateFriendStatus({
      ctrCd,
      friendId,
      status: "CANCELLED",
      actorEmplNo: emplNo,
    });
    if (affected === 0) return fail(res, "Lời mời không tồn tại hoặc đã được xử lý");

    await repo.writeAudit({ ctrCd, actor: emplNo, action: "FRIEND_CANCELLED", target: String(friendId) });
    ok(res, { friendId, status: "CANCELLED" });
  } catch (error) {
    console.error("[chatFriendCancel]", error);
    fail(res, "Không huỷ được lời mời");
  }
};
