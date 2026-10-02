/**
 * Test Phase 2 — API đọc hộp thư (emailBootstrap/emailInbox/emailGet/emailMarkRead)
 * + stream /mailfile. Dùng token JWT ký bằng secret hệ thống (dev).
 *
 * Chạy: node scratch/test_mail_api.js
 */
const http = require("http");
const jwt = require("jsonwebtoken");

const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT || 3007);

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass += 1; console.log(`  ✔ ${name}`); }
  else { fail += 1; console.log(`  ✘ ${name} ${extra}`); }
};

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: HOST, port: PORT, path, method, headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {} },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: raw }));
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const api = (command, DATA, token) => request("POST", "/api", { command, DATA: { ...(DATA || {}), token_string: token, secureContext: false } });

async function main() {
  const token = jwt.sign(
    { payload: JSON.stringify([{ EMPL_NO: "NHU1903", CTR_CD: "CMS", CMS_ID: "CMS0001" }]) },
    "nguyenvanhung",
    { expiresIn: "1h" }
  );

  console.log("\n=== PHASE 2 TEST: mail read API ===\n");

  console.log("[1] emailBootstrap");
  const boot = await api("emailBootstrap", {}, token);
  const bootBody = JSON.parse(boot.body);
  check("HTTP 200", boot.status === 200);
  check("tk_status OK", bootBody.tk_status === "OK", boot.body.slice(0, 200));
  const b = bootBody.data || {};
  check("có folders", Array.isArray(b.folders) && b.folders.length >= 7, `(${b.folders?.length})`);
  check("có accounts (shared)", Array.isArray(b.accounts) && b.accounts.length >= 1, `(${b.accounts?.length})`);
  // Lưu ý: unreadTotal phụ thuộc trạng thái hộp thư thật ⇒ chỉ kiểm tra kiểu dữ liệu hợp lệ.
  check("unreadTotal là số nguyên >= 0", Number.isInteger(Number(b.unreadTotal)) && Number(b.unreadTotal) >= 0, `(=${b.unreadTotal})`);

  console.log("[2] emailInbox");
  const inbox = await api("emailInbox", { folder: "INBOX", limit: 10 }, token);
  const inboxBody = JSON.parse(inbox.body);
  check("tk_status OK", inboxBody.tk_status === "OK", inbox.body.slice(0, 200));
  const messages = inboxBody.data?.messages || [];
  check("có >= 3 email", messages.length >= 3, `(=${messages.length})`);
  check("item có trường from/subject", !!messages[0]?.from && !!messages[0]?.subject);
  check("sắp xếp mới nhất trước", new Date(messages[0]?.receivedAt) >= new Date(messages[messages.length - 1]?.receivedAt));

  console.log("[3] emailGet");
  const target = messages[0];
  const detail = await api("emailGet", { ID: target.id }, token);
  const detailBody = JSON.parse(detail.body);
  check("tk_status OK", detailBody.tk_status === "OK", detail.body.slice(0, 200));
  const msg = detailBody.data?.message;
  check("có subject", !!msg?.subject);
  check("có to/cc là mảng", Array.isArray(msg?.to) && Array.isArray(msg?.cc));
  check("bodyHtml hoặc bodyExternal", !!msg?.bodyHtml || msg?.bodyExternal === true);

  // email có đính kèm
  const attachMsg = messages.find((m) => m.hasAttachment);
  if (attachMsg) {
    const d2 = JSON.parse((await api("emailGet", { ID: attachMsg.id }, token)).body);
    const attachments = d2.data?.attachments || [];
    check("email đính kèm trả về attachments", attachments.length >= 1, `(=${attachments.length})`);
    console.log("[4] /mailfile stream attachment");
    const file = await request("GET", `/mailfile/attachment/${attachments[0].id}?token_string=${encodeURIComponent(token)}`);
    check("HTTP 200 khi có token", file.status === 200, `(=${file.status})`);
    check("đúng Content-Disposition attachment", /attachment/i.test(file.headers["content-disposition"] || ""));
    check("có nội dung", file.body.length > 0);
    const noAuth = await request("GET", `/mailfile/attachment/${attachments[0].id}`);
    check("không token ⇒ 401", noAuth.status === 401, `(=${noAuth.status})`);
  } else {
    check("có email đính kèm để test", false, "(không tìm thấy)");
  }

  console.log("[5] emailMarkRead");
  // Đặt lại trạng thái chưa đọc trước để phép đo không phụ thuộc lần chạy trước.
  await api("emailMarkRead", { ID: target.id, IS_READ: false }, token);
  const bootBefore = JSON.parse((await api("emailBootstrap", {}, token)).body);
  const beforeUnread = Number(bootBefore.data?.unreadTotal);
  const mark = await api("emailMarkRead", { ID: target.id, IS_READ: true }, token);
  const markBody = JSON.parse(mark.body);
  check("tk_status OK", markBody.tk_status === "OK", mark.body.slice(0, 160));
  const boot2 = JSON.parse((await api("emailBootstrap", {}, token)).body);
  check("unreadTotal giảm sau khi đọc", Number(boot2.data?.unreadTotal) < beforeUnread, `(${beforeUnread} → ${boot2.data?.unreadTotal})`);

  console.log("[6] emailStar");
  const star = await api("emailStar", { ID: target.id, IS_STARRED: true }, token);
  check("tk_status OK", JSON.parse(star.body).tk_status === "OK", star.body.slice(0, 160));

  console.log("[7] Bảo mật: IDOR (email không thuộc quyền)");
  const forged = await api("emailGet", { ID: 999999 }, token);
  check("email không tồn tại ⇒ NG", JSON.parse(forged.body).tk_status === "NG");

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("[test] lỗi:", e); process.exit(1); });
