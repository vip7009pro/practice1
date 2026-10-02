/**
 * Seed dữ liệu DEMO cho module Email (để xem UI khi chưa nối POP3 thật).
 *  - Tạo 1 mailbox DÙNG CHUNG (IS_SHARED=1) để MỌI user trong công ty thấy được.
 *  - Chèn 3 email: HTML + đính kèm, plain text, và 1 email body lớn lưu NAS (BODY_STORAGE_PATH).
 *  - IS_ACTIVE=0 để worker KHÔNG cố kết nối POP3 (tránh log lỗi).
 *
 * Chạy: node scratch/seed_mail_demo.js
 * Dọn: node scratch/seed_mail_demo.js --clean
 */
const mailRepo = require("../services/mail/mailRepository");
const msgRepo = require("../services/mail/mailMessageRepository");
const mailStorage = require("../services/mail/mailStorage");
const { openConnection } = require("../config/database");

// CTR_CD và email demo được suy ra lúc chạy (mã công ty thật của nhân sự).
let CTR = String(process.env.MAIL_DEMO_CTR || "").trim();
let DEMO_EMAIL = "demo-mailbox@cmsvina.local";

/** Suy ra mã công ty (CTR_CD) thật của 1 nhân sự để mailbox demo nằm đúng công ty. */
async function resolveCtr(emplNo) {
  if (CTR) return CTR;
  const rows = await mailRepo.queryRows(
    `SELECT TOP 1 LTRIM(RTRIM(CTR_CD)) AS CTR FROM ZTBEMPLINFO WHERE LTRIM(RTRIM(EMPL_NO)) = @E`,
    { E: String(emplNo || "NHU1903").trim().toUpperCase() }
  );
  return rows[0]?.CTR || "CMS";
}

async function clean() {
  const acc = await mailRepo.findAccountByEmail({ ctrCd: CTR, emailAddress: DEMO_EMAIL });
  if (!acc) {
    console.log("[seed] không có dữ liệu demo để dọn");
    return;
  }
  await mailRepo.queryRows(
    `DELETE a FROM ZTB_MAIL_ATTACHMENT a JOIN ZTB_MAIL_MESSAGE m ON m.ID = a.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID = @ACC;
     DELETE r FROM ZTB_MAIL_RECIPIENT r JOIN ZTB_MAIL_MESSAGE m ON m.ID = r.MESSAGE_ID WHERE m.MAIL_ACCOUNT_ID = @ACC;
     DELETE m FROM ZTB_MAIL_MESSAGE m WHERE m.MAIL_ACCOUNT_ID = @ACC;
     DELETE FROM ZTB_MAIL_SYNC_LOG WHERE MAIL_ACCOUNT_ID = @ACC;
     DELETE FROM ZTB_MAIL_SYNC_CHECKPOINT WHERE MAIL_ACCOUNT_ID = @ACC;`,
    { ACC: acc.ID }
  );
  await mailRepo.queryRows(`DELETE FROM ZTB_MAIL_ACCOUNT WHERE ID = @ID`, { ID: acc.ID });
  console.log(`[seed] đã dọn mailbox demo #${acc.ID}`);
}

async function insertDemoMessage(account, fields) {
  return mailRepo.withTransaction(async (tx) => {
    const id = await msgRepo.insertMessage(tx, {
      mailAccountId: account.ID,
      folder: "INBOX",
      ...fields,
    });
    await msgRepo.insertRecipients(tx, id, [
      { type: "TO", address: "nhanvien@cmsvina.local", name: "Nhân viên" },
    ]);
    for (const att of fields.__attachments || []) {
      const phys = mailStorage.writePhysicalFile(att.content, att.ext || "");
      const physicalId = await msgRepo.ensurePhysicalFileTx(tx, {
        hash: phys.hash,
        storagePath: phys.storagePath,
        size: phys.size,
      });
      await msgRepo.insertAttachment(tx, {
        messageId: id,
        fileName: att.fileName,
        contentType: att.contentType,
        fileSize: phys.size,
        isInline: false,
        fileHash: phys.hash,
        physicalFileId: physicalId,
        status: "READY",
      });
    }
    return id;
  });
}

