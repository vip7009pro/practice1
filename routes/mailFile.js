/**
 * Route stream file cho module Email (body HTML + đính kèm).
 *
 *   GET /mailfile/body/:messageId         — stream body HTML (email body lưu trên NAS)
 *   GET /mailfile/attachment/:attachId    — tải/stream đính kèm
 *   GET /mailfile/attachment/:attachId/inline — như trên nhưng Content-Disposition: inline (ảnh nhúng)
 *
 * Bảo mật:
 *  - Bắt buộc đăng nhập (`checkLoginIndex`).
 *  - Chỉ cho tải khi email thuộc mailbox người dùng sở hữu HOẶC mailbox dùng chung cùng công ty.
 *  - KHÔNG nhận path tuỳ ý từ client: id → tra DB → resolve path trong MAIL_STORAGE_PATH.
 *  - Stream từng phần (fs.createReadStream) — KHÔNG nạp cả file vào RAM.
 */
const express = require("express");
const path = require("path");
const router = express.Router();
const { checkLoginIndex } = require("../middleware/auth");
const mailStorage = require("../services/mail/mailStorage");
const msgRepo = require("../services/mail/mailMessageRepository");

/** Kiểm tra email có thuộc quyền người dùng; trả row hoặc null. */
async function loadOwnedMessage(id, ctrCd, emplNo) {
  const message = await msgRepo.getMessageWithAccount(id);
  if (!message) return null;
  if (String(message.CTR_CD) !== String(ctrCd)) return null;
  if (message.IS_SHARED === true || message.IS_SHARED === 1) return message;
  if (String(message.ACCOUNT_EMPL_NO || "").trim().toUpperCase() === emplNo) return message;
  return null;
}

function sendStream(res, { storagePath, contentType, fileName, inline }) {
  let opened;
  try {
    opened = mailStorage.openReadStream(storagePath);
  } catch (error) {
    const code = error?.code === "ENOENT" ? 404 : 403;
    return res.status(code).send({ tk_status: "NG", message: error?.message || "Không mở được tệp" });
  }
  if (contentType) res.setHeader("Content-Type", contentType);
  const safeName = encodeURIComponent(fileName || path.basename(storagePath));
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`
  );
  res.setHeader("Content-Length", opened.size);
  res.setHeader("X-Content-Type-Options", "nosniff");
  opened.stream.on("error", (error) => {
    console.error("[mailfile] stream lỗi:", error?.message || error);
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  opened.stream.pipe(res);
}

router.get("/body/:messageId", checkLoginIndex, async (req, res) => {
  try {
    const id = Number(req.params.messageId);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).send({ tk_status: "NG", message: "ID không hợp lệ" });
    const message = await loadOwnedMessage(id, req.payload_data?.CTR_CD, String(req.payload_data?.EMPL_NO || "").trim().toUpperCase());
    if (!message) return res.status(403).send({ tk_status: "NG", message: "Không có quyền" });
    if (!message.BODY_STORAGE_PATH) {
      return res.status(404).send({ tk_status: "NG", message: "Email không có body tách rời" });
    }
    sendStream(res, {
      storagePath: message.BODY_STORAGE_PATH,
      contentType: "text/html; charset=utf-8",
      fileName: "email.html",
      inline: true,
    });
  } catch (error) {
    res.status(500).send({ tk_status: "NG", message: error?.message || String(error) });
  }
});

router.get("/attachment/:attachId", checkLoginIndex, async (req, res) => {
  await handleAttachment(req, res, false);
});

router.get("/attachment/:attachId/inline", checkLoginIndex, async (req, res) => {
  await handleAttachment(req, res, true);
});

async function handleAttachment(req, res, inline) {
  try {
    const id = Number(req.params.attachId);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).send({ tk_status: "NG", message: "ID không hợp lệ" });
    const attachment = await msgRepo.getAttachmentById(id);
    if (!attachment) return res.status(404).send({ tk_status: "NG", message: "Không tìm thấy đính kèm" });

    const message = await loadOwnedMessage(
      attachment.MESSAGE_ID,
      req.payload_data?.CTR_CD,
      String(req.payload_data?.EMPL_NO || "").trim().toUpperCase()
    );
    if (!message) return res.status(403).send({ tk_status: "NG", message: "Không có quyền" });
    if (!attachment.STORAGE_PATH) {
      return res.status(404).send({ tk_status: "NG", message: "Đính kèm chưa sẵn sàng" });
    }

    sendStream(res, {
      storagePath: attachment.STORAGE_PATH,
      contentType: attachment.CONTENT_TYPE || "application/octet-stream",
      fileName: attachment.FILE_NAME || "attachment",
      inline,
    });
  } catch (error) {
    res.status(500).send({ tk_status: "NG", message: error?.message || String(error) });
  }
}

module.exports = router;
