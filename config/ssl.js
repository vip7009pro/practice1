const fs = require("fs");
require("dotenv").config();

let privateKey, certificate, ca_bundle;
try {
  privateKey = fs.readFileSync(process.env.SSL_PRIVATE_KEY, "utf8");
  certificate = fs.readFileSync(process.env.SSL_CERTIFICATE, "utf8");
  ca_bundle = fs.readFileSync(process.env.SSL_CA_BUNDLE, "utf8");
} catch (err) {
  console.log("SSL Error:", err.message);
}

module.exports = {
  sslConfig: { key: privateKey, cert: certificate, ca: ca_bundle },
};