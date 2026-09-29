/**
 * Kiểm chứng backend Đợt 22.6: My Files (SELF), tìm kiếm, media, dung lượng.
 *
 *   node scratch/test_chat_search_media.js
 *
 * Script tự tạo dữ liệu mẫu (pdf/word/excel/ppt/zip/ảnh/tệp lạ + 1 tin có từ khoá)
 * trong phòng "My Files" của NHU1903, chạy kiểm chứng rồi DỌN SẠCH phần vừa tạo.
 */
const fs = require("fs");
const path = require("path");
const repo = require("../services/chat/chatRepository");
const { openConnection, closePool } = require("../config/database");

const UPLOAD_DIR =
  process.env.CHAT_UPLOAD_FOLDER || path.join(__dirname, "..", "outbinary", "chatfiles");
const FIXTURE_PREFIX = "fixture-22-6-";
/** Hậu tố duy nhất mỗi lần chạy: CLIENT_MESSAGE_ID có unique index nên không được trùng. */
const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function resolveCtx(emplNo) {
  const pool = await openConnection();
  const row = (
    await pool.query(`SELECT TOP 1 EMPL_NO, CTR_CD FROM ZTBEMPLINFO WHERE EMPL_NO = @EMPL_NO`, {
      EMPL_NO: emplNo,
    })
  ).recordset[0];
  if (!row) throw new Error(`Không tìm thấy ${emplNo}`);
  return { ctrCd: String(row.CTR_CD).trim(), emplNo: String(row.EMPL_NO).trim().toUpperCase() };
}

const FIXTURES = [
  { name: `${FIXTURE_PREFIX}bao-cao-tai-chinh.pdf`, mime: "application/pdf", kind: "pdf" },
  {
    name: `${FIXTURE_PREFIX}bang-luong.xlsx`,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "excel",
  },
  {
    name: `${FIXTURE_PREFIX}hop-dong.docx`,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "word",
  },
  {
    name: `${FIXTURE_PREFIX}thuyet-trinh.pptx`,
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "ppt",
  },
  { name: `${FIXTURE_PREFIX}tai-lieu.zip`, mime: "application/zip", kind: "zip" },
  { name: `${FIXTURE_PREFIX}anh-minh-hoa.png`, mime: "image/png", kind: "image" },
  { name: `${FIXTURE_PREFIX}du-lieu.bin`, mime: "application/octet-stream", kind: "other" },
];

const writtenFiles = [];

async function createFixtures(ctx, conversationId) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const attachments = [];

  for (const item of FIXTURES) {
    const storedName = `${Date.now()}-${Math.random().toString(16).slice(2, 12)}-${item.name}`;
    const storagePath = path.join(UPLOAD_DIR, storedName);
    const size = 16 + item.name.length;
    fs.writeFileSync(storagePath, Buffer.alloc(size, 65));
    writtenFiles.push(storagePath);

    const saved = await repo.insertAttachment({
      conversationId,
      ctrCd: ctx.ctrCd,
      originalName: item.name,
      storedName,
      storagePath,
      mimeType: item.mime,
      fileSize: size,
      uploadedBy: ctx.emplNo,
    });
    attachments.push({ ...item, attachmentId: saved.ATTACHMENT_ID });
  }
  return attachments;
}

async function searchOrEmpty(options) {
  try {
    return await repo.searchMessages(options);
  } catch (error) {
    console.error("   [search error]", error?.message || error);
    return null;
  }
}

async function cleanup(ctx, conversationId, createdMessageIds) {
  const pool = await openConnection();
  for (const messageId of createdMessageIds) {
    await pool.query(`UPDATE ZTB_CHAT_MESSAGE SET DELETED_AT = GETDATE() WHERE MESSAGE_ID = @ID`, {
      ID: messageId,
    });
  }
  await pool.query(
    `UPDATE ZTB_CHAT_ATTACHMENT SET DELETED_AT = GETDATE()
      WHERE CONVERSATION_ID = @CID AND ORIGINAL_NAME LIKE @PREFIX`,
    { CID: conversationId, PREFIX: `${FIXTURE_PREFIX}%` }
  );
  writtenFiles.forEach((file) => fs.promises.unlink(file).catch(() => undefined));
  // Đóng mềm phòng My Files để dữ liệu test không hiện trên UI (sẽ được mở lại khi cần).
  await pool.query(
    `UPDATE ZTB_CHAT_CONVERSATION SET DELETED_AT = GETDATE() WHERE CONVERSATION_ID = @CID`,
    { CID: conversationId }
  );
}

