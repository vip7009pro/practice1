const net = require("net");
const tls = require("tls");

async function probePort(host, port, useTls = false) {
  return new Promise((resolve) => {
    const s = useTls
      ? tls.connect({ host, port, rejectUnauthorized: false })
      : net.connect({ host, port });
    s.setTimeout(5000);
    s.on("connect", () => {
      console.log(`Port ${port} (tls=${useTls}): OPEN`);
      s.destroy();
      resolve(true);
    });
    s.on("secureConnect", () => {
      console.log(`Port ${port} (tls=${useTls}): OPEN & SECURE`);
      s.destroy();
      resolve(true);
    });
    s.on("timeout", () => {
      console.log(`Port ${port} (tls=${useTls}): TIMEOUT`);
      s.destroy();
      resolve(false);
    });
    s.on("error", (e) => {
      console.log(`Port ${port} (tls=${useTls}): ERROR ${e.message}`);
      resolve(false);
    });
  });
}

async function run() {
  console.log("Probing mail.cmsbando.com ports...");
  await probePort("mail.cmsbando.com", 110, false);
  await probePort("mail.cmsbando.com", 995, true);
  await probePort("mail.cmsbando.com", 25, false);
  await probePort("mail.cmsbando.com", 465, true);
  await probePort("mail.cmsbando.com", 587, false);
  process.exit(0);
}

run();
