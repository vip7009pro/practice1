/**
 * Test SELF-SERVICE mailbox: mỗi nhân viên tự cấu hình mail của mình.
 * Chạy: node scratch/test_mail_selfservice.js
 */
const http = require("http");
const jwt = require("jsonwebtoken");

const HOST = "127.0.0.1";
const PORT = Number(process.env.API_PORT || 3007);
const CTR = "002";
const EMPL = "NHU1903";

let pass = 0, fail = 0;
const check = (n, c, e = "") => { if (c) { pass++; console.log(`  ✔ ${n}`); } else { fail++; console.log(`  ✘ ${n} ${e}`); } };

function api(command, DATA, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ command, DATA: { ...(DATA || {}), token_string: token, secureContext: false } });
    const req = http.request(
      { host: HOST, port: PORT, path: "/api", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => { let raw = ""; res.on("data", (c) => (raw += c)); res.on("end", () => resolve(JSON.parse(raw))); }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const token = jwt.sign({ payload: JSON.stringify([{ EMPL_NO: EMPL, CTR_CD: CTR, CMS_ID: "CMS1179" }]) }, "nguyenvanhung", { expiresIn: "1h" });
  console.log("\n=== TEST SELF-SERVICE MAILBOX ===\n");
  const email = `selfservice-test-${Date.now()}@cmsvina.local`;

  // dọn trước nếu còn sót
  await api("emailDeleteMyAccount", {}, token).catch(() => undefined);

  console.log("[1] emailMyAccount (trước khi cấu hình)");
  const before = await api("emailMyAccount", {}, token);
  check("tk_status OK", before.tk_status === "OK", JSON.stringify(before).slice(0, 160));
  check("account = null", before.data?.account === null, JSON.stringify(before.data));

  console.log("[2] emailSaveMyAccount (tạo mới)");
  const save = await api("emailSaveMyAccount", {
    EMAIL_ADDRESS: email, DISPLAY_NAME: "Test self-service",
    POP3_HOST: "127.0.0.1", POP3_PORT: 1, POP3_SECURE: false, POP3_PASSWORD: "matkhau-test",
    IS_ACTIVE: false,
  }, token);
  check("tk_status OK", save.tk_status === "OK", JSON.stringify(save).slice(0, 200));
  const accountId = save.data?.id;
  check("trả về id", Number.isInteger(accountId) && accountId > 0, `(=${accountId})`);

  console.log("[3] emailMyAccount (sau khi cấu hình)");
  const after = await api("emailMyAccount", {}, token);
  const acc = after.data?.account;
  check("có account", !!acc);
  check("đúng email", acc?.emailAddress === email, `(=${acc?.emailAddress})`);
  check("hasPassword = true", acc?.hasPassword === true);
  const raw = JSON.stringify(acc || {});
  check("KHÔNG lộ mật khẩu/credential", !/POP3_PASSWORD|POP3_CRED_ENC|matkhau-test/i.test(raw), raw.slice(0, 120));

  console.log("[4] emailSaveMyAccount (cập nhật, không nhập mật khẩu)");
  const upd = await api("emailSaveMyAccount", {
    EMAIL_ADDRESS: email, DISPLAY_NAME: "Đổi tên", POP3_HOST: "127.0.0.1", POP3_PORT: 2, POP3_SECURE: false, IS_ACTIVE: false,
  }, token);
  check("tk_status OK", upd.tk_status === "OK", JSON.stringify(upd).slice(0, 200));
  check("giữ nguyên id (upsert)", upd.data?.id === accountId, `(${upd.data?.id} vs ${accountId})`);
  const after2 = await api("emailMyAccount", {}, token);
  check("mật khẩu cũ vẫn còn", after2.data?.account?.hasPassword === true);
  check("đổi được tên hiển thị", after2.data?.account?.displayName === "Đổi tên");

  console.log("[5] emailTestMyAccount (server không tồn tại ⇒ thất bại có thông báo)");
  const test = await api("emailTestMyAccount", { POP3_HOST: "127.0.0.1", POP3_PORT: 1, POP3_SECURE: false, POP3_USERNAME: "u", POP3_PASSWORD: "x" }, token);
  check("trả NG có message", test.tk_status === "NG" && !!test.message, JSON.stringify(test).slice(0, 160));

  console.log("[6] Email trùng ở mailbox khác ⇒ chặn");
  const dup = await api("emailSaveMyAccount", {
    EMAIL_ADDRESS: "demo-mailbox-002@cmsvina.local", POP3_HOST: "127.0.0.1", POP3_PASSWORD: "x", IS_ACTIVE: false,
  }, token);
  check("bị chặn DUPLICATE", dup.tk_status === "NG" && dup.code === "DUPLICATE", JSON.stringify(dup).slice(0, 160));

  console.log("[7] emailDeleteMyAccount (chưa có email ⇒ xoá được)");
  const del = await api("emailDeleteMyAccount", {}, token);
  check("tk_status OK", del.tk_status === "OK", JSON.stringify(del).slice(0, 160));
  const final = await api("emailMyAccount", {}, token);
  check("account về null", final.data?.account === null);

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("[test] lỗi:", e); process.exit(1); });
