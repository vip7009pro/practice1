/**
 * Route avatar cho phòng chat (nhóm).
 *
 * Khác `/chatfile` (tệp trong hội thoại, cần là thành viên phòng):
 *  - Avatar được upload TRƯỚC khi tạo nhóm (chưa có conversationId) ⇒ chỉ cần đăng nhập.
 *  - Ảnh lưu riêng trong `outbinary/chatavatars/`, giới hạn 5MB, chỉ nhận ảnh.
 *  - Trả về URL `/chatavatar/<file>` để FE lưu vào `ZTB_CHAT_CONVERSATION.AVATAR`.
 *
 *   POST /chatavatar   (multipart, field "uploadedfile")
 *   GET  /chatavatar/:file
 */
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const router = express.Router();
const { checkLoginIndex } = require("../middleware/auth");

const MAX_AVATAR_BYTES =
  parseInt(process.env.CHAT_AVATAR_MAX_BYTES || "0", 10) || 5 * 1024 * 1024;

const AVATAR_FOLDER =
  process.env.CHAT_AVATAR_FOLDER || path.join(__dirname, "..", "outbinary", "chatavatars");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"]);
const EXT_ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(AVATAR_FOLDER, { recursive: true });
      cb(null, AVATAR_FOLDER);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } });

router.post(
  "/",
  (req, res, next) => {
    upload.single("uploadedfile")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).send({
          tk_status: "NG",
          message: `Ảnh vượt quá giới hạn ${Math.round(MAX_AVATAR_BYTES / (1024 * 1024))}MB`,
        });
      }
      console.error("[chatavatar upload] multer:", error?.message || error);
      return res.status(400).send({ tk_status: "NG", message: error?.message || "Upload thất bại" });
    });
  },
  checkLoginIndex,
  async (req, res) => {
    const cleanup = () => {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => undefined);
    };

    try {
      if (!req.file) return res.status(400).send({ tk_status: "NG", message: "Thiếu file" });

      const ext = path.extname(req.file.originalname || "").toLowerCase();
      if (!ALLOWED_MIME.has(req.file.mimetype) || !EXT_ALLOWED.has(ext)) {
        cleanup();
        return res.status(400).send({ tk_status: "NG", message: "Chỉ nhận ảnh JPG/PNG/GIF/WEBP/BMP" });
      }

      res.send({
        tk_status: "OK",
        data: {
          url: `/chatavatar/${req.file.filename}`,
          size: req.file.size,
        },
      });
    } catch (error) {
      console.error("[chatavatar upload]", error);
      cleanup();
      res.status(500).send({ tk_status: "NG", message: "Upload avatar thất bại" });
    }
  }
);

/** Phục vụ ảnh avatar (chỉ đọc, không cho path traversal). */
router.get("/:file", (req, res) => {
  const name = path.basename(String(req.params.file || ""));
  if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) {
    return res.status(400).send({ tk_status: "NG", message: "Tên file không hợp lệ" });
  }
  const target = path.join(AVATAR_FOLDER, name);
  if (!fs.existsSync(target)) {
    return res.status(404).send({ tk_status: "NG", message: "Ảnh không tồn tại" });
  }
  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(target).pipe(res);
});

module.exports = router;
