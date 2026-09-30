const { queryDB_New } = require("../config/database");
const { sendNotification } = require("../utils/pushUtils");

function normalizeSubscriptionRow(row) {
  try {
    const parsed = JSON.parse(row.SUBSCRIPTION);
    if (parsed && parsed.subscription) {
      return {
        subscription: parsed.subscription,
        emplNo: String(parsed.emplNo || "").trim().toUpperCase(),
        // deviceId (nếu client đã cập nhật) ⇒ cho phép lọc push theo TỪNG thiết bị.
        deviceId: String(parsed.deviceId || "").trim(),
      };
    }
    return {
      subscription: parsed,
      emplNo: "",
      deviceId: "",
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
  icon,
  excludeDeviceIds,
}) => {
  const targets = new Set(
    (Array.isArray(targetEmplNos) ? targetEmplNos : [targetEmplNos])
      .filter(Boolean)
      .map((value) => String(value).trim().toUpperCase())
  );

  if (!ctrCd || targets.size === 0) return;

  // Thiết bị đang ACTIVE của từng người (do presence tính) ⇒ KHÔNG push cho chính thiết bị đó.
  // Ví dụ: PC đang mở ERP thì PC không nhận push, nhưng iPhone để nền vẫn nhận.
  const excludedByEmpl = new Map();
  if (excludeDeviceIds && typeof excludeDeviceIds === "object") {
    Object.entries(excludeDeviceIds).forEach(([emplNo, ids]) => {
      const list = (Array.isArray(ids) ? ids : [ids])
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (list.length > 0) {
        excludedByEmpl.set(String(emplNo).trim().toUpperCase(), new Set(list));
      }
    });
  }

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
    icon: icon || undefined,
    actions: Array.isArray(actions) && actions.length > 0 ? actions : undefined,
    approval: approval || undefined,
    data: {
      ...data,
      url,
    },
  });

  const deliveries = result.data
    .map(normalizeSubscriptionRow)
    .filter((entry) => {
      if (!entry || !targets.has(entry.emplNo)) return false;
      // Bỏ qua đúng thiết bị đang ACTIVE (chỉ lọc được khi subscription có deviceId;
      // các bản ghi legacy không có deviceId vẫn gửi như cũ để không mất thông báo).
      const excluded = excludedByEmpl.get(entry.emplNo);
      if (excluded && entry.deviceId && excluded.has(entry.deviceId)) return false;
      return true;
    })
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
