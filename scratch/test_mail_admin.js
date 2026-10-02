/**
 * Test Phase 8 — Quản trị + monitoring + dung lượng + đối soát + xoá mềm.
 *
 * Chạy: node scratch/test_mail_admin.js
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
      {
        host: HOST,
        port: PORT,
        path: pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
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

async function main() {
  const mailRepo = require("../services/mail/mailRepository");

  console.log("\n=== PHASE 8 TEST: quản trị + dung lượng ===\n");

  console.log("[1] emailAdminOverview");
  const overview = await api("emailAdminOverview");
  check("tk_status OK", overview.tk_status === "OK", JSON.stringify(overview).slice(0, 160));
  const boxes = overview.data?.mailboxes || [];
  const totals = overview.data?.totals || {};
  check("có danh sách mailbox", boxes.length > 0, `(${boxes.length})`);
  check("mailbox có tên nhân viên", boxes.some((b) => !!b.emplName), JSON.stringify(boxes.map((b) => b.emplName)));
  check(
    "tổng email = sum từng mailbox",
    Number(totals.messageCount) === boxes.reduce((sum, b) => sum + Number(b.messageCount || 0), 0),
    `${totals.messageCount}`
  );
  check(
    "dung lượng = email bytes + đính kèm bytes",
    boxes.every((b) => Number(b.storageBytes) === Number(b.messageBytes) + Number(b.attachmentBytes))
  );
  check("có byEmployee", Array.isArray(overview.data?.byEmployee) && overview.data.byEmployee.length > 0);
  check("byEmployee sắp giảm dần theo dung lượng", (() => {
    const list = overview.data.byEmployee;
    return list.every((item, i) => i === 0 || Number(list[i - 1].storageBytes) >= Number(item.storageBytes));
  })());

  console.log("[2] Số liệu phải khớp DB (kiểm tra chéo)");
  const accountId = boxes[0].id;
  const dbMsg = await mailRepo.queryOne(
    `SELECT COUNT(*) AS CNT, ISNULL(SUM(ISNULL(SIZE_BYTES,0)),0) AS BYTES FROM ZTB_MAIL_MESSAGE WHERE MAIL_ACCOUNT_ID = @ID`,
    { ID: accountId }
  );
  check(
    `mailbox ${accountId}: số email khớp DB`,
    Number(boxes[0].messageCount) === Number(dbMsg.CNT),
    `${boxes[0].messageCount} vs ${dbMsg.CNT}`
  );
  check(`mailbox ${accountId}: dung lượng email khớp DB`, Number(boxes[0].messageBytes) === Number(dbMsg.BYTES), `${boxes[0].messageBytes} vs ${dbMsg.BYTES}`);

  console.log("[3] emailStorageDashboard");
  const dash = await api("emailStorageDashboard");
  check("tk_status OK", dash.tk_status === "OK", JSON.stringify(dash).slice(0, 160));
  const dt = dash.data?.totals || {};
  check("có tổng dung lượng", Number(dt.storageBytes) > 0, String(dt.storageBytes));
  check("có số file vật lý trên NAS", Number(dt.physicalFiles) > 0, String(dt.physicalFiles));
  check("file vật lý ≤ tổng đính kèm (đã dedup)", Number(dt.physicalFiles) <= Number(dt.attachmentCount), `${dt.physicalFiles} vs ${dt.attachmentCount}`);
  check("dedupSavedBytes ≥ 0", Number(dt.dedupSavedBytes) >= 0, String(dt.dedupSavedBytes));
  check("có byYear", Array.isArray(dash.data?.byYear) && dash.data.byYear.length > 0, JSON.stringify(dash.data?.byYear));
  check("có growth 14 ngày", Array.isArray(dash.data?.growth), `(${dash.data?.growth?.length})`);

  console.log("[4] emailStorageByEmployee");
  const byEmp = await api("emailStorageByEmployee");
  check("tk_status OK", byEmp.tk_status === "OK", JSON.stringify(byEmp).slice(0, 160));
  const employees = byEmp.data?.employees || [];
  check("có danh sách nhân viên", employees.length > 0, `(${employees.length})`);
  check("mỗi nhân viên có mailbox con", employees.every((e) => Array.isArray(e.mailboxes) && e.mailboxes.length > 0));
  check(
    "tổng email theo nhân viên = tổng toàn hệ thống",
    employees.reduce((sum, e) => sum + Number(e.messageCount || 0), 0) === Number(totals.messageCount),
    `${employees.reduce((sum, e) => sum + Number(e.messageCount || 0), 0)} vs ${totals.messageCount}`
  );

  console.log("[5] emailReconcileNow (toàn vẹn DB ↔ NAS)");
  const rec = await api("emailReconcileNow");
  check("tk_status OK", rec.tk_status === "OK", JSON.stringify(rec).slice(0, 160));
  check("trả về refs/orphans/failed/ms", ["refs", "orphans", "failed", "ms"].every((k) => typeof rec.data?.[k] === "number"), JSON.stringify(rec.data));
  check("không còn file thiếu sau đối soát", Number(rec.data?.failed) === 0, String(rec.data?.failed));

  console.log("[6] Phân quyền admin");
  for (const cmd of ["emailAdminOverview", "emailStorageDashboard", "emailStorageByEmployee", "emailReconcileNow"]) {
    const denied = await api(cmd, {}, staffToken);
    check(`${cmd} chặn người thường`, denied.tk_status === "NG" && denied.code === "FORBIDDEN", JSON.stringify(denied).slice(0, 120));
  }

  console.log("[7] Xoá mềm theo từng người + khôi phục");
  const inbox = await api("emailInbox", { folder: "INBOX", limit: 3 });
  const victim = inbox.data?.messages?.[0];
  check("có email để thử", !!victim?.id, JSON.stringify(inbox.data).slice(0, 120));
  if (victim?.id) {
    const deleted = await api("emailDelete", { ID: victim.id });
    check("emailDelete OK", deleted.tk_status === "OK" && deleted.data?.deleted === true, JSON.stringify(deleted).slice(0, 140));

    const afterDelete = await api("emailInbox", { folder: "INBOX", limit: 3 });
    check(
      "email biến khỏi hộp thư của người dùng",
      !(afterDelete.data?.messages || []).some((m) => m.id === victim.id)
    );

    const dbStill = await mailRepo.queryOne(`SELECT COUNT(*) AS C FROM ZTB_MAIL_MESSAGE WHERE ID = @ID`, { ID: victim.id });
    check("KHÔNG xoá dữ liệu gốc trong DB (copy-only)", Number(dbStill?.C) === 1, String(dbStill?.C));

    const restored = await api("emailRestore", { ID: victim.id });
    check("emailRestore OK", restored.tk_status === "OK" && restored.data?.deleted === false, JSON.stringify(restored).slice(0, 140));

    const afterRestore = await api("emailInbox", { folder: "INBOX", limit: 3 });
    check("email hiện lại sau khôi phục", (afterRestore.data?.messages || []).some((m) => m.id === victim.id));

    await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_USERSTATE WHERE MESSAGE_ID = @ID AND EMPL_NO = 'NHU1903'`, { ID: victim.id });
  }

  const { openConnection } = require("../config/database");
  (await openConnection()).close();

  console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
