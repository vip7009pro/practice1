const sql = require("mssql");
require("dotenv").config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  trustServerCertificate: true,
  requestTimeout: 300000,
  pool: {
    max: 1000, // Số kết nối tối đa trong pool
    min: 0,  // Số kết nối tối thiểu
    idleTimeoutMillis: 30000, // Thời gian tối đa một kết nối không hoạt động trước khi bị đóng
  },
};

// Khởi tạo pool toàn cục
let poolPromise;

const openConnection = async () => {
  if (!poolPromise) {
    poolPromise = sql.connect(config).catch((err) => {
      console.error("Database connection error:", err);
      poolPromise = null; // Reset nếu lỗi để thử lại lần sau
      throw err;
    });
  }
  return poolPromise;
};

// Hàm truy vấn database
const queryDB = async (query) => {
  try {
    const pool = await openConnection();
    const result = await pool.request().query(query);
    return { tk_status: "OK", data: result.recordset };
  } catch (error) {
    console.log("Query error:", error);
    return { tk_status: "NG", message: error.message };
  }
  // Không gọi sql.close() ở đây nữa
};

// Đóng pool khi cần (graceful shutdown)
const closePool = async () => {
  if (poolPromise) {
    await sql.close();
    poolPromise = null;
    console.log("Database pool closed");
  }
};

module.exports = {
  openConnection,
  queryDB,
  closePool,
  config,
};

// Graceful shutdown khi ứng dụng dừng
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});