/**
 * Test Phase 8 (mở rộng) — Nhập hàng loạt mailbox từ Excel (emailAccountImport) + Đồng bộ hàng loạt.
 *
 * Chạy: node scratch/test_mail_bulk.js
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

function request(pathname, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { host: HOST, port: PORT, path: pathname, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const adminToken = jwt.sign(
  { payload: JSON.stringify([{ EMPL_NO: "NHU1903", CTR_CD: "002", CMS_ID: "CMS0001", JOB_NAME: "Leader" }]) },
  "nguyenvanhung",
  { expiresIn: "1h" }
);
const staffToken = jwt.sign(
  { payload: JSON.stringify([{ EMPL_NO: "ZTEST01", CTR_CD: "002", CMS_ID: "CMS9999", JOB_NAME: "Staff" }]) },
  "nguyenvanhung",
  { expiresIn: "1h" }
);
const api = async (command, DATA = {}, token = adminToken) =>
  JSON.parse((await request("/api", { command, DATA: { ...DATA, token_string: token, secureContext: false } })).body);

const TEST_EMAIL = "import-test-001@cmsvina.local";

async function main() {
  const mailRepo = require("../services/mail/mailRepository");
  const mailCrypto = require("../services/mail/mailCrypto");

  console.log("\n=== TEST: nhập mailbox hàng loạt + đồng bộ hàng loạt ===\n");

  // Dọn dữ liệu test cũ (nếu có) để chạy lại được nhiều lần.
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @EMAIL`, { EMAIL: TEST_EMAIL });

  console.log("[1] Kiểm tra trước (DRY_RUN) — KHÔNG ghi dữ liệu");
  // Cột tiếng Việt như tệp mẫu + 1 dòng lỗi + 1 dòng thiếu host.
  const rows = [
    {
      "MÃ NV": "nhu1903",
      EMAIL: TEST_EMAIL,
      "TÊN HIỂN THỊ": "Nhập hàng loạt",
      "MÁY CHỦ POP3": "mail.cmsvina.local",
      "CỔNG POP3": "995",
      SSL: "x",
      USERNAME: TEST_EMAIL,
      PASSWORD: "secret123",
      IS_ACTIVE: "x",
      "DÙNG CHUNG": "",
    },
    { "MÃ NV": "NVH1011", EMAIL: "sai-dinh-dang", "MÁY CHỦ POP3": "mail.cmsvina.local", PASSWORD: "x" },
    { "MÃ NV": "NVH1011", EMAIL: "thieu-host@cmsvina.local", PASSWORD: "x" },
    { EMAIL: "dung-chung@cmsvina.local", "MÁY CHỦ POP3": "mail.cmsvina.local", "DÙNG CHUNG": "x", PASSWORD: "x" },
  ];
  const dry = await api("emailAccountImport", { ROWS: rows, DRY_RUN: true });
  check("tk_status OK", dry.tk_status === "OK", JSON.stringify(dry).slice(0, 160));
  check("total = 4", dry.data?.total === 4, String(dry.data?.total));
  check("dryRun = true", dry.data?.dryRun === true);
  check("KHÔNG tạo tài khoản nào", (dry.data?.created || 0) === 0 && (dry.data?.updated || 0) === 0, JSON.stringify(dry.data).slice(0, 140));
  check("báo 2 dòng lỗi (email sai + thiếu host)", (dry.data?.errors || []).length === 2, JSON.stringify(dry.data?.errors));
  const dbAfterDry = await mailRepo.findAccountByEmail({ ctrCd: "002", emailAddress: TEST_EMAIL });
  check("chưa ghi vào DB", !dbAfterDry);

  console.log("[2] Nhập thật — tạo mới");
  const imported = await api("emailAccountImport", { ROWS: rows });
  check("tk_status OK", imported.tk_status === "OK", JSON.stringify(imported).slice(0, 160));
  check("created = 2 (nhân viên + dùng chung)", imported.data?.created === 2, JSON.stringify({ created: imported.data?.created, updated: imported.data?.updated, skipped: imported.data?.skipped }));
  check("skipped = 2 (2 dòng lỗi)", imported.data?.skipped === 2, String(imported.data?.skipped));
  check("có ID tài khoản trả về", (imported.data?.accounts || []).some((a) => !!a.id));

  const created = await mailRepo.findAccountByEmail({ ctrCd: "002", emailAddress: TEST_EMAIL });
  check("đã có trong DB", !!created?.ID, JSON.stringify(created || {}).slice(0, 80));
  check("EMPL_NO viết hoa đúng", String(created?.EMPL_NO || "").trim() === "NHU1903", String(created?.EMPL_NO));
  check("POP3 host/port đúng", created?.POP3_HOST === "mail.cmsvina.local" && Number(created?.POP3_PORT) === 995, `${created?.POP3_HOST}:${created?.POP3_PORT}`);

  // Cột credential KHÔNG nằm trong danh sách cột trả về (an toàn) ⇒ đọc trực tiếp để kiểm chứng.
  const cred = await mailRepo.queryOne(
    `SELECT POP3_CRED_ENC, SMTP_CRED_ENC FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`,
    { ID: created.ID }
  );
  check("mật khẩu được mã hoá (không plaintext)", !!cred?.POP3_CRED_ENC && !String(cred.POP3_CRED_ENC).includes("secret123"), String(cred?.POP3_CRED_ENC || "").slice(0, 24));
  const decrypted = mailCrypto.decryptSecret(cred?.POP3_CRED_ENC);
  check("giải mã lại đúng mật khẩu", decrypted === "secret123", String(decrypted));

  const checkpoint = await mailRepo.queryOne(
    `SELECT COUNT(*) AS C FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @ID`,
    { ID: created.ID }
  );
  check("đã khởi tạo con trỏ đồng bộ", Number(checkpoint?.C) === 1, String(checkpoint?.C));

  console.log("[3] Nhập lại — cập nhật, KHÔNG tạo trùng + giữ mật khẩu cũ khi để trống");
  const second = await api("emailAccountImport", {
    ROWS: [
      {
        "MÃ NV": "NHU1903",
        EMAIL: TEST_EMAIL,
        "TÊN HIỂN THỊ": "Đã đổi tên",
        "MÁY CHỦ POP3": "mail.cmsvina.local",
        "CỔNG POP3": "110",
        SSL: "",
        USERNAME: TEST_EMAIL,
        PASSWORD: "",
        IS_ACTIVE: "x",
      },
    ],
  });
  check("updated = 1, created = 0", second.data?.updated === 1 && second.data?.created === 0, JSON.stringify(second.data).slice(0, 140));
  const again = await mailRepo.findAccountByEmail({ ctrCd: "002", emailAddress: TEST_EMAIL });
  check("vẫn chỉ 1 bản ghi", again?.ID === created.ID, `${again?.ID} vs ${created.ID}`);
  check("đã cập nhật tên hiển thị", again?.DISPLAY_NAME === "Đã đổi tên", String(again?.DISPLAY_NAME));
  check("cập nhật cổng POP3 + SSL (110 ⇒ không SSL)", Number(again?.POP3_PORT) === 110 && (again?.POP3_SECURE === false || again?.POP3_SECURE === 0), `${again?.POP3_PORT}/${again?.POP3_SECURE}`);
  const credAfter = await mailRepo.queryOne(`SELECT POP3_CRED_ENC FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: created.ID });
  check("mật khẩu cũ được giữ khi cột PASSWORD trống", mailCrypto.decryptSecret(credAfter?.POP3_CRED_ENC) === "secret123");

  const dupCount = await mailRepo.queryOne(
    `SELECT COUNT(*) AS C FROM ZTB_MAIL_ACCOUNT WHERE CTR_CD = '002' AND EMAIL_ADDRESS = @EMAIL`,
    { EMAIL: TEST_EMAIL }
  );
  check("không có bản ghi trùng", Number(dupCount?.C) === 1, String(dupCount?.C));

  console.log("[4] Cảnh báo mã nhân viên không có trong hồ sơ + trùng email trong tệp");
  const warn = await api("emailAccountImport", {
    DRY_RUN: true,
    ROWS: [
      { "MÃ NV": "KHONGTONTAI999", EMAIL: "warn1@cmsvina.local", "MÁY CHỦ POP3": "m.local", PASSWORD: "x" },
      { "MÃ NV": "NVH1011", EMAIL: "warn1@cmsvina.local", "MÁY CHỦ POP3": "m.local", PASSWORD: "x" },
    ],
  });
  const messages = (warn.data?.warnings || []).map((w) => w.message).join(" | ");
  check("cảnh báo mã NV không tồn tại", /không có trong hồ sơ nhân sự/.test(messages), messages);
  check("cảnh báo email trùng trong tệp", /trùng trong tệp/.test(messages), messages);

  console.log("[5] Chặn khi quá nhiều dòng");
  const tooMany = await api("emailAccountImport", { ROWS: new Array(2001).fill({ EMAIL: "x@y.z", "MÁY CHỦ POP3": "m" }) });
  check("vượt 2000 dòng ⇒ NG", tooMany.tk_status === "NG" && tooMany.code === "TOO_MANY_ROWS", JSON.stringify(tooMany).slice(0, 140));

  console.log("[6] Phân quyền + đầu vào rỗng");
  const denied = await api("emailAccountImport", { ROWS: rows }, staffToken);
  check("người thường bị chặn", denied.tk_status === "NG" && denied.code === "FORBIDDEN", JSON.stringify(denied).slice(0, 120));
  const deniedSync = await api("emailSyncAll", {}, staffToken);
  check("đồng bộ hàng loạt bị chặn với người thường", deniedSync.tk_status === "NG", JSON.stringify(deniedSync).slice(0, 120));
  const empty = await api("emailAccountImport", { ROWS: [] });
  check("không có dòng ⇒ NG", empty.tk_status === "NG", JSON.stringify(empty).slice(0, 120));

  console.log("[7] Đồng bộ hàng loạt — khởi động nền + trạng thái");
  const t0 = Date.now();
  const started = await api("emailSyncAll");
  check("tk_status OK", started.tk_status === "OK", JSON.stringify(started).slice(0, 160));
  check("trả về ngay (không chờ POP3)", Date.now() - t0 < 3000, `${Date.now() - t0}ms`);
  check("báo tổng số mailbox đang bật ≥ 1", Number(started.data?.total) >= 1, String(started.data?.total));
  check("đánh dấu đang chạy", started.data?.started === true && started.data?.running === true, JSON.stringify(started.data));

  const status = await api("emailSyncAllStatus");
  check("đọc được trạng thái", status.tk_status === "OK" && typeof status.data?.processed === "number", JSON.stringify(status.data));
  check("có mốc startedAt", !!status.data?.startedAt, String(status.data?.startedAt));
  const secondCall = await api("emailSyncAll");
  check("gọi lần 2 khi đang chạy ⇒ không khởi động lại", secondCall.data?.started === false, JSON.stringify(secondCall.data));

  console.log("[8] Dọn dữ liệu test");
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS IN (@A, @B, @C, @D)`, {
    A: TEST_EMAIL,
    B: "dung-chung@cmsvina.local",
    C: "warn1@cmsvina.local",
    D: "thieu-host@cmsvina.local",
  });
  const left = await mailRepo.queryOne(`SELECT COUNT(*) AS C FROM ZTB_MAIL_ACCOUNT WHERE EMAIL_ADDRESS = @EMAIL`, { EMAIL: TEST_EMAIL });
  check("đã xoá tài khoản test", Number(left?.C) === 0, String(left?.C));

  const { openConnection } = require("../config/database");
  (await openConnection()).close();

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
