const express = require("express");
var sql = require("mssql");
var denv = require('dotenv').config();
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: 1433,
    pool: {
        max:10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        trustServerCertificate: true
    },   
    requestTimeout: 300000
};


async function  getData()
{
    try{
        let pool = await sql.connect(config);
        let result1 = await  pool.request()
        .input('OUT_DATE',sql.Int, '20211130')
        .query('SELECT TOP 10 * FROM O302 WHERE OUT_DATE = @OUT_DATE');
        console.dir(result1.recordset);

    }
    catch(err)
    {
        console.log("Loi :" + err+ ' ');
    }
}

(async function(){
    await getData();
    console.log('xuat sau getData');
})();

sql.on('error',err=> {
    console.log("Loi sql: " + err);
});