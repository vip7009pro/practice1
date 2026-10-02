/**
 * Test Phase 7 — Web Push cho email mới + tắt/bật thông báo theo mailbox.
 *
 * Chạy: node scratch/test_mail_push.js
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

  console.log("\n=== PHASE 7 TEST: Web Push cho email mới ===\n");

  // Patch hạ tầng push/presence TRƯỚC khi require mailPush (module destructure lúc load).
  const presence = require("../socket/presence");
  let activeDevices = {};
  let connectedDevices = {};
  let onlineUsers = new Set();
  presence.getActiveDeviceIds = (emplNo) => activeDevices[String(emplNo).toUpperCase()] || [];
  presence.getConnectedDeviceIds = (emplNo) => connectedDevices[String(emplNo).toUpperCase()] || [];
  presence.isUserOnline = (emplNo) => onlineUsers.has(String(emplNo).toUpperCase());

  const pushService = require("../services/targetedPushService");
  let sent = [];
  pushService.sendTargetedPushNotification = async (payload) => {
    sent.push(payload);
  };

  const { pushNewEmail } = require("../services/mail/mailPush");
  const account = { ID: 7, CTR_CD: "002", EMPL_NO: "NHU1903", EMAIL_ADDRESS: "nvh1903@cmsbando.com" };
  const messages = [
    { ID: 9001, SUBJECT: "Báo giá mới nhất", FROM_NAME: "Nguyễn Văn A", FROM_ADDRESS: "a@cmsbando.com", PREVIEW_TEXT: "Nội dung xem trước" },
    { ID: 8999, SUBJECT: "Cũ hơn", FROM_NAME: "Nguyễn Văn A", FROM_ADDRESS: "a@cmsbando.com" },
  ];

  console.log("[1] Push cơ bản (không có thiết bị active)");
  sent = [];
  await pushNewEmail({ account, messages, imported: 2 });
  check("đã gọi push 1 lần", sent.length === 1, `(${sent.length})`);
  const payload = sent[0] || {};
  check("gửi đúng người nhận", payload.targetEmplNos?.[0] === "NHU1903", JSON.stringify(payload.targetEmplNos));
  check("url deep-link đúng email mới nhất", payload.url === "/?mail=9001", String(payload.url));
  check("tag gộp theo mailbox", payload.tag === "mail-7", String(payload.tag));
  check("data.type = MAIL_NEW", payload.data?.type === "MAIL_NEW" && payload.data?.messageId === "9001", JSON.stringify(payload.data));
  check("tiêu đề có số lượng email", /2 email mới/.test(String(payload.title)), String(payload.title));
  check("không loại trừ thiết bị nào", !payload.excludeDeviceIds || Object.keys(payload.excludeDeviceIds).length === 0, JSON.stringify(payload.excludeDeviceIds));

  console.log("[2] Có thiết bị đang ACTIVE ⇒ loại thiết bị đó khỏi push");
  sent = [];
  activeDevices = { NHU1903: ["dev-pc-1"] };
  await pushNewEmail({ account, messages: [messages[0]], imported: 1 });
  check("vẫn push (cho thiết bị khác)", sent.length === 1, `(${sent.length})`);
  check("loại đúng thiết bị active", JSON.stringify(sent[0]?.excludeDeviceIds) === JSON.stringify({ NHU1903: ["dev-pc-1"] }), JSON.stringify(sent[0]?.excludeDeviceIds));
  check("tiêu đề dạng 1 email", /Email mới từ/.test(String(sent[0]?.title)), String(sent[0]?.title));
  activeDevices = {};

  console.log("[3] Online nhưng KHÔNG có deviceId (client cũ) ⇒ không push");
  sent = [];
  onlineUsers = new Set(["NHU1903"]);
  connectedDevices = {};
  await pushNewEmail({ account, messages, imported: 1 });
  check("không gửi push", sent.length === 0, `(${sent.length})`);
  onlineUsers = new Set();

  console.log("[4] Mailbox dùng chung (EMPL_NO = null) ⇒ không push");
  sent = [];
  await pushNewEmail({ account: { ...account, EMPL_NO: null }, messages, imported: 1 });
  check("không gửi push", sent.length === 0, `(${sent.length})`);

  console.log("[5] Tắt thông báo cho mailbox ⇒ không push");
  await mailRepo.setMailMute({ ctrCd: "002", emplNo: "NHU1903", accountId: 7, muted: true });
  sent = [];
  await pushNewEmail({ account, messages, imported: 1 });
  check("không gửi push khi đã tắt", sent.length === 0, `(${sent.length})`);

  console.log("[6] API tắt/bật thông báo");
  const list1 = await api("emailMuteList");
  check("emailMuteList có mailbox 7", (list1.data?.mutedAccountIds || []).includes(7), JSON.stringify(list1.data));
  const boot = await api("emailBootstrap");
  check("emailBootstrap trả mutedAccountIds", (boot.data?.mutedAccountIds || []).includes(7), JSON.stringify(boot.data?.mutedAccountIds));

  const off = await api("emailMuteAccount", { ACCOUNT_ID: 7, MUTED: false });
  check("bật lại thông báo OK", off.data?.muted === false && !(off.data?.mutedAccountIds || []).includes(7), JSON.stringify(off.data));

  sent = [];
  await pushNewEmail({ account, messages, imported: 1 });
  check("push hoạt động lại sau khi bật", sent.length === 1, `(${sent.length})`);

  const bad = await api("emailMuteAccount", { ACCOUNT_ID: 999999, MUTED: true });
  check("mailbox không có quyền ⇒ NG", bad.tk_status === "NG", JSON.stringify(bad).slice(0, 140));

  console.log("[7] Dọn dữ liệu test");
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_MUTE WHERE EMPL_NO = 'NHU1903' AND MAIL_ACCOUNT_ID = 7`);
  const left = await mailRepo.queryRows(`SELECT COUNT(*) AS C FROM ZTB_MAIL_MUTE WHERE EMPL_NO = 'NHU1903'`);
  check("đã xoá cấu hình tắt thông báo test", Number(left[0]?.C) === 0, String(left[0]?.C));

  const { openConnection } = require("../config/database");
  (await openConnection()).close();

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
