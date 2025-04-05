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
  let kq = "";
  try {
    const pool = await openConnection();
    const result = await pool.request().query(query);
    //console.log("Query result:", result); 
    if (result.rowsAffected[0] > 0) {
      if (result.recordset) {
        kq = { tk_status: "OK", data: result.recordset };
      } else {
        kq = { tk_status: "OK", message: "Modify data thanh cong" };
      }
    } else {
      kq = { tk_status: "NG", message: "Không có dòng dữ liệu nào" };
    }
  

  } catch (error) {
    console.log("Query error:", error);
    kq = { tk_status: "NG", message: error + " " };
  }
  return kq;
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

function asyncQuery(queryString) {
  return new Promise((resolve, reject) => {
    sql.connect(config, (err) => {
      if (err) console.log(err);
      let sqlRequest = new sql.Request();
      sqlRequest.query(queryString, function (err, data) {
        if (err) {
          //console.log(err);
          return reject(err);
        }
        var rs = data.recordset;
        if (rs.hasOwnProperty("length")) {
          // //console.log("co property");
        } else {
          //  //console.log("khong co property");
        }
        ////console.log('length of dataset: ' + rs.length);
        let kk;
        if (rs.length != 0) {
          kk = JSON.stringify(rs);
          resolve(kk);
        } else {
          resolve(0);
        }
      });
    });
  }).catch((err) => {
    //console.log("Loi dc catch: " + err + ' ');
  });
}
module.exports = {
  openConnection,
  queryDB,
  asyncQuery,
  closePool,
  config,
};
// Graceful shutdown khi ứng dụng dừng
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});