async function main() {
  const emplArg = (process.argv.find((a) => a.startsWith("--empl=")) || "").split("=")[1] || "NHU1903";
  CTR = await resolveCtr(emplArg);
  DEMO_EMAIL = `demo-mailbox-${CTR.toLowerCase()}@cmsvina.local`;
  console.log(`[seed] dùng CTR_CD="${CTR}", email=${DEMO_EMAIL}`);

  if (process.argv.includes("--clean")) {
    await clean();
    try { (await openConnection()).close(); } catch { /* bỏ qua */ }
    return;
  }

  await clean();

  const accountId = await mailRepo.insertAccount({
    ctrCd: CTR,
    emplNo: null,
    emailAddress: DEMO_EMAIL,
    displayName: "Hộp thư demo (dùng chung)",
    pop3Host: "mail.cmsvina.local",
    pop3Port: 995,
    pop3Secure: true,
    pop3Username: DEMO_EMAIL,
    isActive: false, // KHÔNG để worker thử kết nối
    isShared: true,
  });
  await mailRepo.ensureCheckpoint(accountId);
  const account = { ID: accountId, CTR_CD: CTR, EMAIL_ADDRESS: DEMO_EMAIL };

  const now = new Date();
  const receivedAt = (offsetMinutes) => new Date(now.getTime() - offsetMinutes * 60000);

  // 1) HTML + đính kèm
  await insertDemoMessage(account, {
    uidl: "demo-uidl-1",
    messageId: "<demo-1@cmsvina.local>",
    fromAddress: "ketoan@cmsvina.local",
    fromName: "Phòng Kế toán",
    subject: "Báo cáo công nợ tháng 9/2026",
    sentAt: receivedAt(35),
    receivedAt: receivedAt(35),
    previewText: "Gửi anh/chị báo cáo công nợ tháng 9, vui lòng kiểm tra và phản hồi trước 05/10.",
    bodyInline:
      '<div style="font-family:Arial,sans-serif;font-size:13px;color:#0f172a">' +
      "<p>Kính gửi Anh/Chị,</p>" +
      "<p>Đính kèm là <b>báo cáo công nợ tháng 9/2026</b>. Vui lòng kiểm tra và phản hồi trước <b>05/10</b>.</p>" +
      '<table style="border-collapse:collapse;margin:10px 0"><tr><th style="border:1px solid #cbd5e1;padding:6px 10px;background:#f1f5f9">Khách hàng</th>' +
      '<th style="border:1px solid #cbd5e1;padding:6px 10px;background:#f1f5f9">Số tiền</th></tr>' +
      '<tr><td style="border:1px solid #cbd5e1;padding:6px 10px">Công ty ABC</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right">125,000,000</td></tr>' +
      '<tr><td style="border:1px solid #cbd5e1;padding:6px 10px">Công ty XYZ</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right">48,500,000</td></tr></table>' +
      "<p>Trân trọng,<br/>Phòng Kế toán</p></div>",
    hasAttachment: true,
    attachmentCount: 1,
    sizeBytes: 4096,
    toJson: JSON.stringify([{ address: "nhanvien@cmsvina.local", name: "Nhân viên" }]),
    ccJson: JSON.stringify([
      { address: "giamdoc@cmsvina.local", name: "Giám đốc" },
      { address: "ketoan1@cmsvina.local", name: "Kế toán 1" },
      { address: "ketoan2@cmsvina.local", name: "Kế toán 2" },
      { address: "kho@cmsvina.local", name: "Bộ phận Kho" },
      { address: "sanxuat@cmsvina.local", name: "Phòng Sản xuất" },
      { address: "qc@cmsvina.local", name: "Phòng QC" },
      { address: "mua@cmsvina.local", name: "Phòng Mua" },
    ]),
    __attachments: [
      { fileName: "cong-no-thang-9.csv", contentType: "text/csv", ext: ".csv", content: Buffer.from("khach_hang,so_tien\nABC,125000000\nXYZ,48500000\n") },
    ],
  });

  // 2) Plain text
  await insertDemoMessage(account, {
    uidl: "demo-uidl-2",
    messageId: "<demo-2@cmsvina.local>",
    fromAddress: "kho@cmsvina.local",
    fromName: "Bộ phận Kho",
    subject: "Xác nhận xuất kho lô NVL-2026-09",
    sentAt: receivedAt(120),
    receivedAt: receivedAt(120),
    previewText: "Đã xuất kho 1.200 kg theo phiếu XK-0912. Đề nghị bộ phận nhận kiểm tra số lượng.",
    bodyInline:
      "<div style='font-family:Arial,sans-serif;font-size:13px'>Đã xuất kho <b>1.200 kg</b> theo phiếu <b>XK-0912</b>.<br/>Đề nghị bộ phận nhận kiểm tra số lượng.</div>",
    hasAttachment: false,
    attachmentCount: 0,
    sizeBytes: 1024,
  });

  // 3) Body lớn lưu NAS (để test /mailfile/body/:id)
  const bigHtml =
    "<div style='font-family:Arial,sans-serif;font-size:13px'>" +
    "<h3>Báo cáo sản xuất chi tiết</h3>" +
    Array.from({ length: 400 }, (_, i) => `<p>Dòng ${i + 1}: sản lượng ổn định, không có bất thường.</p>`).join("") +
    "</div>";
  const dir = mailStorage.buildMessageDir({ ctrCd: CTR, sentAt: receivedAt(300), mailboxKey: DEMO_EMAIL, messageRef: "demo-3" });
  const bodyPath = mailStorage.writeBody(bigHtml, dir);
  await insertDemoMessage(account, {
    uidl: "demo-uidl-3",
    messageId: "<demo-3@cmsvina.local>",
    fromAddress: "sanxuat@cmsvina.local",
    fromName: "Phòng Sản xuất",
    subject: "Báo cáo sản xuất tuần 39 — chi tiết đính kèm",
    sentAt: receivedAt(300),
    receivedAt: receivedAt(300),
    previewText: "Báo cáo sản xuất chi tiết tuần 39. Nội dung dài nên lưu thành tệp trên NAS.",
    bodyStoragePath: bodyPath,
    hasAttachment: false,
    attachmentCount: 0,
    sizeBytes: bigHtml.length,
  });

  const unread = await msgRepo.countUnread({ accountIds: [accountId], emplNo: emplArg });
  console.log(`[seed] OK — mailbox demo #${accountId} (${DEMO_EMAIL}), CTR=${CTR}, 3 email, unread(cho ${emplArg})=${unread}`);
  try { (await openConnection()).close(); } catch { /* bỏ qua */ }
}

main().catch((e) => {
  console.error("[seed] lỗi:", e);
  process.exit(1);
});
