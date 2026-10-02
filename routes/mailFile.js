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
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const router = express.Router();
const { checkLoginIndex } = require("../middleware/auth");
const mailStorage = require("../services/mail/mailStorage");
const msgRepo = require("../services/mail/mailMessageRepository");
const outboxRepo = require("../services/mail/mailOutboxRepository");

const MAX_OUTBOX_BYTES = Number(process.env.MAIL_OUTBOX_MAX_BYTES || 25 * 1024 * 1024) || 25 * 1024 * 1024;
const outboxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_OUTBOX_BYTES, files: 1 } });

/** Kiểm tra email có thuộc quyền người dùng; trả row hoặc null. */
async function loadOwnedMessage(id, ctrCd, emplNo) {
  const message = await msgRepo.getMessageWithAccount(id);
  if (!message) return null;
  if (String(message.CTR_CD) !== String(ctrCd)) return null;
  if (message.IS_SHARED === true || message.IS_SHARED === 1) return message;
  if (String(message.ACCOUNT_EMPL_NO || "").trim().toUpperCase() === emplNo) return message;
  return null;
}

/** Đuôi tệp nguy hiểm: KHÔNG bao giờ cho hiển thị inline, luôn tải về dạng octet-stream. */
const DANGEROUS_EXT = new Set([
  "exe", "com", "scr", "pif", "bat", "cmd", "msi", "msp", "cpl", "hta", "jar", "lnk", "reg", "sys",
  "dll", "ps1", "psm1", "vbs", "vbe", "js", "jse", "ws", "wsf", "wsh", "sct", "shb", "gadget", "inf",
  "apk", "app", "dmg", "scf", "vb", "vxd", "workflow",
]);
/** Chỉ những loại này được phép hiển thị inline (ảnh/PDF) — tránh XSS qua HTML/SVG/XML. */
const SAFE_INLINE_TYPES = [
  /^image\/(png|jpe?g|gif|webp|bmp|avif|tiff)$/i,
  /^application\/pdf$/i,
];

