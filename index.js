const express = require("express");
const http = require("http");
const https = require("https");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const crypto = require("crypto");
require("dotenv").config();
const { closePool } = require("./config/database");
const { sslConfig } = require("./config/ssl");
const socketHandler = require("./socket/socketHandler");
const authRoutes = require("./routes/auth");
const fileUploadRoutes = require("./routes/fileUpload");
const apiRoutes = require("./routes/api");
const apiVendorsRoutes = require("./routes/apivendors");
const csharpRoutes = require("./routes/csharp");
const { corsOptions } = require("./config/env");  
const pushUtil = require("./utils/pushUtils");
const app = express();
const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslConfig, app);
// Middleware
app.use(compression({ level: 9, threshold: 10 * 1024 }));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "25mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "25mb" }));
// Routes
app.use("/login", authRoutes);
app.use("/uploadfile", fileUploadRoutes);
app.use("/api", apiRoutes);
app.use("/apivendors", apiVendorsRoutes);
app.use("/csharp", csharpRoutes);
// Socket.IO
socketHandler(httpServer, httpsServer);
const API_PORT = parseInt(process.env.API_PORT);
const SOCKET_PORT = parseInt(process.env.SOCKET_PORT);
httpServer.listen(API_PORT, () => console.log(`Server listening on ${API_PORT}`));
httpsServer.listen(SOCKET_PORT, () => console.log(`Socket listening on ${SOCKET_PORT}`));
// Xử lý lỗi toàn cục
process.on("uncaughtException", (error) => {
  console.log("Uncaught Exception:", error);
});
// Đóng pool khi server dừng
process.on("SIGINT", async () => {
  await closePool();
  httpServer.close(() => console.log("HTTP server closed"));
  httpsServer.close(() => console.log("HTTPS server closed"));
  process.exit(0);
});
pushUtil.setVapidDetails();

