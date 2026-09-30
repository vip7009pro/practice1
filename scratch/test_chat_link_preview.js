/**
 * Kiểm chứng link preview chat (command `chatLinkPreview`).
 *
 * - Lấy được metadata OG của 1 trang công khai.
 * - CHẶN SSRF: localhost / IP nội bộ / scheme lạ.
 * - Có cache: gọi lần 2 nhanh hơn nhiều.
 *
 * Chạy: node scratch/test_chat_link_preview.js
 */
const jwt = require("jsonwebtoken");

const API = process.env.CHAT_TEST_API || "http://localhost:3007/api";
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

function makeToken(ctrCd, emplNo) {
  return jwt.sign(
    { payload: JSON.stringify([{ CTR_CD: ctrCd, EMPL_NO: emplNo, WORK_STATUS_CODE: 1 }]) },
    SECRET,
    { expiresIn: "24h" }
  );
}

async function callApi(token, command, data = {}) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secureContext: false,
      command,
      DATA: { ...data, token_string: token, COMPANY: "CMS" },
    }),
  });
  return response.json();
}

const PUBLIC_URL = process.env.CHAT_TEST_URL || "https://vnexpress.net";

async function main() {
  const token = makeToken("002", "NHU1903");

  console.log(`1) Lấy preview cho trang công khai (${PUBLIC_URL})`);
  const started = Date.now();
  const first = await callApi(token, "chatLinkPreview", { url: PUBLIC_URL });
  const firstMs = Date.now() - started;
  check("Trả OK", String(first.tk_status).toUpperCase() === "OK", first.message || "");
  check("Có tiêu đề", Boolean(first?.data?.title), JSON.stringify(first?.data?.title || ""));
  check("Có tên site", Boolean(first?.data?.siteName), first?.data?.siteName || "");
  check("URL trả về là http(s)", /^https?:\/\//.test(first?.data?.url || ""), first?.data?.url || "");
  console.log(`       (lần 1: ${firstMs}ms)`);

  console.log("\n2) Cache: gọi lại cùng URL phải nhanh hơn");
  const started2 = Date.now();
  const second = await callApi(token, "chatLinkPreview", { url: PUBLIC_URL });
  const secondMs = Date.now() - started2;
  check("Trả OK", String(second.tk_status).toUpperCase() === "OK");
  check("Dữ liệu khớp lần trước", second?.data?.title === first?.data?.title);
  check("Nhanh hơn lần đầu", secondMs < firstMs, `${secondMs}ms < ${firstMs}ms`);

  console.log("\n3) Chặn SSRF");
  const blocked = [
    ["http://localhost:3007/", "localhost"],
    ["http://127.0.0.1:3007/", "127.0.0.1"],
    ["http://192.168.1.2/", "192.168.1.2"],
    ["http://169.254.169.254/latest/meta-data/", "metadata cloud"],
    ["file:///C:/Windows/win.ini", "scheme file"],
    ["javascript:alert(1)", "scheme javascript"],
  ];
  for (const [url, label] of blocked) {
    const res = await callApi(token, "chatLinkPreview", { url });
    check(`Chặn ${label}`, String(res.tk_status).toUpperCase() === "NG", res.message || "");
  }

  console.log("\n4) Đầu vào không hợp lệ");
  const empty = await callApi(token, "chatLinkPreview", { url: "" });
  check("Thiếu URL ⇒ NG", String(empty.tk_status).toUpperCase() === "NG", empty.message || "");

  console.log(`\n[link-preview] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("[link-preview] FAIL:", error?.message || error);
  process.exit(1);
});
