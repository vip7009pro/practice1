/**
 * Kiểm chứng tính năng GHIM cuộc trò chuyện qua HTTP thật (POST /api).
 *
 * Điều kiện: backend đang chạy (mặc định http://localhost:3007/api) và đã chạy
 * `node scripts/migrate_chat_pin.js`.
 *
 * Chạy: node scratch/test_chat_pin.js
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
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

function makeToken(ctrCd, emplNo) {
  const payload = JSON.stringify([
    {
      CTR_CD: ctrCd,
      EMPL_NO: emplNo,
      WORK_STATUS_CODE: 1,
      FIRST_NAME: "Test",
      MIDLAST_NAME: "Ghim",
    },
  ]);
  return jwt.sign({ payload }, SECRET, { expiresIn: "24h" });
}

async function pickAccount(pool) {
  const result = await pool.query(
    `SELECT TOP 1 p.EMPL_NO, p.CTR_CD, COUNT(*) AS TOTAL
       FROM ZTB_CHAT_PARTICIPANT p
      WHERE p.LEFT_AT IS NULL
      GROUP BY p.EMPL_NO, p.CTR_CD
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC`
  );
  return result.recordset[0] || null;
}

async function syncConversations(token, ctrCd) {
  const { status, json } = await callApi(token, "chatSync", { CTR_CD: ctrCd });
  if (String(json.tk_status).toUpperCase() !== "OK") {
    throw new Error(`chatSync lỗi: ${status} ${json.message || ""}`);
  }
  return json.data.conversations || [];
}

async function main() {
  const pool = await openConnection();
  const account = await pickAccount(pool);
  if (!account) throw new Error("Không tìm thấy tài khoản nào có >= 2 phòng chat");

  const emplNo = String(account.EMPL_NO).trim().toUpperCase();
  const ctrCd = String(account.CTR_CD).trim();
  const token = makeToken(ctrCd, emplNo);
  console.log(`[chat-pin] Tài khoản thử: ${emplNo} @ ${ctrCd}\n`);

  // 0. Dọn trạng thái ghim cũ để test độc lập.
  await pool.query(
    `UPDATE ZTB_CHAT_PARTICIPANT SET PINNED_AT = NULL
      WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`,
    { CTR_CD: ctrCd, EMPL_NO: emplNo }
  );

  // 1. chatSync trả về đủ trường mới.
  const before = await syncConversations(token, ctrCd);
  console.log("1) chatSync trả PINNED_AT/CREATED_AT");
  check("Có >= 2 phòng", before.length >= 2, `${before.length} phòng`);
  check(
    "Mọi phòng có khoá PINNED_AT",
    before.every((c) => "PINNED_AT" in c),
  );
  check("Ban đầu chưa ghim phòng nào", before.every((c) => !c.PINNED_AT));

  const first = before[before.length - 1]; // phòng cũ nhất
  const second = before[before.length - 2];

  // 2. Ghim phòng cũ nhất ⇒ phải nhảy lên đầu.
  console.log("\n2) Ghim phòng cũ nhất ⇒ lên đầu danh sách");
  const pinA = await callApi(token, "chatPinConversation", {
    CTR_CD: ctrCd,
    conversationId: first.CONVERSATION_ID,
    pinned: true,
  });
  check("Command trả OK", String(pinA.json.tk_status).toUpperCase() === "OK", pinA.json.message || "");
  check("Có pinnedAt", Boolean(pinA.json?.data?.pinnedAt), String(pinA.json?.data?.pinnedAt));

  let after = await syncConversations(token, ctrCd);
  check(
    "Phòng vừa ghim đứng đầu",
    after[0].CONVERSATION_ID === first.CONVERSATION_ID,
    `#${after[0].CONVERSATION_ID} vs #${first.CONVERSATION_ID}`
  );
  check("Phòng đầu có PINNED_AT", Boolean(after[0].PINNED_AT));

  // 3. Ghim phòng thứ hai ⇒ ghim MỚI hơn phải nằm TRÊN ghim cũ.
  console.log("\n3) Ghim thêm phòng khác ⇒ ghim mới hơn ở trên cùng");
  const pinB = await callApi(token, "chatPinConversation", {
    CTR_CD: ctrCd,
    conversationId: second.CONVERSATION_ID,
    pinned: true,
  });
  check("Command trả OK", String(pinB.json.tk_status).toUpperCase() === "OK", pinB.json.message || "");

  after = await syncConversations(token, ctrCd);
  check(
    "Ghim mới nhất ở vị trí 0",
    after[0].CONVERSATION_ID === second.CONVERSATION_ID,
    `#${after[0].CONVERSATION_ID} vs #${second.CONVERSATION_ID}`
  );
  check(
    "Ghim cũ ở vị trí 1",
    after[1].CONVERSATION_ID === first.CONVERSATION_ID,
    `#${after[1].CONVERSATION_ID} vs #${first.CONVERSATION_ID}`
  );
  check(
    "Hai phòng đầu đều có PINNED_AT",
    Boolean(after[0].PINNED_AT) && Boolean(after[1].PINNED_AT)
  );
  check(
    "Phần còn lại không ghim",
    after.slice(2).every((c) => !c.PINNED_AT)
  );

  // 4. Phòng khác không bị ảnh hưởng: ghim là thuộc tính RIÊNG từng người.
  console.log("\n4) Ghim của tôi không ảnh hưởng người khác");
  const other = await pool.query(
    `SELECT TOP 1 EMPL_NO FROM ZTB_CHAT_PARTICIPANT
      WHERE CONVERSATION_ID = @ID AND EMPL_NO <> @EMPL_NO AND LEFT_AT IS NULL`,
    { ID: first.CONVERSATION_ID, EMPL_NO: emplNo }
  );
  if (other.recordset[0]) {
    const otherPin = await pool.query(
      `SELECT PINNED_AT FROM ZTB_CHAT_PARTICIPANT
        WHERE CONVERSATION_ID = @ID AND EMPL_NO = @EMPL_NO`,
      { ID: first.CONVERSATION_ID, EMPL_NO: String(other.recordset[0].EMPL_NO).trim() }
    );
    check(
      `Người khác (${String(other.recordset[0].EMPL_NO).trim()}) không bị ghim theo`,
      !otherPin.recordset[0]?.PINNED_AT
    );
  } else {
    console.log("  SKIP  phòng test chỉ có 1 thành viên");
  }

  // 5. Bỏ ghim.
  console.log("\n5) Bỏ ghim");
  await callApi(token, "chatPinConversation", {
    CTR_CD: ctrCd,
    conversationId: second.CONVERSATION_ID,
    pinned: false,
  });
  await callApi(token, "chatPinConversation", {
    CTR_CD: ctrCd,
    conversationId: first.CONVERSATION_ID,
    pinned: false,
  });
  after = await syncConversations(token, ctrCd);
  check("Không còn phòng nào ghim", after.every((c) => !c.PINNED_AT));
  check(
    "Thứ tự trở lại theo tin nhắn mới nhất",
    after[0].CONVERSATION_ID === before[0].CONVERSATION_ID,
    `#${after[0].CONVERSATION_ID} vs #${before[0].CONVERSATION_ID}`
  );

  // 6. Chặn phòng không thuộc về mình.
  console.log("\n6) Chặn ghim phòng không thuộc về mình");
  const foreign = await pool.query(
    `SELECT TOP 1 CONVERSATION_ID FROM ZTB_CHAT_CONVERSATION c
      WHERE c.DELETED_AT IS NULL
        AND NOT EXISTS (
              SELECT 1 FROM ZTB_CHAT_PARTICIPANT p
               WHERE p.CONVERSATION_ID = c.CONVERSATION_ID AND p.EMPL_NO = @EMPL_NO)`,
    { EMPL_NO: emplNo }
  );
  if (foreign.recordset[0]) {
    const denied = await callApi(token, "chatPinConversation", {
      CTR_CD: ctrCd,
      conversationId: foreign.recordset[0].CONVERSATION_ID,
      pinned: true,
    });
    check(
      "Trả NG cho phòng ngoài",
      String(denied.json.tk_status).toUpperCase() === "NG",
      denied.json.message || ""
    );
  } else {
    console.log("  SKIP  không có phòng nào ngoài tài khoản test");
  }

  await closePool();
  console.log(`\n[chat-pin] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[chat-pin] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
