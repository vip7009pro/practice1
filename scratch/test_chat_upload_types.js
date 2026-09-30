/**
 * Kiểm chứng upload chat cho MỌI định dạng tệp (không còn allowlist cứng).
 *
 * Trước đây `/chatfile` chỉ nhận allowlist MIME+đuôi ⇒ gửi .psd/.dwg/.json/.sln… trả 400.
 * Test này upload vài đuôi "lạ" và 1 tệp KHÔNG có đuôi, sau đó DỌN SẠCH dữ liệu vừa tạo.
 *
 * Chạy: node scratch/test_chat_upload_types.js
 */
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");

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

function makeToken(ctrCd, emplNo) {
  const payload = JSON.stringify([
    { CTR_CD: ctrCd, EMPL_NO: emplNo, WORK_STATUS_CODE: 1, FIRST_NAME: "Test", MIDLAST_NAME: "Upload" },
  ]);
  return jwt.sign({ payload }, SECRET, { expiresIn: "24h" });
}

async function pickAccount(pool) {
  const result = await pool.query(
    `SELECT TOP 1 p.EMPL_NO, p.CTR_CD, p.CONVERSATION_ID
       FROM ZTB_CHAT_PARTICIPANT p
      INNER JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = p.CONVERSATION_ID
      WHERE p.LEFT_AT IS NULL AND c.DELETED_AT IS NULL
      ORDER BY p.CONVERSATION_ID DESC`
  );
  return result.recordset[0] || null;
}

async function uploadFile(token, ctrCd, conversationId, fileName, content) {
  const formData = new FormData();
  formData.append("uploadedfile", new Blob([content]), fileName);
  formData.append("CONVERSATION_ID", String(conversationId));
  formData.append("token_string", token);
  formData.append("CTR_CD", ctrCd);

  const response = await fetch(`${API_BASE}/chatfile`, { method: "POST", body: formData });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function main() {
  const pool = await openConnection();
  const account = await pickAccount(pool);
  if (!account) throw new Error("Không tìm thấy phòng chat nào để test");

  const emplNo = String(account.EMPL_NO).trim().toUpperCase();
  const ctrCd = String(account.CTR_CD).trim();
  const conversationId = account.CONVERSATION_ID;
  const token = makeToken(ctrCd, emplNo);
  console.log(`[chat-upload] ${emplNo} @ ${ctrCd} → phòng #${conversationId}\n`);

  const samples = [
    ["thiet-ke.psd", "psd"],
    ["ban-ve.dwg", "dwg"],
    ["cau-hinh.json", "json"],
    ["project.sln", "sln"],
    ["script.py", "py"],
    ["family.step", "step"],
    ["KHONG-CO-DUOI", "no-ext"],
  ];

  const createdIds = [];
  console.log("1) Upload các định dạng trước đây bị chặn 400");
  for (const [name, kind] of samples) {
    const { status, json } = await uploadFile(token, ctrCd, conversationId, name, `noi dung test ${name}`);
    const ok = String(json?.tk_status).toUpperCase() === "OK";
    check(`${name} (${kind})`, ok, ok ? `attachment #${json.data.attachmentId}` : `${status} ${json.message || ""}`);
    if (ok && json.data?.attachmentId) createdIds.push(json.data.attachmentId);
  }

  console.log("\n2) Vẫn chặn tệp vượt quá giới hạn khi cấu hình chặn");
  console.log("  SKIP  (mặc định CHAT_BLOCKED_EXTS rỗng ⇒ không chặn đuôi nào)");

  // Dọn dẹp: xoá DB + file vật lý của các attachment vừa tạo.
  if (createdIds.length > 0) {
    const rows = await pool.query(
      `SELECT ATTACHMENT_ID, STORAGE_PATH FROM ZTB_CHAT_ATTACHMENT
        WHERE ATTACHMENT_ID IN (${createdIds.join(",")})`
    );
    for (const row of rows.recordset || []) {
      if (row.STORAGE_PATH) {
        try {
          fs.unlinkSync(row.STORAGE_PATH);
        } catch {
          /* file có thể đã bị xoá */
        }
      }
    }
    await pool.query(
      `DELETE FROM ZTB_CHAT_ATTACHMENT WHERE ATTACHMENT_ID IN (${createdIds.join(",")})`
    );
    console.log(`\n[chat-upload] Đã dọn ${createdIds.length} bản ghi test.`);
  }

  await closePool();
  console.log(`[chat-upload] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[chat-upload] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
