const express = require("express");
const http = require("http");
const https = require("https");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, 'outbinary', '.ENV') });
dotenv.config();
const { closePool } = require("./config/database");
const { sslConfig } = require("./config/ssl");
const socketHandler = require("./socket/socketHandler");
const authRoutes = require("./routes/auth");
const fileUploadRoutes = require("./routes/fileUpload");
const apiRoutes = require("./routes/api");
const aiRoutes = require("./routes/ai");
const apiVendorsRoutes = require("./routes/apivendors");
const csharpRoutes = require("./routes/csharp");
const { corsOptions } = require("./config/env");  
const pushUtil = require("./utils/pushUtils");
const { startSchemaScheduler } = require("./services/schemaScheduler");
const app = express();
const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslConfig, app);
const geoip = require('geoip-lite');
app.set("trust proxy", true);

httpServer.setTimeout(parseInt(process.env.SERVER_TIMEOUT_MS || "0", 100) || 100 * 60 * 1000);
httpServer.keepAliveTimeout = parseInt(process.env.KEEPALIVE_TIMEOUT_MS || "0", 100) || 100 * 60 * 1000;
httpServer.headersTimeout = parseInt(process.env.HEADERS_TIMEOUT_MS || "0", 100) || 110 * 60 * 1000;
//loc IP
const allowCountries = ['VN']; // Việt Nam
const GEOIP_BYPASS = true;

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const rawIp = (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0] : forwardedFor) || req.ip || req.socket.remoteAddress || '';
  return rawIp.replace(/^::ffff:/, '');
};

// Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  if (GEOIP_BYPASS) {
    return next();
  }

  const ip = getClientIp(req);

  const geo = geoip.lookup(ip);

  if (!geo || !allowCountries.includes(geo.country)) {
    return res.status(403).json({
      tk_status: 'NG',
      message: 'Access denied: country not allowed'
    });
  }

  next();
});
app.use(compression({ level: 9, threshold: 10 * 1024 }));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "25mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "25mb" }));
// Routes
app.use("/login", authRoutes);
app.use("/uploadfile", fileUploadRoutes);
app.use("/api", apiRoutes);
app.use("/ai", aiRoutes);
app.use("/apivendors", apiVendorsRoutes);
app.use("/csharp", csharpRoutes);
// Socket.IO
socketHandler(httpServer, httpsServer);

startSchemaScheduler().catch((e) => {
  console.log('[SchemaScheduler] failed to start', e?.message || e);
});
const API_PORT = parseInt(process.env.API_PORT);
const SOCKET_PORT = parseInt(process.env.SOCKET_PORT);
httpServer.listen(API_PORT, () => console.log(`Server listening on ${API_PORT}`));
httpsServer.listen(SOCKET_PORT, () => console.log(`Socket listening on ${SOCKET_PORT}`));
// Xử lý lỗi toàn cục
process.on("uncaughtException", (error) => {
  console.log("Uncaught Exception:", error);
});
process.on("unhandledRejection", (error) => {
  console.log("Unhandled Rejection:", error);
});
// Đóng pool khi server dừng
process.on("SIGINT", async () => {
  await closePool();
  httpServer.close(() => console.log("HTTP server closed"));
  httpsServer.close(() => console.log("HTTPS server closed"));
  process.exit(0);
});
pushUtil.setVapidDetails();

