/**
 * Test Phase 5 — Tìm kiếm email server-side (emailSearch).
 *
 * Chạy: node scratch/test_mail_search.js
 */
const http = require("http");
const jwt = require("jsonwebtoken");

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

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: HOST, port: PORT, path, method, headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {} },
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

const search = async (DATA) => {
  const res = await request("POST", "/api", {
    command: "emailSearch",
    DATA: { ...DATA, token_string: token, secureContext: false },
  });
  return JSON.parse(res.body);
};

async function main() {
  console.log("\n=== PHASE 5 TEST: tìm kiếm email ===\n");

  console.log("[1] Từ khoá tự do");
  const all = await search({ FOLDER: "ALL", LIMIT: 5, INCLUDE_COUNT: true });
  check("tk_status OK", all.tk_status === "OK", JSON.stringify(all).slice(0, 160));
  check("trả về mảng messages", Array.isArray(all.data?.messages), JSON.stringify(all.data).slice(0, 120));
  check("có total", typeof all.data?.total === "number", `(${all.data?.total})`);
  check("đo được thời gian (tookMs)", typeof all.data?.tookMs === "number");

  const anySubjectWord = String(all.data?.messages?.[0]?.subject || "").split(/\s+/).find((w) => w.length >= 4);
  if (anySubjectWord) {
    const byWord = await search({ TERMS: [anySubjectWord], FOLDER: "ALL", LIMIT: 10 });
    check(`tìm theo từ khoá "${anySubjectWord}" ⇒ có kết quả`, (byWord.data?.messages || []).length > 0);
    const subjects = (byWord.data?.messages || []).map((m) => String(m.subject || "").toLowerCase());
    check(
      "mọi kết quả chứa từ khoá",
      subjects.every((s) => s.includes(anySubjectWord.toLowerCase()))
    );
  }

  console.log("[2] Lọc theo trường");
  const withAttach = await search({ HAS_ATTACHMENT: true, FOLDER: "ALL", LIMIT: 20 });
  check("lọc có đính kèm", (withAttach.data?.messages || []).every((m) => m.hasAttachment === true));

  const unread = await search({ IS_UNREAD: true, FOLDER: "ALL", LIMIT: 20 });
  check("lọc chưa đọc", (unread.data?.messages || []).every((m) => m.isRead === false));

  const starred = await search({ IS_STARRED: true, FOLDER: "ALL", LIMIT: 20 });
  check("lọc có gắn sao", (starred.data?.messages || []).every((m) => m.isStarred === true));

  const sender = String(all.data?.messages?.[0]?.from?.address || "");
  if (sender) {
    const byFrom = await search({ FROM: sender, FOLDER: "ALL", LIMIT: 10 });
    check(`lọc theo người gửi "${sender}"`, (byFrom.data?.messages || []).length > 0);
  }

  console.log("[3] Tìm theo tên tệp đính kèm");
  const fn = await search({ FILENAME: ".pdf", FOLDER: "ALL", LIMIT: 10 });
  const fn2 = await search({ FILENAME: "image", FOLDER: "ALL", LIMIT: 10 });
  check("lọc theo tên tệp chạy được", fn.tk_status === "OK" && fn2.tk_status === "OK");

  console.log("[4] Lọc theo khoảng thời gian");
  const since2020 = await search({ AFTER: "2020-01-01", FOLDER: "ALL", LIMIT: 10 });
  check("AFTER 2020-01-01 có kết quả", (since2020.data?.messages || []).length > 0);
  const ancient = await search({ BEFORE: "2000-01-01", FOLDER: "ALL", LIMIT: 10 });
  check("BEFORE 2000-01-01 không có kết quả", (ancient.data?.messages || []).length === 0, `(${(ancient.data?.messages || []).length})`);

  console.log("[5] Sắp xếp");
  const newest = await search({ FOLDER: "ALL", LIMIT: 10, SORT: "newest" });
  const oldest = await search({ FOLDER: "ALL", LIMIT: 10, SORT: "oldest" });
  const n0 = new Date(newest.data?.messages?.[0]?.receivedAt || 0).getTime();
  const o0 = new Date(oldest.data?.messages?.[0]?.receivedAt || 0).getTime();
  check("newest mới hơn oldest", n0 >= o0, `(${n0} vs ${o0})`);

  console.log("[6] Phân trang");
  const p1 = await search({ FOLDER: "ALL", LIMIT: 3, SORT: "newest" });
  check("trang 1 đúng 3 email", (p1.data?.messages || []).length === 3, `(${(p1.data?.messages || []).length})`);
  check("hasMore = true khi còn dữ liệu", p1.data?.hasMore === true);
  const cursor = p1.data?.nextCursor;
  check("có nextCursor", !!cursor?.receivedAt && !!cursor?.id, JSON.stringify(cursor));
  if (cursor) {
    const p2 = await search({ FOLDER: "ALL", LIMIT: 3, SORT: "newest", CURSOR: cursor });
    const ids1 = new Set((p1.data.messages || []).map((m) => m.id));
    const overlap = (p2.data?.messages || []).filter((m) => ids1.has(m.id));
    check("trang 2 không trùng trang 1", overlap.length === 0, `(trùng ${overlap.length})`);
    const last1 = new Date(p1.data.messages?.[2]?.receivedAt || 0).getTime();
    const first2 = new Date(p2.data?.messages?.[0]?.receivedAt || 0).getTime();
    check("trang 2 cũ hơn hoặc bằng trang 1", first2 <= last1);
  }

  const off1 = await search({ FOLDER: "ALL", LIMIT: 3, SORT: "subject", OFFSET: 0 });
  const off2 = await search({ FOLDER: "ALL", LIMIT: 3, SORT: "subject", OFFSET: 3 });
  check("phân trang bằng OFFSET trả dữ liệu", (off1.data?.messages || []).length > 0 && off2.tk_status === "OK");

  console.log("[7] Ký tự đặc biệt của LIKE không gây lỗi/lộ toàn bộ");
  for (const tricky of ["%", "_", "[", "%[%", "'"]) {
    const res = await search({ TERMS: [tricky], FOLDER: "ALL", LIMIT: 5 });
    check(`từ khoá "${tricky}" an toàn`, res.tk_status === "OK", JSON.stringify(res).slice(0, 140));
  }

  console.log("[8] Cách ly theo công ty");
  const otherToken = jwt.sign(
    { payload: JSON.stringify([{ EMPL_NO: "ZTEST99", CTR_CD: "OTHERCTR", CMS_ID: "OTHER001" }]) },
    "nguyenvanhung",
    { expiresIn: "1h" }
  );
  const otherRes = JSON.parse(
    (await request("POST", "/api", { command: "emailSearch", DATA: { FOLDER: "ALL", token_string: otherToken, secureContext: false } })).body
  );
  check("công ty khác ⇒ 0 kết quả", (otherRes.data?.messages || []).length === 0, `(${(otherRes.data?.messages || []).length})`);

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
