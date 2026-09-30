/**
 * Kiểm chứng tin nhắn RICHTEXT (MSG_TYPE = "RICH").
 *
 * 1. Unit: bộ lọc HTML và chuyển HTML → text thuần.
 * 2. End-to-end qua HTTP: gửi tin RICH (kèm mã độc), đọc lại, trả lời để kiểm tra
 *    trích dẫn dạng text thuần, rồi THU HỒI để dọn dẹp.
 *
 * Chạy: node scratch/test_chat_rich.js
 */
const jwt = require("jsonwebtoken");
const { openConnection, closePool } = require("../config/database");
const { sanitizeRichContent, richToPlainText } = require("../services/chat/richText");

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
  const body = JSON.stringify({
    secureContext: false,
    command,
    DATA: { ...data, token_string: token, COMPANY: "CMS" },
  });
  let response;
  try {
    response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (error) {
    // undici bọc lỗi mạng ⇒ in nguyên nhân thật để chẩn đoán.
    throw new Error(
      `fetch ${command} thất bại: ${error?.message} | cause=${error?.cause?.code || error?.cause?.message || "?"}`
    );
  }
  return response.json();
}

function makeToken(ctrCd, emplNo) {
  return jwt.sign(
    { payload: JSON.stringify([{ CTR_CD: ctrCd, EMPL_NO: emplNo, WORK_STATUS_CODE: 1 }]) },
    SECRET,
    { expiresIn: "24h" }
  );
}

const DIRTY_HTML = [
  '<p>Xin <b>chào</b> <span style="color:#dc2626">đồng nghiệp</span></p>',
  "<script>alert('xss')</script>",
  '<img src=x onerror="alert(1)">',
  '<a href="javascript:alert(2)">bấm</a>',
  '<iframe src="https://evil.example"></iframe>',
  '<p style="position:fixed;top:0;left:0">Dòng cuối</p>',
].join("");

async function main() {
  console.log("1) Bộ lọc HTML ở server");
  const cleaned = sanitizeRichContent(DIRTY_HTML);
  check("Bỏ <script>", !/<script/i.test(cleaned), cleaned.slice(0, 80));
  check("Bỏ thuộc tính on*=", !/onerror/i.test(cleaned));
  check("Bỏ href javascript:", !/javascript:/i.test(cleaned));
  check("Bỏ <iframe>", !/<iframe/i.test(cleaned));
  check("Vẫn giữ nội dung hợp lệ", /<b>chào<\/b>/.test(cleaned) && /Dòng cuối/.test(cleaned));

  const plain = richToPlainText("<p>Xin <b>chào</b></p><p>Dòng 2</p><ul><li>a</li><li>b</li></ul>");
  check(
    "HTML → text thuần có xuống dòng",
    plain.includes("Xin chào") && plain.includes("Dòng 2") && plain.includes("a"),
    JSON.stringify(plain)
  );

  // ---------------------------------------------------------------- E2E
  const pool = await openConnection();
  const account = await pool.query(
    `SELECT TOP 1 p.EMPL_NO, p.CTR_CD, p.CONVERSATION_ID
       FROM ZTB_CHAT_PARTICIPANT p
       INNER JOIN ZTB_CHAT_CONVERSATION c ON c.CONVERSATION_ID = p.CONVERSATION_ID
      WHERE p.LEFT_AT IS NULL AND c.DELETED_AT IS NULL AND c.CONV_TYPE <> 'SELF'
      ORDER BY p.CONVERSATION_ID DESC`
  );
  if (!account.recordset[0]) throw new Error("Không có phòng chat để test");
  const { EMPL_NO, CTR_CD, CONVERSATION_ID } = account.recordset[0];
  const emplNo = String(EMPL_NO).trim().toUpperCase();
  const ctrCd = String(CTR_CD).trim();
  const conversationId = Number(CONVERSATION_ID);
  const token = makeToken(ctrCd, emplNo);
  const suffix = Date.now().toString(36);
  console.log(`\n[rich] ${emplNo} @ ${ctrCd} → phòng #${conversationId}\n`);

  console.log("2) Gửi tin RICHTEXT qua HTTP");
  const sent = await callApi(token, "chatSendMessage", {
    CONVERSATION_ID: conversationId,
    conversationId,
    msgType: "RICH",
    content: DIRTY_HTML,
    clientMessageId: `rich-test-${suffix}`,
  });
  check("Gửi thành công", String(sent.tk_status).toUpperCase() === "OK", sent.message || "");
  const message = sent?.data?.message;
  check("MSG_TYPE = RICH", message?.MSG_TYPE === "RICH", String(message?.MSG_TYPE));
  check("Server đã lọc mã độc trong DB", !/onerror|javascript:|<script/i.test(message?.CONTENT || ""));
  const messageId = Number(message?.MESSAGE_ID) || 0;

  console.log("\n3) Đọc lại danh sách tin nhắn");
  const loaded = await callApi(token, "chatLoadMessages", {
    CONVERSATION_ID: conversationId,
    conversationId,
    limit: 5,
  });
  const found = (loaded?.data?.messages || []).find((m) => m.MESSAGE_ID === messageId);
  check("Tin RICH có trong danh sách", Boolean(found));
  check("Nội dung vẫn là HTML đã lọc", /<b>chào<\/b>/.test(found?.CONTENT || ""), "");

  console.log("\n4) Trả lời tin RICHTEXT (trích dẫn phải là text thuần)");
  const reply = await callApi(token, "chatSendMessage", {
    CONVERSATION_ID: conversationId,
    conversationId,
    content: "Trả lời tin richtext",
    replyToMessageId: messageId,
    clientMessageId: `rich-reply-${suffix}`,
  });
  check("Gửi trả lời thành công", String(reply.tk_status).toUpperCase() === "OK", reply.message || "");
  const preview = reply?.data?.message?.REPLY_TO?.PREVIEW || "";
  check("Trích dẫn KHÔNG chứa thẻ HTML", !/[<>]/.test(preview), JSON.stringify(preview));
  check("Trích dẫn có nội dung đọc được", preview.includes("chào"), JSON.stringify(preview));

  // ------------------------------------------------------------- dọn dẹp
  console.log("\n5) Thu hồi 2 tin test");
  const replyId = Number(reply?.data?.message?.MESSAGE_ID) || 0;
  for (const id of [replyId, messageId]) {
    if (!id) continue;
    const res = await callApi(token, "chatDeleteMessage", {
      CONVERSATION_ID: conversationId,
      conversationId,
      messageId: id,
    });
    check(`Thu hồi tin #${id}`, String(res.tk_status).toUpperCase() === "OK", res.message || "");
  }

  await closePool();
  console.log(`\n[rich] KẾT QUẢ: ${passed} PASS / ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[rich] FAIL:", error?.message || error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
