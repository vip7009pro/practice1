var sql = require("mssql");
require('dotenv').config();
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,    
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 5005,
    trustServerCertificate: true,
    requestTimeout: 300000
};


const queryDB = async (query) => {
    let kq = "";
    try {
      await sql.connect(config);
      const result = await sql.query(query);
      if (result.rowsAffected[0] > 0) {
        if (result.recordset) {
          kq = { tk_status: "OK", data: result.recordset };
        } else {
          kq = { tk_status: "OK", message: "Modify data thanh cong" };
        }
      } else {
        kq = { tk_status: "NG", message: "Không có dòng dữ liệu nào" };
      }
    } catch (err) {
      ////console.log(err);
      kq = { tk_status: "NG", message: err + " " };
    }
    return kq;
  };


  (async () => {
    let setpdQuery = `SELECT TOP 1 * FROM M100`;
    console.log(setpdQuery);
    checkkq = await queryDB(setpdQuery);
    console.log(checkkq); 
  })();

