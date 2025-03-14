const jwt = require("jsonwebtoken");

const checkLoginIndex = (req, res, next) => {
  // Lấy command từ body
  const { command } = req.body || {};

  // Nếu command là "login" hoặc "logout", bỏ qua kiểm tra JWT
  if (command === "login" || command === "logout") {
    req.coloiko = "kocoloi"; // Gán mặc định để tránh lỗi ở các bước sau
    return next();
  }

  // Lấy token từ cookie hoặc body
  const token = req.cookies.token || req.body.DATA?.token_string || req.body.token_string;

  try {
    if (!token) {
      throw new Error("No token provided");
    }

    // Xác minh token
    const decoded = jwt.verify(token, "nguyenvanhung");
    const payload = JSON.parse(decoded.payload);
    req.payload_data = payload[0]; // Lưu thông tin user vào req
    req.coloiko = payload[0].WORK_STATUS_CODE === 0 ? "coloi" : "kocoloi";
    next();
  } catch (err) {
    console.log("Auth Error:", err.message);
    req.coloiko = "coloi"; // Gán trạng thái lỗi nếu token không hợp lệ
    next(); // Vẫn cho phép đi tiếp, không chặn request
  }
};

const checkLoginUpdateIndex = (req, res, next) => {
    req.coloiko = "kocoloi"; 
    return next(); 
};

module.exports = { checkLoginIndex, checkLoginUpdateIndex };