async function main() {
  const ctx = await resolveCtx("NHU1903");
  console.log(`== Ngữ cảnh: ${ctx.emplNo} / ${ctx.ctrCd} ==\n`);

  console.log("1) My Files (CONV_TYPE = SELF)");
  const first = await repo.ensureSelfConversation(ctx);
  const second = await repo.ensureSelfConversation(ctx);
  check("tạo được phòng My Files", Boolean(first?.CONVERSATION_ID), `id=${first?.CONVERSATION_ID}`);
  check("gọi lại không tạo trùng", first?.CONVERSATION_ID === second?.CONVERSATION_ID);
  check("CONV_TYPE = SELF", first?.CONV_TYPE === "SELF", first?.CONV_TYPE);
  check("DIRECT_KEY đúng quy ước", first?.DIRECT_KEY === `SELF|${ctx.emplNo}`, first?.DIRECT_KEY);

  const members = await repo.listActiveMemberNos({ conversationId: first.CONVERSATION_ID });
  check("chỉ 1 thành viên (chính user)", members.length === 1 && members[0].EMPL_NO === ctx.emplNo);

  const otherSelf = await repo.ensureSelfConversation(await resolveCtx("ANH1304"));
  check(
    "mỗi user có phòng riêng",
    otherSelf.CONVERSATION_ID !== first.CONVERSATION_ID,
    `${otherSelf.CONVERSATION_ID} != ${first.CONVERSATION_ID}`
  );

  const conversationId = first.CONVERSATION_ID;
  console.log("\n2) Tạo dữ liệu mẫu (tệp + tin nhắn)");
  const attachments = await createFixtures(ctx, conversationId);
  check("tạo đủ 7 tệp mẫu", attachments.length === 7);

  const createdMessageIds = [];
  const keywordMessage = await repo.insertMessage({
    ctrCd: ctx.ctrCd,
    conversationId,
    senderEmplNo: ctx.emplNo,
    msgType: "TEXT",
    content: "Báo cáo doanh thu tháng 9 cần gửi trước ngày 5",
    clientMessageId: `${FIXTURE_PREFIX}${RUN_ID}-msg-keyword`,
  });
  createdMessageIds.push(keywordMessage.message.MESSAGE_ID);

  const fileMessage = await repo.insertMessage({
    ctrCd: ctx.ctrCd,
    conversationId,
    senderEmplNo: ctx.emplNo,
    msgType: "FILE",
    content: "",
    attachmentIds: attachments.map((a) => a.attachmentId),
    clientMessageId: `${FIXTURE_PREFIX}${RUN_ID}-msg-files`,
  });
  createdMessageIds.push(fileMessage.message.MESSAGE_ID);
  check(
    "tệp được gắn vào tin nhắn",
    fileMessage.attachments.length === 7,
    `${fileMessage.attachments.length} tệp`
  );

  console.log("\n3) Tìm kiếm");
  const byKeyword = await searchOrEmpty({ ...ctx, keyword: "doanh thu", limit: 20 });
  check(
    "tìm theo từ khoá nội dung",
    Boolean(byKeyword?.some((r) => r.MESSAGE_ID === keywordMessage.message.MESSAGE_ID))
  );

  const byFileName = await searchOrEmpty({ ...ctx, keyword: `${FIXTURE_PREFIX}bang-luong`, limit: 20 });
  check(
    "tìm theo TÊN TỆP",
    Boolean(byFileName?.some((r) => r.MESSAGE_ID === fileMessage.message.MESSAGE_ID))
  );

  for (const kind of ["pdf", "excel", "word", "ppt", "zip", "image", "other"]) {
    const rows = await searchOrEmpty({ ...ctx, fileKind: kind, limit: 50 });
    const ids = new Set((rows || []).map((r) => r.MESSAGE_ID));
    check(`lọc loại tệp = ${kind}`, ids.has(fileMessage.message.MESSAGE_ID));
  }

  const onlyFiles = await searchOrEmpty({ ...ctx, onlyWithFiles: true, limit: 50 });
  check(
    "'chỉ tin có tệp' không trả tin chữ",
    !onlyFiles?.some((r) => r.MESSAGE_ID === keywordMessage.message.MESSAGE_ID)
  );

  const scoped = await searchOrEmpty({ ...ctx, conversationId, keyword: "doanh thu", limit: 20 });
  check("tìm trong đúng 1 phòng", scoped?.length === 1, `${scoped?.length} kết quả`);

  const scopedWrongRoom = await searchOrEmpty({
    ...ctx,
    conversationId: otherSelf.CONVERSATION_ID,
    keyword: "doanh thu",
    limit: 20,
  });
  check("phạm vi phòng được tôn trọng", scopedWrongRoom?.length === 0);

  const senderMatch = await searchOrEmpty({
    ...ctx,
    keyword: "doanh thu",
    senderEmplNo: ctx.emplNo,
    limit: 20,
  });
  check("lọc theo người gửi (khớp)", senderMatch?.length === 1);

  const senderMiss = await searchOrEmpty({
    ...ctx,
    keyword: "doanh thu",
    senderEmplNo: "LSG1103",
    limit: 20,
  });
  check("lọc theo người gửi (không khớp ⇒ rỗng)", senderMiss?.length === 0);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const dateHit = await searchOrEmpty({
    ...ctx,
    fromDate: today,
    toDate: today,
    keyword: "doanh thu",
    limit: 20,
  });
  check("lọc theo khoảng ngày (hôm nay)", dateHit?.length === 1);

  const dateMiss = await searchOrEmpty({
    ...ctx,
    fromDate: "2000-01-01",
    toDate: "2000-01-02",
    keyword: "doanh thu",
    limit: 20,
  });
  check("lọc theo khoảng ngày (quá khứ ⇒ rỗng)", dateMiss?.length === 0);

  check(
    "từ khoá không tồn tại ⇒ rỗng",
    (await searchOrEmpty({ ...ctx, keyword: "zzz-khong-ton-tai-zzz", limit: 5 }))?.length === 0
  );

  console.log("\n4) Media & dung lượng");
  const media = await repo.listConversationMedia({ conversationId, emplNo: ctx.emplNo, limit: 50 });
  check("liệt kê media của phòng", media.length === 7, `${media.length} tệp`);
  check(
    "media có người gửi + thời gian",
    media.length > 0 && Boolean(media[0].SENDER_EMPL_NO) && Boolean(media[0].CREATED_AT)
  );

  const mediaPdf = await repo.listConversationMedia({
    conversationId,
    emplNo: ctx.emplNo,
    fileKind: "pdf",
    limit: 50,
  });
  check("media lọc loại = pdf", mediaPdf.length === 1, `${mediaPdf.length} tệp`);

  const storage = await repo.getConversationStorage({ conversationId });
  const expectedBytes = FIXTURES.reduce((sum, item) => sum + 16 + item.name.length, 0);
  check(
    "thống kê dung lượng",
    storage.fileCount === 7 && storage.totalBytes === expectedBytes,
    `${storage.fileCount} tệp / ${storage.totalBytes} bytes`
  );

  console.log("\n5) Dọn dữ liệu mẫu");
  await cleanup(ctx, conversationId, createdMessageIds);
  const afterCleanup = await repo.listConversationMedia({
    conversationId,
    emplNo: ctx.emplNo,
    limit: 50,
  });
  check("đã dọn sạch media mẫu", afterCleanup.length === 0, `${afterCleanup.length} tệp còn lại`);

  console.log(
    `\n===== Đợt 22.6 backend: ${failed === 0 ? "PASS" : "FAIL"} (${passed} pass, ${failed} fail) =====`
  );
  await closePool();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[test] lỗi:", error?.message || error);
  writtenFiles.forEach((file) => fs.promises.unlink(file).catch(() => undefined));
  await closePool().catch(() => undefined);
  process.exit(1);
});
