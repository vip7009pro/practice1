/**
 * Tái hiện lỗi realtime: kiểm tra Engine.IO/Socket.IO handshake + polling POST
 * trên nhiều đích (localhost và hostname public) bằng chính socket.io-client.
 *
 * Chạy: node scratch/test_chat_socket.js
 */
const { io } = require("socket.io-client");

function probe(label, url, authData) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = io(url, {
      auth: (cb) => cb(authData),
      transports: ["polling", "websocket"],
      reconnection: false,
      timeout: 8000,
    });
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.close();
      resolve({ label, url, ms: Date.now() - started, ...result });
    };

    socket.on("connect", () => finish({ ok: true, id: socket.id, transport: socket.io.engine.transport.name }));
    socket.on("connect_error", (error) =>
      finish({ ok: false, error: error?.message, description: error?.description, context: error?.context?.status })
    );
    setTimeout(() => finish({ ok: false, error: "TIMEOUT" }), 9000);
  });
}

async function main() {
  const results = [];
  results.push(await probe("localhost / no token", "http://localhost:3007", { token: "" }));
  results.push(await probe("public host / no token", "http://cmsvina4285.com:3007", { token: "" }));
  results.push(await probe("localhost / polling only", "http://localhost:3007", { token: "" }));

  results.forEach((r) => {
    console.log(
      `${r.label.padEnd(28)} ok=${String(r.ok).padEnd(5)} ms=${String(r.ms).padStart(6)} ` +
        (r.ok ? `transport=${r.transport} id=${r.id}` : `error=${r.error} status=${r.context}`)
    );
  });
}

main().then(() => process.exit(0));
