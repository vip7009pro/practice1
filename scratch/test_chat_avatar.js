/**
 * Kiểm chứng upload avatar phòng chat (`POST /chatavatar`).
 *
 * Phủ các trường hợp đã gây lỗi 400 trên production:
 *  - ảnh bình thường (png / jpg)
 *  - đuôi lạ (.jfif) hoặc KHÔNG có đuôi, MIME vẫn là ảnh
 *  - ảnh HEIC/TIFF (không hiển thị được trên web) ⇒ phải báo RÕ, không phải lỗi chung
 *  - tệp không phải ảnh
 *  - tải lại ảnh vừa upload bằng GET /chatavatar/<file>
 *
 * Chạy: node scratch/test_chat_avatar.js
 */
const jwt = require("jsonwebtoken");

const API_BASE = process.env.CHAT_TEST_BASE || "http://localhost:3007";
const SECRET = "nguyenvanhung";

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function makeToken() {
  return jwt.sign(
    { payload: JSON.stringify([{ CTR_CD: "002", EMPL_NO: "NHU1903", WORK_STATUS_CODE: 1 }]) },
    SECRET,
    { expiresIn: "24h" }
  );
}

// PNG 1x1 trong suốt (đủ để nhận diện là ảnh thật).
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function upload(token, fileName, mimeType, bytes) {
  const formData = new FormData();
  formData.append("uploadedfile", new Blob([bytes], { type: mimeType }), fileName);
  formData.append("token_string", token);
  const response = await fetch(`${API_BASE}/chatavatar`, { method: "POST", body: formData });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function main() {
  const token = makeToken();
  const createdUrls = [];

  console.log("1) Ảnh hợp lệ");
  for (const [name, mime] of [
    ["avatar.png", "image/png"],
    ["avatar.jpg", "image/jpeg"],
    ["avatar.jfif", "image/jpeg"],
    ["avatar-khong-duoi", "image/jpeg"],
    ["avatar.PNG", "image/png"],
  ]) {
    const { status, json } = await upload(token, name, mime, PNG_BYTES);
    const ok = String(json?.tk_status).toUpperCase() === "OK";
    check(`${name} (${mime})`, ok, ok ? json.data.url : `${status} ${json.message || ""}`);
    if (ok && json?.data?.url) createdUrls.push(json.data.url);
  }

  console.log("\n2) Ảnh KHÔNG hiển thị được trên web ⇒ báo rõ ràng");
  for (const [name, mime] of [
    ["IMG_1234.HEIC", "image/heic"],
    ["scan.TIFF", "image/tiff"],
  ]) {
    const { status, json } = await upload(token, name, mime, PNG_BYTES);
    check(
      `${name} ⇒ NG + thông báo HEIC/TIFF`,
      String(json?.tk_status).toUpperCase() === "NG" && /HEIC|TIFF/i.test(json.message || ""),
      `${status} ${json.message || ""}`
    );
  }

  console.log("\n3) Tệp không phải ảnh ⇒ NG");
  const pdf = await upload(token, "tai-lieu.pdf", "application/pdf", Buffer.from("%PDF-1.4"));
  check(
    "tai-lieu.pdf",
    String(pdf.json?.tk_status).toUpperCase() === "NG",
    `${pdf.status} ${pdf.json.message || ""}`
  );

  console.log("\n4) Tải lại ảnh vừa upload");
  for (const url of createdUrls.slice(0, 3)) {
    const response = await fetch(`${API_BASE}${url}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    check(
      `GET ${url}`,
      response.status === 200 && buffer.length === PNG_BYTES.length,
      `${response.status}, ${buffer.length} byte`
    );
  }

  // ------------------------------------------------------------- dọn dẹp
  console.log("\n5) Dọn dẹp tệp test");
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const dirs = [
    path.join(process.cwd(), "outbinary", "chatavatars"),
    path.join(os.tmpdir(), "erp-chat-avatars"),
  ];
  process.env.CHAT_UPLOAD_FOLDER &&
    dirs.unshift(path.join(path.dirname(process.env.CHAT_UPLOAD_FOLDER), "chatavatars"));
  process.env.CHAT_AVATAR_FOLDER && dirs.unshift(process.env.CHAT_AVATAR_FOLDER);

  let removed = 0;
  for (const url of createdUrls) {
    const name = url.replace("/chatavatar/", "");
    for (const dir of dirs) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        removed += 1;
      }
    }
  }
  check("Đã xoá tệp test", removed >= createdUrls.length, `${removed}/${createdUrls.length} tệp`);

  console.log(`\n[chat-avatar] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("[chat-avatar] FAIL:", error?.message || error);
  process.exit(1);
});
