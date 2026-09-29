/**
 * Khoanh vùng lỗi 400 ở polling POST:
 *  1) handshake GET rồi POST connect bằng chính sid vừa nhận (đường đi bình thường)
 *  2) POST với sid giả (xem dạng lỗi "Session ID unknown")
 *  3) kết nối transport=polling thuần (không upgrade websocket)
 *
 * Chạy: node scratch/test_polling.js
 */
const http = require("http");

function request(options, body) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on("error", (error) => resolve({ status: 0, body: String(error.message) }));
    if (body) req.write(body);
    req.end();
  });
}

const HOST = "localhost";
const PORT = 3007;
const COMMON = { host: HOST, port: PORT, path: "", method: "GET" };

async function main() {
  // 1) handshake
  const handshake = await request({
    ...COMMON,
    path: "/socket.io/?EIO=4&transport=polling",
  });
  console.log(`1) handshake GET -> ${handshake.status} ${String(handshake.body).slice(0, 90)}`);

  const sid = JSON.parse(handshake.body.replace(/^0/, "")).sid;

  // 2) POST connect packet bằng sid thật, kèm Origin giống trình duyệt
  const origin = "http://cmsvina4285.com:3001";
  const post = await request(
    {
      ...COMMON,
      method: "POST",
      path: `/socket.io/?EIO=4&transport=polling&sid=${sid}`,
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Content-Length": Buffer.byteLength("40"),
        Origin: origin,
      },
    },
    "40"
  );
  console.log(`2) POST connect (sid thật) -> ${post.status} ${String(post.body).slice(0, 120)}`);
  console.log(`   ACAO=${post.headers["access-control-allow-origin"]}`);

  // 3) POST với sid giả ⇒ so sánh dạng lỗi
  const bogus = await request(
    {
      ...COMMON,
      method: "POST",
      path: "/socket.io/?EIO=4&transport=polling&sid=BOGUS_SID_123",
      headers: { "Content-Type": "text/plain;charset=UTF-8", Origin: origin },
    },
    "40"
  );
  console.log(`3) POST sid giả -> ${bogus.status} ${String(bogus.body).slice(0, 120)}`);

  // 4) GET polling với sid giả (xem có cùng 400 không)
  const bogusGet = await request({
    ...COMMON,
    path: "/socket.io/?EIO=4&transport=polling&sid=BOGUS_SID_123",
  });
  console.log(`4) GET sid giả -> ${bogusGet.status} ${String(bogusGet.body).slice(0, 120)}`);
}

main().then(() => process.exit(0));
