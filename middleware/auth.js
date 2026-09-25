const jwt = require("jsonwebtoken");
const { decryptData} = require("../utils/cryptoUtils");
const { privateKey } = require("../config/env");

const PUBLIC_COMMANDS = new Set([
  "login",
  "login2",
  "logout",
  "checklogin",
  "loadWebSetting",
  "checkWebVer",
  "checkLicense",
]);

const isEncryptedPayload = (data) =>
  Boolean(
    data &&
    typeof data === "object" &&
    typeof data.encryptedData === "string" &&
    typeof data.encryptedKey === "string" &&
    typeof data.iv === "string"
  );

const checkLoginIndex = (req, res, next) => {
  // 1. Chỉ giải mã khi client thực sự gửi payload mã hóa (chứa encryptedData, encryptedKey, iv)
  if (req.body && req.body.DATA !== undefined && req.body.secureContext !== false && isEncryptedPayload(req.body.DATA)) {
    try {
      let decrypted = decryptData(privateKey, req.body.DATA);
      req.body.DATA = decrypted;
    } catch (decryptErr) {
      console.log("Decrypt Error:", decryptErr.message);
      return res.status(400).json({
        tk_status: "NG",
        message: "Lỗi giải mã dữ liệu yêu cầu. Vui lòng thử lại.",
      });
    }
  }

  // 2. Lấy command từ body
  const { command } = req.body || {};

  // 3. Nếu command thuộc whitelist công khai (login, checklogin, loadWebSetting...), cho phép đi tiếp
  if (PUBLIC_COMMANDS.has(command)) {
    req.coloiko = "kocoloi";
    return next();
  }

  // 4. Với các command yêu cầu quyền: kiểm tra JWT
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const queryToken = req.query?.token_string || req.query?.token;
  let token =
    req.body.DATA?.token_string ||
    req.cookies?.token ||
    req.body?.token_string ||
    queryToken;

  if (!token && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length);
  }

  try {
    if (!token) {
      throw new Error("No token provided");
    }
    // Xác minh token
    const decoded = jwt.verify(token, "nguyenvanhung");
    const payload = JSON.parse(decoded.payload);
    req.payload_data = payload[0]; // Lưu thông tin user vào req
    req.coloiko = payload[0]?.WORK_STATUS_CODE === 0 ? "coloi" : "kocoloi";
    next();
  } catch (err) {
    console.log(`Auth Error [${command}]:`, err.message);
    req.coloiko = "coloi";
    return res.status(401).json({
      tk_status: "TOKEN_EXPIRED",
      message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
    });
  }
};

const checkLoginVendorsIndex = (req, res, next) => {
  // 1. Chỉ giải mã khi client thực sự gửi payload mã hóa (chứa encryptedData, encryptedKey, iv)
  if (req.body && req.body.DATA !== undefined && req.body.secureContext !== false && isEncryptedPayload(req.body.DATA)) {
    try {
      let decrypted = decryptData(privateKey, req.body.DATA);
      req.body.DATA = decrypted;
    } catch (decryptErr) {
      console.log("Vendor Decrypt Error:", decryptErr.message);
      return res.status(400).json({
        tk_status: "NG",
        message: "Lỗi giải mã dữ liệu yêu cầu. Vui lòng thử lại.",
      });
    }
  }

  // 2. Lấy command từ body
  const { command } = req.body || {};
  if (command === "loginVendors" || command === "logoutVendors" || command === "checkloginVendors") {
    req.coloiko = "kocoloi";
    return next();
  }

  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const queryToken = req.query?.token_string || req.query?.token;
  let token =
    req.body.DATA?.token_string ||
    req.cookies?.token_vendors ||
    req.body?.token_string ||
    queryToken;

  if (!token && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length);
  }

  try {
    if (!token) {
      throw new Error("No token provided");
    }
    const decoded = jwt.verify(token, "vendors");
    const payload = JSON.parse(decoded.payload);
    req.payload_data = payload[0];
    req.coloiko = payload[0]?.WORK_STATUS_CODE === 0 ? "coloi" : "kocoloi";
    next();
  } catch (err) {
    console.log(`Vendor Auth Error [${command}]:`, err.message);
    req.coloiko = "coloi";
    return res.status(401).json({
      tk_status: "TOKEN_EXPIRED",
      message: "Phiên đăng nhập Vendor đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
    });
  }
};
const checkLoginUpdateIndex = (req, res, next) => {
  req.coloiko = "kocoloi";
  return next();
};
module.exports = { checkLoginIndex, checkLoginUpdateIndex, checkLoginVendorsIndex };