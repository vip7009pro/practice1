/**
 * Test DANH BẠ EMAIL — nhóm danh bạ để gửi nhanh / CC nhanh.
 *
 * ⚠️ CHỈ dùng EMPL_NO GIẢ (`ZTEST01`, `ZTEST02`) cho người dùng phụ.
 * NHU1903 chỉ dùng ở vai admin (không ghi cấu hình mailbox).
 *
 * Chạy: node scratch/test_mail_contacts.js
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

function request(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      { host: HOST, port: PORT, path: "/api", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve(raw));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const tokenFor = (emplNo, jobName = "Staff") =>
  jwt.sign(
    { payload: JSON.stringify([{ EMPL_NO: emplNo, CTR_CD: "002", CMS_ID: "CMS0001", JOB_NAME: jobName }]) },
    "nguyenvanhung",
    { expiresIn: "1h" }
  );

const MAIN = tokenFor("NHU1903", "Staff");
const OTHER = tokenFor("ZTEST01", "Staff");

const api = async (command, DATA = {}, token = MAIN) =>
  JSON.parse(await request({ command, DATA: { ...DATA, token_string: token, secureContext: false } }));

const GROUP_NAME = "ZTEST-Nhóm KD miền Bắc";
const GROUP_NAME_2 = "ZTEST-Nhóm CC kế toán";

async function main() {
  console.log("\n=== TEST DANH BẠ EMAIL (nhóm gửi nhanh / CC nhanh) ===\n");

  /* ---------- dọn dẹp trước ---------- */
  const initial = await api("emailContactGroupList");
  check("emailContactGroupList OK", initial.tk_status === "OK", JSON.stringify(initial).slice(0, 160));
  for (const g of initial.data?.groups || []) {
    if (String(g.name).startsWith("ZTEST-")) await api("emailContactGroupDelete", { ID: g.id });
  }

  console.log("[1] Tạo nhóm từ chuỗi địa chỉ (nhiều kiểu ngăn cách)");
  const created = await api("emailContactGroupSave", {
    GROUP_NAME,
    DESCRIPTION: "Khách hàng miền Bắc + CC kế toán",
    ADDRESSES: "khach1@congty.com; khach2@congty.com,\nKế Toán <ketoan@congty.com>\tkhach1@congty.com",
  });
  check("tk_status OK", created.tk_status === "OK", JSON.stringify(created).slice(0, 200));
  check("báo created", created.data?.created === true, JSON.stringify(created.data));
  check("gộp đúng 3 người nhận (khử trùng lặp)", created.data?.memberCount === 3, `(=${created.data?.memberCount})`);
  check("trả về id nhóm", Number.isInteger(created.data?.id) && created.data.id > 0);
  const groupId = created.data?.id;

  console.log("[2] Danh sách nhóm trả kèm thành viên (để tag nhanh khi soạn thư)");
  const list = await api("emailContactGroupList");
  const mine = (list.data?.groups || []).find((g) => g.id === groupId);
  check("thấy nhóm vừa tạo", !!mine, JSON.stringify(list.data?.groups?.map((g) => g.name)));
  check("có đủ thành viên", mine?.members?.length === 3, `(=${mine?.members?.length})`);
  check("giữ tên hiển thị khi nhập dạng 'Tên <email>'", mine?.members?.some((m) => m.address === "ketoan@congty.com" && m.name === "Kế Toán"), JSON.stringify(mine?.members));
  check("isOwner = true", mine?.isOwner === true);
  check("canEdit = true", mine?.canEdit === true);
  check("memberCount khớp số thành viên", mine?.memberCount === mine?.members?.length);

  console.log("[3] Tạo nhóm TỪ list người nhận + CC của email");
  const fromMsg = await api("emailContactGroupSave", {
    GROUP_NAME: GROUP_NAME_2,
    TO: "sep1@congty.com, sep2@congty.com",
    CC: "giamdoc@congty.com; sep1@congty.com",
  });
  check("tk_status OK", fromMsg.tk_status === "OK", JSON.stringify(fromMsg).slice(0, 200));
  check("gộp To + CC, khử trùng lặp ⇒ 3 người", fromMsg.data?.memberCount === 3, `(=${fromMsg.data?.memberCount})`);
  const groupId2 = fromMsg.data?.id;

  console.log("[4] Trùng TÊN ⇒ cập nhật nhóm cũ (không tạo trùng)");
  const sameName = await api("emailContactGroupSave", { GROUP_NAME, ADDRESSES: "khach1@congty.com" });
  check("trả về ĐÚNG id cũ", sameName.data?.id === groupId, `(${sameName.data?.id} vs ${groupId})`);
  check("created = false", sameName.data?.created === false);
  check("ghi đè thành viên ⇒ còn 1 người", sameName.data?.memberCount === 1, `(=${sameName.data?.memberCount})`);

  console.log("[5] REPLACE=false ⇒ THÊM vào nhóm (không xoá người cũ)");
  const appended = await api("emailContactGroupSave", { ID: groupId, GROUP_NAME, ADDRESSES: "khach2@congty.com, khach3@congty.com", REPLACE: false });
  check("tk_status OK", appended.tk_status === "OK", JSON.stringify(appended).slice(0, 200));
  check("thành viên = 3 (1 cũ + 2 mới)", appended.data?.memberCount === 3, `(=${appended.data?.memberCount})`);

  console.log("[6] Kiểm tra dữ liệu (địa chỉ không hợp lệ / thiếu tên)");
  const bad = await api("emailContactGroupSave", { GROUP_NAME: "ZTEST-Sai", ADDRESSES: "khong-phai-email, cung-khong@, @" });
  check("toàn địa chỉ sai ⇒ INVALID_ADDRESS", bad.tk_status === "NG" && bad.code === "INVALID_ADDRESS", JSON.stringify(bad).slice(0, 160));
  const noName = await api("emailContactGroupSave", { ADDRESSES: "a@congty.com" });
  check("thiếu tên nhóm ⇒ INVALID_NAME", noName.tk_status === "NG" && noName.code === "INVALID_NAME", JSON.stringify(noName).slice(0, 160));
  const mixed = await api("emailContactGroupSave", { GROUP_NAME: "ZTEST-Hỗn hợp", ADDRESSES: "ok1@congty.com, sai-dinh-dang" });
  check("bỏ qua địa chỉ sai, vẫn tạo nhóm", mixed.tk_status === "OK" && mixed.data?.memberCount === 1, JSON.stringify(mixed).slice(0, 200));
  check("trả danh sách địa chỉ bị bỏ", Array.isArray(mixed.data?.invalidAddresses) && mixed.data.invalidAddresses.length === 1, JSON.stringify(mixed.data?.invalidAddresses));

  console.log("[7] Cách ly theo người dùng + nhóm dùng chung");
  const otherList = await api("emailContactGroupList", {}, OTHER);
  check("người khác KHÔNG thấy nhóm riêng của tôi", !(otherList.data?.groups || []).some((g) => g.id === groupId), JSON.stringify(otherList.data?.groups?.map((g) => g.name)));
  const shared = await api("emailContactGroupSave", { ID: groupId, GROUP_NAME, ADDRESSES: "khach1@congty.com, khach2@congty.com", IS_SHARED: true });
  check("bật chia sẻ nhóm", shared.tk_status === "OK", JSON.stringify(shared).slice(0, 160));
  const otherList2 = await api("emailContactGroupList", {}, OTHER);
  const sharedSeen = (otherList2.data?.groups || []).find((g) => g.id === groupId);
  check("nhóm dùng chung: người khác THẤY", !!sharedSeen, JSON.stringify(otherList2.data?.groups?.map((g) => g.name)));
  check("nhóm dùng chung: người khác KHÔNG sửa được", sharedSeen?.canEdit === false, JSON.stringify(sharedSeen && { isOwner: sharedSeen.isOwner, canEdit: sharedSeen.canEdit }));
  const forbidden = await api("emailContactGroupSave", { ID: groupId, GROUP_NAME, ADDRESSES: "hack@congty.com" }, OTHER);
  check("sửa nhóm người khác ⇒ FORBIDDEN", forbidden.tk_status === "NG" && forbidden.code === "FORBIDDEN", JSON.stringify(forbidden).slice(0, 160));
  const forbiddenDel = await api("emailContactGroupDelete", { ID: groupId }, OTHER);
  check("xoá nhóm người khác ⇒ FORBIDDEN", forbiddenDel.tk_status === "NG" && forbiddenDel.code === "FORBIDDEN", JSON.stringify(forbiddenDel).slice(0, 160));

  console.log("[8] Tìm nhanh nhóm theo tên / theo địa chỉ thành viên");
  const byName = await api("emailContactGroupList", { Q: "kế toán" });
  check("tìm theo tên nhóm có kết quả", (byName.data?.groups || []).length >= 0, `(${byName.data?.groups?.length})`);
  const byMember = await api("emailContactGroupList", { Q: "khach1@congty.com" });
  check("tìm theo địa chỉ thành viên ⇒ thấy nhóm", (byMember.data?.groups || []).some((g) => g.id === groupId), JSON.stringify(byMember.data?.groups?.map((g) => g.name)));

  console.log("[9] Tạo nhóm từ 1 email thật (To/Cc của thư)");
  const inbox = await api("emailInbox", { folder: "INBOX", limit: 5 });
  const anyMail = (inbox.data?.messages || [])[0];
  if (anyMail) {
    const suggestion = await api("emailContactGroupFromMessage", { ID: anyMail.id });
    check("tk_status OK", suggestion.tk_status === "OK", JSON.stringify(suggestion).slice(0, 200));
    check("trả về mảng to/cc", Array.isArray(suggestion.data?.to) && Array.isArray(suggestion.data?.cc));
    check("có suggestedMembers", Array.isArray(suggestion.data?.suggestedMembers));
    const idor = await api("emailContactGroupFromMessage", { ID: -1 });
    check("ID sai ⇒ NG", idor.tk_status === "NG", JSON.stringify(idor).slice(0, 120));
  } else {
    check("có email để test FromMessage", false, "(hộp thư trống)");
  }

  console.log("[10] Xoá nhóm + dọn dẹp");
  const del = await api("emailContactGroupDelete", { ID: groupId2 });
  check("xoá nhóm của mình OK", del.tk_status === "OK" && del.data?.deleted === true, JSON.stringify(del).slice(0, 160));
  const afterDel = await api("emailContactGroupList");
  check("nhóm đã biến mất", !(afterDel.data?.groups || []).some((g) => g.id === groupId2));
  for (const g of afterDel.data?.groups || []) {
    if (String(g.name).startsWith("ZTEST-")) await api("emailContactGroupDelete", { ID: g.id });
  }
  const cleaned = await api("emailContactGroupList");
  check("dọn sạch nhóm ZTEST-", !(cleaned.data?.groups || []).some((g) => String(g.name).startsWith("ZTEST-")), JSON.stringify(cleaned.data?.groups?.map((g) => g.name)));

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Lỗi test:", error);
  process.exit(1);
});
