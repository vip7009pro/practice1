const sql = require("mssql/msnodesqlv8");
require('dotenv').config();
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  trustServerCertificate: true,
  requestTimeout: 10000,
  driver:'msnodesqlv8'
};
