/**
 * Presence tạm thời của Socket.IO (in-memory, 1 process).
 *
 * Tách riêng khỏi socketHandler để service chat dùng được (biết ai đang offline
 * ⇒ có cần gửi Web Push hay không) mà KHÔNG tạo require vòng.
 */
/**
 * emplNo → Map<socketId, { deviceId, lastActiveAt }>
 *
 * Vì sao lưu theo SOCKET chứ không chỉ theo user: một người có thể mở nhiều
 * tab/thiết bị. Ta cần biết THIẾT BỊ nào đang thực sự có mặt để quyết định push
 * theo từng thiết bị (PC đang mở ⇒ không push cho PC, nhưng vẫn push cho iPhone).
 */
const onlineUsers = new Map();

/**
 * Một thiết bị chỉ bị coi là "đang dùng" nếu còn tương tác trong khoảng này.
 * Socket còn kết nối nhưng tab để nền lâu ⇒ quá hạn ⇒ vẫn gửi push (yêu cầu nghiệp vụ).
 */
const ACTIVE_WINDOW_MS =
  (Number(process.env.CHAT_DEVICE_ACTIVE_SECONDS) || 300) * 1000;

const normalize = (emplNo) => String(emplNo || "").trim().toUpperCase();

/** Chuẩn hoá deviceId do client sinh (localStorage) — rỗng thì coi như không xác định. */
const normalizeDevice = (deviceId) => String(deviceId || "").trim().slice(0, 120);

/**
 * Đánh dấu 1 socket đang online. `deviceId` (nếu có) dùng để quyết định push
 * theo thiết bị thay vì theo user.
 */
const markOnline = (emplNo, socketId, deviceId = "") => {
  const key = normalize(emplNo);
  if (!key) return;
  let sockets = onlineUsers.get(key);
  if (!sockets) {
    sockets = new Map();
    onlineUsers.set(key, sockets);
  }
  sockets.set(String(socketId), {
    deviceId: normalizeDevice(deviceId),
    lastActiveAt: Date.now(),
  });
};

const markOffline = (emplNo, socketId) => {
  const key = normalize(emplNo);
  const sockets = onlineUsers.get(key);
  if (!sockets) return;
  sockets.delete(String(socketId));
  if (sockets.size === 0) onlineUsers.delete(key);
};

/**
 * Cập nhật mốc "vừa có tương tác" cho socket (client gửi `chat:active` khi
 * tab được focus / đang nhìn màn hình). Dùng để phân biệt CONNECTED vs ACTIVE.
 */
const touchActive = (emplNo, socketId) => {
  const sockets = onlineUsers.get(normalize(emplNo));
  if (!sockets) return;
  const info = sockets.get(String(socketId));
  if (info) info.lastActiveAt = Date.now();
};

/** Còn ít nhất 1 socket active ⇒ coi như đang online. */
const isUserOnline = (emplNo) => onlineUsers.has(normalize(emplNo));

/** Danh sách EMPL_NO đang online (dùng cho chấm trạng thái trong chat). */
const getOnlineEmplNos = () => [...onlineUsers.keys()];

/** Tập deviceId đang có socket kết nối của 1 user (không xét mức độ active). */
const getConnectedDeviceIds = (emplNo) => {
  const sockets = onlineUsers.get(normalize(emplNo));
  if (!sockets) return [];
  const ids = new Set();
  sockets.forEach((info) => {
    if (info.deviceId) ids.add(info.deviceId);
  });
  return [...ids];
};

/**
 * Tập deviceId đang CONNECTED **và** ACTIVE (có tương tác trong ACTIVE_WINDOW_MS).
 * Đây mới là thứ dùng để chặn push: thiết bị nền quá lâu vẫn phải nhận thông báo.
 */
const getActiveDeviceIds = (emplNo) => {
  const sockets = onlineUsers.get(normalize(emplNo));
  if (!sockets) return [];
  const now = Date.now();
  const ids = new Set();
  sockets.forEach((info) => {
    if (info.deviceId && now - info.lastActiveAt <= ACTIVE_WINDOW_MS) ids.add(info.deviceId);
  });
  return [...ids];
};

module.exports = {
  markOnline,
  markOffline,
  touchActive,
  isUserOnline,
  getOnlineEmplNos,
  getConnectedDeviceIds,
  getActiveDeviceIds,
  ACTIVE_WINDOW_MS,
};
