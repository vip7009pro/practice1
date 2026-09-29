/**
 * Presence tạm thời của Socket.IO (in-memory, 1 process).
 *
 * Tách riêng khỏi socketHandler để service chat dùng được (biết ai đang offline
 * ⇒ có cần gửi Web Push hay không) mà KHÔNG tạo require vòng.
 */
const onlineUsers = new Map();

const normalize = (emplNo) => String(emplNo || "").trim().toUpperCase();

const markOnline = (emplNo, socketId) => {
  const key = normalize(emplNo);
  if (!key) return;
  if (!onlineUsers.has(key)) onlineUsers.set(key, new Set());
  onlineUsers.get(key).add(socketId);
};

const markOffline = (emplNo, socketId) => {
  const key = normalize(emplNo);
  const sockets = onlineUsers.get(key);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(key);
};

/** Còn ít nhất 1 socket active ⇒ coi như đang online (không cần push). */
const isUserOnline = (emplNo) => onlineUsers.has(normalize(emplNo));

/** Danh sách EMPL_NO đang online (dùng cho chấm trạng thái trong chat). */
const getOnlineEmplNos = () => [...onlineUsers.keys()];

module.exports = { markOnline, markOffline, isUserOnline, getOnlineEmplNos };
