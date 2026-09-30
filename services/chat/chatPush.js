/**
 * Gửi Web Push cho thành viên đang OFFLINE khi có tin nhắn chat mới.
 *
 * Dùng chung cho cả 2 luồng gửi tin:
 *  - Socket (`chat:send`)
 *  - HTTP command (`chatSendMessage`)
 * nên người nhận offline luôn được thông báo dù người gửi đi đường nào.
 */
const {
  isUserOnline,
  getOnlineEmplNos,
  getActiveDeviceIds,
  getConnectedDeviceIds,
} = require("../../socket/presence");
const { sendTargetedPushNotification } = require("../targetedPushService");
const repo = require("./chatRepository");
const { richToPlainText } = require("./richText");

const PREVIEW_LENGTH = 140;

function buildPreview(msgType, content) {
  if (msgType === "TEXT" || msgType === "SYSTEM" || msgType === "RICH") {
    // Tin RICHTEXT lưu HTML ⇒ thông báo phải hiển thị chữ thuần.
    const raw = String(content || "").trim();
    const text = msgType === "RICH" ? richToPlainText(raw) : raw;
    if (!text) return "Bạn có tin nhắn mới";
    return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
  }
  if (msgType === "IMAGE") return "Đã gửi một hình ảnh";
  return "Đã gửi tệp đính kèm";
}

/**
 * @param {{ctrCd:string, memberNos:string[], senderEmplNo:string, senderName?:string,
 *          conversationTitle?:string, content?:string, conversationId:number, msgType?:string}} params
 */
async function pushOfflineChat({
  ctrCd,
  memberNos,
  senderEmplNo,
  senderName,
  conversationTitle,
  content,
  conversationId,
  msgType = "TEXT",
}) {
  try {
    if (!ctrCd || !conversationId) return;

    const sender = String(senderEmplNo || "").trim().toUpperCase();
    // Người đang "tắt thông báo" cho RIÊNG phòng này thì không nhận push
    // (vẫn thấy tin nhắn + số chưa đọc khi mở app).
    let muted = new Set();
    try {
      muted = new Set(await repo.listMutedMemberNos({ conversationId }));
    } catch (error) {
      console.warn("[chat] không đọc được danh sách tắt thông báo:", error?.message || error);
    }
    const targets = [...new Set((memberNos || []).map((v) => String(v || "").trim().toUpperCase()))]
      .filter((emplNo) => emplNo && emplNo !== sender && !muted.has(emplNo));

    if (targets.length === 0) return;

    /*
     * Quyết định push theo THIẾT BỊ (không phải theo user):
     *  - Thiết bị đang CONNECTED + ACTIVE  ⇒ loại khỏi danh sách nhận push.
     *  - Thiết bị CONNECTED nhưng để nền lâu (idle) ⇒ vẫn push (đúng yêu cầu nghiệp vụ).
     *  - Client cũ không gửi deviceId mà còn socket online ⇒ giữ hành vi cũ: không push
     *    (tránh gửi trùng khi không xác định được thiết bị).
     */
    const excludeDeviceIds = {};
    const recipients = targets.filter((emplNo) => {
      const activeDevices = getActiveDeviceIds(emplNo);
      if (activeDevices.length > 0) {
        excludeDeviceIds[emplNo] = activeDevices;
        return true;
      }
      const knownDevices = getConnectedDeviceIds(emplNo);
      if (knownDevices.length === 0 && isUserOnline(emplNo)) return false;
      return true;
    });

    if (recipients.length === 0) return;

    const name = String(senderName || sender || "").trim();
    const title = conversationTitle ? `${name} · ${conversationTitle}` : name || "Tin nhắn nội bộ";

    console.log(
      `[chat] push conv=${conversationId} -> ${recipients.join(",")}` +
        ` (activeDevices: ${Object.keys(excludeDeviceIds).length}, online: ${getOnlineEmplNos().length})`
    );

    await sendTargetedPushNotification({
      ctrCd,
      targetEmplNos: recipients,
      title,
      body: buildPreview(msgType, content),
      url: `/?chat=${conversationId}`,
      // Gộp thông báo theo phòng: nhiều tin liên tiếp không xếp thành chuỗi dài.
      tag: `chat-${conversationId}`,
      // Thiết bị đang active của từng người ⇒ bỏ qua khi gửi.
      excludeDeviceIds,
      data: {
        type: "CHAT_MESSAGE",
        conversationId: String(conversationId),
        senderEmplNo: sender,
      },
    });
  } catch (error) {
    console.warn("[chat] push offline lỗi:", error?.message || error);
  }
}

module.exports = { pushOfflineChat };
