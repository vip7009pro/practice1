/**
 * Test Phase 6 — Realtime: `emailSync` (lấy email mới hơn mốc) + phát `email:state` khi đọc/sao.
 *
 * Chạy: node scratch/test_mail_realtime.js
 */
const http = require("http");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.resolve(__dirname, "..", "outbinary", ".ENV") });
require("dotenv").config();

const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT || 3007);

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass += 1;
    console.log(`  ✔ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✘ ${name} ${extra}`);
  }
};

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: pathname,
        method,
        headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {},
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const token = jwt.sign(
  { payload: JSON.stringify([{ EMPL_NO: "NHU1903", CTR_CD: "002", CMS_ID: "CMS0001" }]) },
  "nguyenvanhung",
  { expiresIn: "1h" }
);
const api = async (command, DATA = {}) =>
  JSON.parse((await request("POST", "/api", { command, DATA: { ...DATA, token_string: token, secureContext: false } })).body);

async function main() {
  const mailRepo = require("../services/mail/mailRepository");
  const msgRepo = require("../services/mail/mailMessageRepository");
  const socketHandler = require("../socket/socketHandler");

  console.log("\n=== PHASE 6 TEST: realtime ===\n");

  console.log("[1] emailSync không có SINCE ⇒ lấy mới nhất + unreadTotal");
  const base = await api("emailSync", { FOLDER: "INBOX", LIMIT: 5 });
  check("tk_status OK", base.tk_status === "OK", JSON.stringify(base).slice(0, 160));
  const baseMsgs = base.data?.messages || [];
  check("có email", baseMsgs.length > 0, `(${baseMsgs.length})`);
  check("có unreadTotal", typeof base.data?.unreadTotal === "number", String(base.data?.unreadTotal));
  check("có mốc latest", !!base.data?.latest?.receivedAt && !!base.data?.latest?.id, JSON.stringify(base.data?.latest));

  console.log("[2] emailSync với SINCE = latest ⇒ không có email mới hơn");
  const same = await api("emailSync", { FOLDER: "INBOX", LIMIT: 5, SINCE: base.data.latest });
  check("trả 0 email", (same.data?.messages || []).length === 0, `(${(same.data?.messages || []).length})`);

  console.log("[3] Thêm 1 email mới ⇒ emailSync(SINCE cũ) phải thấy nó");
  const account = await mailRepo.queryOne(`SELECT TOP 1 ID, CTR_CD FROM ZTB_MAIL_ACCOUNT WHERE CTR_CD = '002' AND IS_ACTIVE = 1 ORDER BY ID`);
  const injectedId = await mailRepo.withTransaction((tx) =>
    msgRepo.insertMessage(tx, {
      mailAccountId: account.ID,
      folder: "INBOX",
      messageId: `<realtime-${Date.now()}@test.local>`,
      fromAddress: "realtime@test.local",
      fromName: "Realtime Test",
      subject: "Email realtime mới",
      bodyInline: "<p>nội dung mới</p>",
      previewText: "nội dung mới",
      sentAt: new Date(),
      receivedAt: new Date(),
    })
  );
  check("đã chèn email test", Number.isInteger(injectedId) && injectedId > 0, String(injectedId));

  const after = await api("emailSync", { FOLDER: "INBOX", LIMIT: 20, SINCE: base.data.latest });
  const ids = (after.data?.messages || []).map((m) => m.id);
  check("thấy email mới vừa chèn", ids.includes(injectedId), `ids=${ids.slice(0, 5)}`);
  check("không trả email cũ hơn mốc", (after.data?.messages || []).every((m) => m.id !== baseMsgs[baseMsgs.length - 1]?.id));
  check("unreadTotal tăng", Number(after.data?.unreadTotal) >= Number(base.data?.unreadTotal), `${after.data?.unreadTotal} vs ${base.data?.unreadTotal}`);
  check("latest đã tiến lên", after.data?.latest?.id === injectedId, JSON.stringify(after.data?.latest));

  console.log("[4] Phát sự kiện realtime khi đọc / gắn sao");
  const originalEmit = socketHandler.emitToUsers;
  let captured = null;
  socketHandler.emitToUsers = (users, event, payload) => {
    captured = { users, event, payload };
  };
  try {
    const fakeReq = { payload_data: { EMPL_NO: "NHU1903", CTR_CD: "002" } };
    const run = (handler, DATA) =>
      new Promise((resolve) => {
        handler(fakeReq, { send: (payload) => resolve(payload) }, DATA);
      });

    const readRes = await run(require("../services/mail/mailService").emailMarkRead, { ID: injectedId, IS_READ: true });
    check("emailMarkRead trả OK", readRes.tk_status === "OK", JSON.stringify(readRes).slice(0, 140));
    check("phát `email:state` (đọc)", captured?.event === "email:state", JSON.stringify(captured));
    check("gửi đúng room người dùng", captured?.users?.[0] === "NHU1903", JSON.stringify(captured?.users));
    check("payload có messageId + isRead", captured?.payload?.messageId === injectedId && captured?.payload?.isRead === true, JSON.stringify(captured?.payload));

    captured = null;
    const starRes = await run(require("../services/mail/mailService").emailStar, { ID: injectedId, IS_STARRED: true });
    check("emailStar trả OK", starRes.tk_status === "OK", JSON.stringify(starRes).slice(0, 140));
    check("phát `email:state` (sao)", captured?.event === "email:state" && captured?.payload?.isStarred === true, JSON.stringify(captured?.payload));

    // Worker ingest xong ⇒ phải phát `email:new` tới đúng chủ mailbox (persist-before-emit).
    captured = null;
    require("../services/mail/mailIngest").emitNewEmail(
      { ID: 7, EMPL_NO: "NHU1903", EMAIL_ADDRESS: "nvh1903@cmsbando.com" },
      { imported: 3 }
    );
    check("phát `email:new` sau khi ingest", captured?.event === "email:new", JSON.stringify(captured));
    check("room là chủ mailbox", captured?.users?.[0] === "NHU1903", JSON.stringify(captured?.users));
    check(
      "payload có accountId/imported",
      captured?.payload?.accountId === 7 && captured?.payload?.imported === 3,
      JSON.stringify(captured?.payload)
    );
  } finally {
    socketHandler.emitToUsers = originalEmit;
  }

  console.log("[5] Dọn email test");
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_USERSTATE WHERE MESSAGE_ID = @ID`, { ID: injectedId });
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_MESSAGE WHERE ID = @ID`, { ID: injectedId });
  const gone = await mailRepo.queryOne(`SELECT COUNT(*) AS C FROM ZTB_MAIL_MESSAGE WHERE ID = @ID`, { ID: injectedId });
  check("đã xoá email test", Number(gone?.C) === 0, String(gone?.C));

  const { openConnection } = require("../config/database");
  (await openConnection()).close();

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
