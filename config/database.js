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
const queryDB_New = async (query, params = {}) => {
  let kq = "";
  try {
    const pool = await openConnection();
    const request = pool.request();
    // Binding các tham số nếu có
    if (params && typeof params === 'object') {
      for (const key in params) {
        if (params[key] && typeof params[key] === 'object' && 'type' in params[key] && 'value' in params[key]) {
          // Nếu truyền kiểu { type, value }
          request.input(key, params[key].type, params[key].value);
        } else if (typeof params[key] === 'string') {
          // Nếu là chuỗi, luôn dùng NVarChar
          request.input(key, sql.NVarChar, params[key]);
        } else {
          // Các kiểu khác giữ nguyên
          request.input(key, params[key]);
        }
      }
    }
    const result = await request.query(query);
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


const queryDB_New2 = async (baseQuery, params = {}, conditions = []) => {
  let kq = "";
  try {
    const pool = await openConnection();
    const request = pool.request();
    let finalQuery = baseQuery;
    let queryParams = {};

    console.log("conditions", conditions)
    console.log("params", params)

    // Nếu có conditions (dùng cho select/filter), xử lý điều kiện động
    if (Array.isArray(conditions) && conditions.length > 0) {
      for (const condition of conditions) {
        const { placeholder, clause, paramName, like, skipValues = [] } = condition;
        console.log("condition", condition)
        if (
          params[paramName] !== undefined &&
          params[paramName] !== null &&
          !skipValues.includes(params[paramName])
        ) {
          let paramValue = params[paramName];
          if (like) {
            if (like === 'both') {
              paramValue = `%${paramValue}%`;
            } else if (like === 'left') {
              paramValue = `%${paramValue}`;
            } else if (like === 'right') {
              paramValue = `${paramValue}%`;
            }
          }
          queryParams[paramName] = paramValue;
          finalQuery = finalQuery.replace(placeholder, clause);
        } else {
          finalQuery = finalQuery.replace(placeholder, "");
        }
        console.log("finalQuery", finalQuery)
      }
      // Sau khi xử lý điều kiện, binding các param thực tế được dùng
      for (const key in queryParams) {
        if (
          queryParams[key] &&
          typeof queryParams[key] === 'object' &&
          'type' in queryParams[key] &&
          'value' in queryParams[key]
        ) {
          request.input(key, queryParams[key].type, queryParams[key].value);
        } else if (typeof queryParams[key] === 'string') {
          request.input(key, sql.NVarChar, queryParams[key]);
        } else {
          request.input(key, queryParams[key]);
        }
      }
      console.log("Final query:", finalQuery);
      console.log("queryParams:", queryParams);
    } else {
      // Không có conditions: binding toàn bộ params (dùng cho insert/update/delete)
      if (params && typeof params === 'object') {
        for (const key in params) {
          if (params.hasOwnProperty(key)) {
            request.input(key, params[key]);
          }
        }
      }
      console.log("Final query:", finalQuery);
      if (params && Object.keys(params).length > 0) {
        console.log("params:", params);
      }
    }

    // Thực thi truy vấn
    const result = await request.query(finalQuery);
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
    kq = { tk_status: "NG", message: error.toString() };
  }
  return kq;
};


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
  queryDB_New,
  queryDB_New2,
  asyncQuery,
  closePool,
  config,
};
// Graceful shutdown khi ứng dụng dừng
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});