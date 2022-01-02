var sql = require("mssql");
require('dotenv').config();
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    trustServerCertificate: true,
    requestTimeout: 300000
};

const bulkInsert = ()=>{
    sql.connect(config)
    .then(()=>{
        console.log("Conneted to SQL SERVER");
        const table = new sql.Table('CODE_PRICE_TEST');
        table.create = false;
        table.columns.add('G_CODE',sql.VarChar(10));
        table.columns.add('PROD_PRICE',sql.Float);
        table.rows.add('7C04198A',888);
        table.rows.add('7C04198A',888);
        table.rows.add('7C04198A',888);
        const request = new sql.Request();
        return request.bulk(table);
    
    })
    .then(data=>{
        console.log(data);
    })
    .catch(error=>{
        console.log(error);
    });
}


const bulkUpdate = async () => {
    try {
        await sql.connect(config);
        const result = await sql.query`UPDATE CODE_PRICE_TEST SET PROD_PRICE=1111 WHERE G_CODE='7C04198A'`;
        console.dir(result);
    }
    catch (err) {
        console.log(err);
    }
}

const selectQuery = async (query) => {
    let kq=''; 
    try {
        await sql.connect(config);
        const result = await sql.query(query);          
        if(result.rowsAffected[0]>0)      
        {
            if(result.recordset)
            {
                kq = {status:"OK", data: result.recordset};
            }
            else
            {
                kq = {status:"OK", message: "Modify data thanh cong"};
            }
            
        }
        else
        {
            kq = {status:"NG", message: "Không có dòng dữ liệu nào"};
        }
       
    }
    catch (err) {
        //console.log(err);
        kq = {status:"NG", message: err+' '};
        
    }    
    
    return kq;
}


const kkk =  async ()=>{
    let ketqua= '';
    console.log('cai nay ra truoc');
    ketqua = await  selectQuery(`SELECT TOP 0 * FROM ZTBE0MPLINFO`);
    console.log(ketqua);
    console.log('cai nay ra sau ');
}

//kkk();

for(var i=0;i<1;i++)
{
    (async ()=>{
        let qry1 = `UPDATE CODE_PRICE_TEST SET PROD_PRICE=1111 WHERE G_CODE='7C04198A'`;
        let qry2 = `SELECT TOP 1 * FROM  ZTBEMPLINFO`;
        let ketqua1 = await selectQuery(qry1);
        let ketqua2 = await selectQuery(qry2);
        
        console.log(ketqua1);
        console.log("___________________________");
        console.log(ketqua2);
    })()
}


