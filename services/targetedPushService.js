const { queryDB_New } = require("../config/database");
const { sendNotification } = require("../utils/pushUtils");

function normalizeSubscriptionRow(row) {
  try {
    const parsed = JSON.parse(row.SUBSCRIPTION);
    if (parsed && parsed.subscription) {
      return {
        subscription: parsed.subscription,
        emplNo: String(parsed.emplNo || "").trim().toUpperCase(),
      };
    }
    return {
      subscription: parsed,
      emplNo: "",
    };
  } catch (error) {
    console.warn("Bỏ qua subscription JSON không hợp lệ:", error?.message || error);
    return null;
  }
}

/**
 * Gửi Web Push đúng tới các tài khoản đã đăng ký subscription.
 *
 * Không thay đổi schema production: owner được lưu trong JSON SUBSCRIPTION hiện có.
 * Các subscription legacy không có owner sẽ không nhận targeted notification để tránh
 * gửi nhầm thông tin nhân sự sang người khác.
 */
exports.sendTargetedPushNotification = async ({
  ctrCd,
  targetEmplNos,
  title,
  body,
  url = "/nhansu/pheduyetnghi",
  data = {},
  actions,
  approval,
  tag,
}) => {
  const targets = new Set(
    (Array.isArray(targetEmplNos) ? targetEmplNos : [targetEmplNos])
      .filter(Boolean)
      .map((value) => String(value).trim().toUpperCase())
  );

  if (!ctrCd || targets.size === 0) return;

  const result = await queryDB_New(
    "SELECT SUBSCRIPTION FROM ZTB_SUBSCRIPTION_TB WHERE CTR_CD=@CTR_CD AND SUB_STATUS='1'",
    { CTR_CD: ctrCd }
  );

  if (result.tk_status !== "OK" || !Array.isArray(result.data)) return;

  // `actions` ⇒ service worker vẽ nút hành động ngay trên thông báo (Phê duyệt / Từ chối).
  // `approval` ⇒ dữ liệu để SW gọi lại API mà không cần mở web.
  // `tag` ⇒ gộp các thông báo cùng nhóm (ví dụ cùng 1 phòng chat) thay vì xếp chồng.
  // JSON.stringify sẽ tự bỏ các key `undefined`.
  const payload = JSON.stringify({
    title,
    body,
    url,
    tag: tag || undefined,
    actions: Array.isArray(actions) && actions.length > 0 ? actions : undefined,
    approval: approval || undefined,
    data: {
      ...data,
      url,
    },
  });

  const deliveries = result.data
    .map(normalizeSubscriptionRow)
    .filter((entry) => entry && targets.has(entry.emplNo))
    .map(async (entry) => {
      try {
        await sendNotification(entry.subscription, payload);
      } catch (error) {
        console.warn("Không gửi được targeted push:", error?.message || error);
      }
    });

  await Promise.allSettled(deliveries);
};

exports.sendBroadcastPushNotification = async ({
  ctrCd,
  title,
  body,
  url = "/",
  data = {},
}) => {
  if (!ctrCd) return;

  const result = await queryDB_New(
    "SELECT SUBSCRIPTION FROM ZTB_SUBSCRIPTION_TB WHERE CTR_CD=@CTR_CD AND SUB_STATUS='1'",
    { CTR_CD: ctrCd }
  );
  if (result.tk_status !== "OK" || !Array.isArray(result.data)) return;

  const payload = JSON.stringify({ title, body, url, data: { ...data, url } });
  await Promise.allSettled(
    result.data.map(async (row) => {
      const entry = normalizeSubscriptionRow(row);
      if (!entry) return;
      try {
        await sendNotification(entry.subscription, payload);
      } catch (error) {
        console.warn("Không gửi được broadcast push:", error?.message || error);
      }
    })
  );
};
