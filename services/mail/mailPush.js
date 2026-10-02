/**
 * Web Push cho email mới (Phase 7).
 *
 * Nguyên tắc giống Chat (`services/chat/chatPush.js`) — tái dùng hạ tầng sẵn có:
 *  - Chỉ push cho thiết bị KHÔNG đang active; thiết bị đang mở ERP thì không nhận push.
 *  - Người dùng đã TẮT thông báo cho mailbox đó (`ZTB_MAIL_MUTE`) thì bỏ qua.
 *  - `tag` gộp thông báo theo mailbox ⇒ nhiều email liên tiếp không xếp thành chuỗi dài.
 *  - Deep-link `/?mail=<id>` mở đúng email trong MailDock.
 */
const { isUserOnline, getActiveDeviceIds, getConnectedDeviceIds } = require("../../socket/presence");
const { sendTargetedPushNotification } = require("../targetedPushService");
const mailRepo = require("./mailRepository");

const PREVIEW_LENGTH = 160;

/** Rút gọn tiêu đề/nội dung cho thông báo đẩy. */
function clip(text, length = PREVIEW_LENGTH) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

/**
 * Push thông báo có email mới.
 *
 * @param {{account: object, messages?: Array<{ID:number,SUBJECT:string,FROM_NAME:string,FROM_ADDRESS:string,PREVIEW_TEXT?:string}>, imported?: number}} params
 */
async function pushNewEmail({ account, messages = [], imported = 0 }) {
  try {
    if (!account) return;
    const emplNo = String(account.EMPL_NO || "").trim().toUpperCase();
    // Mailbox dùng chung (EMPL_NO = NULL) không có người nhận cố định ⇒ không push.
    if (!emplNo) return;
    if (Number(imported) <= 0 && messages.length === 0) return;

    // Người dùng đã tắt thông báo cho mailbox này ⇒ không push (vẫn thấy mail trong app).
    try {
      const muted = await mailRepo.listMutedAccountIds(emplNo);
      if (muted.includes(Number(account.ID))) return;
    } catch (error) {
      console.warn(`[mail] không đọc được danh sách tắt thông báo: ${error?.message || error}`);
    }

    // Quyết định theo THIẾT BỊ: thiết bị đang active ⇒ loại khỏi danh sách nhận push.
    const excludeDeviceIds = {};
    const activeDevices = getActiveDeviceIds(emplNo);
    if (activeDevices.length > 0) {
      excludeDeviceIds[emplNo] = activeDevices;
    } else if (getConnectedDeviceIds(emplNo).length === 0 && isUserOnline(emplNo)) {
      // Client cũ không gửi deviceId mà vẫn online ⇒ không push để tránh trùng.
      return;
    }

    const newest = messages[0] || null;
    const count = Math.max(Number(imported) || 0, messages.length);
    const fromLabel = clip(newest?.FROM_NAME || newest?.FROM_ADDRESS || account.EMAIL_ADDRESS, 60);
    const subject = clip(newest?.SUBJECT) || "(Không có tiêu đề)";
    const title = count > 1 ? `${fromLabel} · ${count} email mới` : `Email mới từ ${fromLabel}`;
    const body =
      count > 1
        ? subject
        : clip(newest?.PREVIEW_TEXT) || subject;

    console.log(
      `[mail] push acc=${account.ID} -> ${emplNo} (mới ${count}, activeDevices=${excludeDeviceIds[emplNo]?.length || 0})`
    );

    await sendTargetedPushNotification({
      ctrCd: account.CTR_CD,
      targetEmplNos: [emplNo],
      title,
      body,
      // Deep-link mở đúng email trong MailDock.
      url: newest?.ID ? `/?mail=${newest.ID}` : "/?mail=inbox",
      tag: `mail-${account.ID}`,
      excludeDeviceIds,
      data: {
        type: "MAIL_NEW",
        accountId: String(account.ID),
        messageId: newest?.ID ? String(newest.ID) : "",
        emailAddress: account.EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    console.warn("[mail] push email mới lỗi:", error?.message || error);
  }
}

module.exports = { pushNewEmail };
