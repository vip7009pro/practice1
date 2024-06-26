var sql = require("mssql");
require('dotenv').config();
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,    
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    trustServerCertificate: true,
    requestTimeout: 10000,   
   
};

/* const queryDB = async (query) => {
    let kq = "";
    try {
      await sql.connect(config);
      //await sql.connect('Server=192.168.1.2,5005;Database=CMS_VINA;User Id=sa;Password=*11021201$; MultipleActiveResultSets=True; Encrypt=false');      
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
    sql.close();
    return kq;    
  };
 */


  const queryDB = async (query) => {
    let kq = "";    
    try {
      
      await sql.connect(config);
      //await sql.connect('Server=192.168.1.2,5005;Database=CMS_VINA;User Id=sa;Password=*11021201$; MultipleActiveResultSets=True; Encrypt=false');      
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
    //sql.close();
    return kq;    
  };

  const process_api = async function(command) {
    
    if(command ==='1')
    {
      let setpdQuery = `SELECT WORK_STATUS_CODE FROM ZTBEMPLINFO WHERE EMPL_NO='NHU1903'`;
      console.log(setpdQuery);
      checkkq = await queryDB(setpdQuery);
      console.log(checkkq)

    }
    else if(command ==='2')
    {
      let setpdQuery = `SELECT WORK_STATUS_CODE FROM ZTBEMPLINFO WHERE EMPL_NO='YHK1906'`;
      console.log(setpdQuery);
      checkkq = await queryDB(setpdQuery);
      console.log(checkkq)

    }
    else if(command ==='3')
    {
      let setpdQuery = `SELECT WORK_STATUS_CODE FROM ZTBEMPLINFO WHERE EMPL_NO='NHU1903'`;
      console.log(setpdQuery);
      checkkq = await queryDB(setpdQuery);
      console.log(checkkq)      
    }
   /*  switch(command) {
      case '1':        
        setpdQuery = `SELECT WORK_STATUS_CODE FROM ZTBEMPLINFO WHERE EMPL_NO='NHU1903'`;
        console.log(setpdQuery);
        checkkq = await queryDB(setpdQuery);
        console.log(checkkq)
        break;
      case '2':      
      
      console.log(setpdQuery);
      checkkq = await queryDB(setpdQuery);
      console.log(checkkq)
      break;
      case '3':      
      
      console.log(setpdQuery);
      checkkq = await queryDB(setpdQuery);
      console.log(checkkq)
      break;
    } */
  }

  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');
  process_api('1');
  process_api('2');
  process_api('3');


