const net = require("net");
const mailRepo = require("../services/mail/mailRepository");
const mailCrypto = require("../services/mail/mailCrypto");

async function run() {
  const account = await mailRepo.getAccountWithCredentials(7);
  const password = mailCrypto.decryptSecret(account.POP3_CRED_ENC);

  const socket = net.connect({ host: account.POP3_HOST, port: account.POP3_PORT });
  socket.setTimeout(25000);

  let state = "CONNECT";
  let totalDataReceived = 0;
  let chunkCount = 0;

  socket.on("connect", () => {
    console.log("TCP Connected");
  });

  socket.on("timeout", () => {
    console.error(`Socket TIMEOUT! Total bytes received so far: ${totalDataReceived}`);
    socket.destroy();
  });

  socket.on("error", (e) => {
    console.error("Socket error:", e);
  });

  socket.on("close", () => {
    console.log(`Socket closed. Total bytes received: ${totalDataReceived}, chunks: ${chunkCount}`);
    process.exit(0);
  });

  let buffer = "";
  socket.on("data", (chunk) => {
    totalDataReceived += chunk.length;
    chunkCount++;
    console.log(`[DATA] received chunk #${chunkCount}, len=${chunk.length}, total=${totalDataReceived}`);

    if (state === "RETR") {
      // In một ít data đầu hoặc cuối
      if (chunkCount <= 3 || totalDataReceived > 870000) {
        console.log(`Chunk preview: ${chunk.slice(0, 100).toString('latin1')} ... ${chunk.slice(-20).toString('latin1')}`);
      }
      return;
    }

    buffer += chunk.toString("utf8");
    const lines = buffer.split("\r\n");
    buffer = lines.pop(); // giữ lại phần chưa đủ dòng

    for (const line of lines) {
      console.log(`[S] ${line}`);
      if (state === "CONNECT" && line.startsWith("+OK")) {
        state = "USER";
        console.log(`[C] USER ${account.EMAIL_ADDRESS}`);
        socket.write(`USER ${account.EMAIL_ADDRESS}\r\n`);
      } else if (state === "USER" && line.startsWith("+OK")) {
        state = "PASS";
        console.log(`[C] PASS ******`);
        socket.write(`PASS ${password}\r\n`);
      } else if (state === "PASS" && line.startsWith("+OK")) {
        state = "RETR_HEADER";
        console.log(`[C] RETR 383`);
        socket.write(`RETR 383\r\n`);
        state = "RETR";
      }
    }
  });
}

run();
