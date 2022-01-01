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
//bulkInsert();


function asyncQuery2(queryString) {
    return new Promise((resolve, reject) => {
        sql.connect(config, (err) => {
            if (err) console.log(err);
            let sqlRequest = new sql.Request();
            sqlRequest.query(queryString, function (err, data) {
                if (err) {
                    console.log("co loi tron async " + err + ' ');
                    return reject(err + ' ');
                }
                return resolve('OK');
                
            });
        });
        
        
    }).catch((err) => {
        console.log("Loi dc catch 2: " + err + ' ');
    });
}


for(var i=0;i<100;i++)
{
    (async () => {
        let checkkq = "OK";
        let setpdQuery = "UPDATE CODE_PRICE_TEST SET PROD_PRICE=1111 WHERE G_CODE='7C04198A'";            
        checkkq = await asyncQuery2(setpdQuery);
        console.log(checkkq);  
        sql.close();      
    })()
}