/**
 * Kiểm chứng tính năng "Chọn tất cả" (tạo phòng chat toàn công ty).
 *
 * KHÔNG tạo phòng thật: bước kiểm tra giới hạn thành viên dùng avatar KHÔNG hợp lệ
 * ⇒ service fail SAU khi đã qua bước kiểm tra số thành viên nhưng TRƯỚC khi INSERT.
 *
 * Chạy: node scratch/test_chat_select_all.js
 */
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

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

function makeToken(ctrCd, emplNo) {
  return jwt.sign(
    { payload: JSON.stringify([{ CTR_CD: ctrCd, EMPL_NO: emplNo, WORK_STATUS_CODE: 1 }]) },
    SECRET,
    { expiresIn: "24h" }
  );
}

async function main() {
  const pool = await openConnection();

  const admin = "NHU1903";
  const adminToken = makeToken("002", admin);

  const otherRow = await pool.query(
    `SELECT TOP 1 EMPL_NO FROM ZTBEMPLINFO
      WHERE ISNULL(WORK_STATUS_CODE,0) <> 0 AND LTRIM(RTRIM(EMPL_NO)) <> @ADMIN
      ORDER BY EMPL_NO`,
    { ADMIN: admin }
  );
  const other = String(otherRow.recordset[0].EMPL_NO).trim();
  const otherToken = makeToken("002", other);
  console.log(`[select-all] admin=${admin}  user thường=${other}\n`);

  // 1. Lấy toàn bộ nhân sự
  console.log("1) chatSearchEmployees { all: true } với tài khoản quản trị");
  const allRes = await callApi(adminToken, "chatSearchEmployees", { all: true });
  const all = allRes?.data || [];
  check("Trả OK", String(allRes.tk_status).toUpperCase() === "OK", allRes.message || "");
  check("Lấy được hơn 200 nhân sự (vượt giới hạn cũ)", all.length > 200, `${all.length} người`);
  check(
    "KHÔNG chứa chính mình",
    !all.some((e) => e.EMPL_NO === admin),
    all.some((e) => e.EMPL_NO === admin) ? "vẫn có " + admin : "ok"
  );
  check(
    "Mọi EMPL_NO đã được trim (không khoảng trắng đầu/cuối)",
    all.every((e) => e.EMPL_NO === String(e.EMPL_NO).trim()),
    all.filter((e) => e.EMPL_NO !== String(e.EMPL_NO).trim()).length + " bản ghi lệch"
  );
  check(
    "Có đủ trường hiển thị (FULL_NAME)",
    all.every((e) => Boolean(e.FULL_NAME)),
  );
  const tkd = all.find((e) => e.EMPL_NO === "TKD1605");
  check(
    "Nhân sự có EMPL_NO bị đệm trong DB nay hiện đúng (TKD1605)",
    Boolean(tkd && tkd.FULL_NAME && tkd.FULL_NAME !== "TKD1605"),
    tkd ? `FULL_NAME=${tkd.FULL_NAME}` : "không có trong danh sách"
  );

  // 2. Tài khoản thường NAY cũng được "chọn tất cả" (đã mở cho mọi người).
  console.log("\n2) Tài khoản thường CŨNG chọn được tất cả");
  const allowed = await callApi(otherToken, "chatSearchEmployees", { all: true });
  const allowedList = Array.isArray(allowed.data) ? allowed.data : [];
  check(
    "Trả OK cho tài khoản thường",
    String(allowed.tk_status).toUpperCase() === "OK",
    allowed.message || ""
  );
  check("Lấy được danh sách nhân sự", allowedList.length > 200, `${allowedList.length} người`);
  check("Không chứa chính tài khoản gọi", !allowedList.some((e) => e.EMPL_NO === other));

  // 3. Tìm kiếm thường vẫn giữ nguyên hành vi
  console.log("\n3) Tìm kiếm thường không đổi");
  const normal = await callApi(adminToken, "chatSearchEmployees", { keyword: "" });
  check(
    "Mặc định vẫn giới hạn 30",
    String(normal.tk_status).toUpperCase() === "OK" && normal.data.length <= 30,
    `${normal.data?.length} kết quả`
  );
  const kw = await callApi(otherToken, "chatSearchEmployees", { keyword: "nguyen" });
  check("Tìm theo từ khoá chạy bình thường", String(kw.tk_status).toUpperCase() === "OK", `${kw.data?.length} kết quả`);

  // 4. Giới hạn thành viên nhóm đã được nâng (kiểm tra không tạo dữ liệu thật)
  console.log("\n4) Giới hạn thành viên nhóm (không tạo phòng thật)");
  const before = await pool.query(`SELECT COUNT(1) AS N FROM ZTB_CHAT_CONVERSATION`);
  const fake250 = Array.from({ length: 250 }, (_, i) => `ZZ${String(i).padStart(4, "0")}`);
  const res250 = await callApi(adminToken, "chatCreateGroup", {
    title: "[scratch] Kiểm tra giới hạn",
    memberEmplNos: fake250,
    avatar: "avatar-khong-hop-le",
  });
  check(
    "250 thành viên KHÔNG còn bị chặn bởi giới hạn 200",
    (res250.message || "").includes("Avatar"),
    res250.message || ""
  );

  const fake1500 = Array.from({ length: 1500 }, (_, i) => `ZZ${String(i).padStart(5, "0")}`);
  const res1500 = await callApi(adminToken, "chatCreateGroup", {
    title: "[scratch] Kiểm tra giới hạn",
    memberEmplNos: fake1500,
    avatar: "avatar-khong-hop-le",
  });
  check(
    "1500 thành viên vẫn bị chặn (còn trần bảo vệ)",
    (res1500.message || "").includes("thành viên"),
    res1500.message || ""
  );

  const after = await pool.query(`SELECT COUNT(1) AS N FROM ZTB_CHAT_CONVERSATION`);
  check(
    "Không phòng nào bị tạo thêm",
    before.recordset[0].N === after.recordset[0].N,
    `${before.recordset[0].N} → ${after.recordset[0].N}`
  );

  await closePool();
  console.log(`\n[select-all] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[select-all] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
