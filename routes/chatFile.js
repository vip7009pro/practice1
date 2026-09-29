/**
 * Route file cho chat nội bộ.
 *
 * Khác `/uploadfile` hiện có (phục vụ file ERP chung, auth mở), route này:
 *  - BẮT BUỘC xác thực JWT (cookie/Bearer/query token).
 *  - Chỉ cho upload khi user là thành viên đang hoạt động của phòng chat.
 *  - Giới hạn 25MB và allowlist MIME.
 *  - Tên file lưu ngẫu nhiên, KHÔNG phục vụ qua đường dẫn tĩnh đoán được.
 *  - Tải file phải qua endpoint kiểm tra quyền thành viên.
 */
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const router = express.Router();
const { checkLoginIndex } = require("../middleware/auth");
const repo = require("../services/chat/chatRepository");
const chatCore = require("../services/chat/chatMessageCore");

const MAX_CHAT_FILE_BYTES =
  parseInt(process.env.CHAT_UPLOAD_MAX_BYTES || "0", 10) || 25 * 1024 * 1024;

const CHAT_UPLOAD_FOLDER =
  process.env.CHAT_UPLOAD_FOLDER || path.join(__dirname, "..", "outbinary", "chatfiles");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const EXT_ALLOWED = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".zip",
  ".rar",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(CHAT_UPLOAD_FOLDER, { recursive: true });
      cb(null, CHAT_UPLOAD_FOLDER);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_CHAT_FILE_BYTES, files: 1 },
});

/** Upload 1 file rồi gắn vào phòng chat (chưa gắn message — gắn khi gửi tin). */
router.post(
  "/",
  upload.single("uploadedfile"),
  checkLoginIndex,
  async (req, res) => {
    const cleanup = () => {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => undefined);
    };

    try {
      const ctrCd = req.payload_data?.CTR_CD;
      const emplNo = req.payload_data?.EMPL_NO;
      const conversationId = Number(req.body?.CONVERSATION_ID || req.body?.conversationId);

      if (!req.file) return res.status(400).send({ tk_status: "NG", message: "Thiếu file" });
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        cleanup();
        return res.status(400).send({ tk_status: "NG", message: "Thiếu CONVERSATION_ID" });
      }

      const ext = path.extname(req.file.originalname || "").toLowerCase();
      if (!ALLOWED_MIME.has(req.file.mimetype) || !EXT_ALLOWED.has(ext)) {
        cleanup();
        return res.status(400).send({ tk_status: "NG", message: "Định dạng file không được phép" });
      }

      const membership = await chatCore.getActiveMembership(conversationId, emplNo);
      if (!membership) {
        cleanup();
        return res.status(403).send({ tk_status: "NG", message: "Bạn không có quyền gửi file vào phòng này" });
      }

      const saved = await repo.insertAttachment({
        conversationId,
        ctrCd,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        storagePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: emplNo,
      });

      res.send({
        tk_status: "OK",
        data: {
          attachmentId: saved.ATTACHMENT_ID,
          originalName: saved.ORIGINAL_NAME,
          mimeType: saved.MIME_TYPE,
          fileSize: saved.FILE_SIZE,
          url: `/chatfile/${saved.ATTACHMENT_ID}`,
        },
      });
    } catch (error) {
      console.error("[chatfile upload]", error);
      cleanup();
      res.status(500).send({ tk_status: "NG", message: "Upload file chat thất bại" });
    }
  }
);

/** Tải file — chỉ thành viên đang hoạt động của phòng được tải. */
router.get("/:attachmentId", checkLoginIndex, async (req, res) => {
  try {
    const emplNo = req.payload_data?.EMPL_NO;
    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).send({ tk_status: "NG", message: "File không hợp lệ" });
    }

    const attachment = await repo.getAttachmentById({ attachmentId });
    if (!attachment) return res.status(404).send({ tk_status: "NG", message: "File không tồn tại" });

    const membership = await chatCore.getActiveMembership(attachment.CONVERSATION_ID, emplNo);
    if (!membership) {
      return res.status(403).send({ tk_status: "NG", message: "Bạn không có quyền tải file này" });
    }

    if (!fs.existsSync(attachment.STORAGE_PATH)) {
      return res.status(410).send({ tk_status: "NG", message: "File đã bị xoá khỏi máy chủ" });
    }

    // Chống path traversal: chỉ phục vụ file nằm trong thư mục upload của chat.
    const resolved = path.resolve(attachment.STORAGE_PATH);
    if (!resolved.startsWith(path.resolve(CHAT_UPLOAD_FOLDER))) {
      return res.status(403).send({ tk_status: "NG", message: "Đường dẫn file không hợp lệ" });
    }

    const safeName = String(attachment.ORIGINAL_NAME || "file").replace(/[\r\n"]/g, "");
    res.setHeader("Content-Type", attachment.MIME_TYPE || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`
    );
    fs.createReadStream(resolved).pipe(res);
  } catch (error) {
    console.error("[chatfile download]", error);
    res.status(500).send({ tk_status: "NG", message: "Không tải được file" });
  }
});

module.exports = router;