/** Đuôi tệp của tên file (không dấu chấm, chữ thường). */
function extensionOf(fileName) {
  const name = String(fileName || "");
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Tệp có phải loại nguy hiểm (thực thi được) không. */
function isDangerous(fileName) {
  return DANGEROUS_EXT.has(extensionOf(fileName));
}

/** Loại nội dung có được hiển thị inline an toàn không. */
function canInline(fileName, contentType) {
  if (isDangerous(fileName)) return false;
  const type = String(contentType || "").split(";")[0].trim();
  return SAFE_INLINE_TYPES.some((re) => re.test(type));
}

/** Phân tích header `Range: bytes=start-end` (chỉ hỗ trợ 1 khoảng, như browser phát media). */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
  if (!match || size <= 0) return null;
  const hasStart = match[1] !== "";
  const hasEnd = match[2] !== "";
  if (!hasStart && !hasEnd) return null;
  let start = hasStart ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = hasStart && hasEnd ? Number(match[2]) : size - 1;
  if (end >= size) end = size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

/**
 * Stream tệp về client.
 * - Hỗ trợ `Range` (206) ⇒ tải lại/tiếp tục được, không nạp cả file vào RAM.
 * - Tệp nguy hiểm: ép `Content-Disposition: attachment` + `application/octet-stream`.
 */
function sendStream(req, res, { storagePath, contentType, fileName, inline }) {
  let probe;
  try {
    probe = mailStorage.openReadStream(storagePath);
  } catch (error) {
    const code = error?.code === "ENOENT" ? 404 : 403;
    return res.status(code).send({ tk_status: "NG", message: error?.message || "Không mở được tệp" });
  }

  const name = fileName || path.basename(storagePath);
  const dangerous = isDangerous(name);
  const requestedRange = parseRange(req.headers.range, probe.size);
  let opened = probe;
  if (requestedRange) {
    probe.stream.destroy();
    try {
      opened = mailStorage.openReadStream(storagePath, requestedRange);
    } catch (error) {
      return res.status(500).send({ tk_status: "NG", message: error?.message || "Không mở được tệp" });
    }
  }

  const asInline = inline === true && !dangerous && canInline(name, contentType);
  res.status(opened.range ? 206 : 200);
  res.setHeader("Content-Type", dangerous ? "application/octet-stream" : contentType || "application/octet-stream");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", opened.range ? opened.range.end - opened.range.start + 1 : opened.size);
  if (opened.range) {
    res.setHeader("Content-Range", `bytes ${opened.range.start}-${opened.range.end}/${opened.size}`);
  }
  const safeName = encodeURIComponent(name);
  res.setHeader("Content-Disposition", `${asInline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (dangerous) res.setHeader("X-Mail-Dangerous", "1");
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
    sendStream(req, res, {
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

    sendStream(req, res, {
      storagePath: attachment.STORAGE_PATH,
      contentType: attachment.CONTENT_TYPE || "application/octet-stream",
      fileName: attachment.FILE_NAME || "attachment",
      inline,
    });
  } catch (error) {
    res.status(500).send({ tk_status: "NG", message: error?.message || String(error) });
  }
}

/* ------------------------------------------------------------------ */
/* Tệp đính kèm SOẠN THẢO (outbox)                                     */
/* ------------------------------------------------------------------ */

/** Thư mục tạm cho tệp soạn thảo (nằm trong kho mail ⇒ cùng ổ đĩa, dễ dọn). */
function outboxFolder() {
  const dir = path.join(mailStorage.resolveMailRoot(), "_outbox");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** POST /mailfile/outbox — upload 1 tệp để đính kèm khi soạn/gửi. */
router.post(
  "/outbox",
  checkLoginIndex,
  (req, res, next) => {
    outboxUpload.single("uploadedfile")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).send({ tk_status: "NG", message: `Tệp vượt quá ${Math.round(MAX_OUTBOX_BYTES / (1024 * 1024))}MB` });
      }
      return res.status(400).send({ tk_status: "NG", message: error?.message || "Upload thất bại" });
    });
  },
  async (req, res) => {
    try {
      const ctrCd = req.payload_data?.CTR_CD;
      const emplNo = String(req.payload_data?.EMPL_NO || "").trim().toUpperCase();
      if (!req.file) return res.status(400).send({ tk_status: "NG", message: "Thiếu file" });

      const ext = path.extname(req.file.originalname || "").slice(0, 12);
      const fileName = `${Date.now()}-${crypto.randomBytes(10).toString("hex")}${ext}`;
      const storagePath = path.join(outboxFolder(), fileName);
      fs.writeFileSync(storagePath, req.file.buffer);

      const id = await outboxRepo.insertOutbox({
        ctrCd,
        emplNo,
        fileName: req.file.originalname || fileName,
        contentType: req.file.mimetype || "application/octet-stream",
        fileSize: req.file.size,
        storagePath,
      });
      res.send({
        tk_status: "OK",
        data: {
          id,
          fileName: req.file.originalname || fileName,
          fileSize: req.file.size,
          contentType: req.file.mimetype || "application/octet-stream",
          // FE cảnh báo người dùng trước khi gửi tệp thực thi được.
          dangerous: isDangerous(req.file.originalname || ""),
        },
      });
    } catch (error) {
      console.error("[mailfile outbox] lỗi:", error?.message || error);
      res.status(500).send({ tk_status: "NG", message: error?.message || String(error) });
    }
  }
);

/** DELETE /mailfile/outbox/:id — bỏ 1 tệp soạn thảo chưa gửi. */
router.delete("/outbox/:id", checkLoginIndex, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const emplNo = String(req.payload_data?.EMPL_NO || "").trim().toUpperCase();
    if (!Number.isInteger(id) || id <= 0) return res.status(400).send({ tk_status: "NG", message: "ID không hợp lệ" });
    const row = await outboxRepo.getOutbox({ id, emplNo });
    if (row) {
      mailStorage.removeFile(row.STORAGE_PATH);
      await outboxRepo.deleteOutbox({ ids: [id], emplNo });
    }
    res.send({ tk_status: "OK", data: { id } });
  } catch (error) {
    res.status(500).send({ tk_status: "NG", message: error?.message || String(error) });
  }
});

module.exports = router;