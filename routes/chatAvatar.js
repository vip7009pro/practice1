/**
 * Route avatar cho phòng chat (nhóm).
 *
 * Khác `/chatfile` (tệp trong hội thoại, cần là thành viên phòng):
 *  - Avatar được upload TRƯỚC khi tạo nhóm (chưa có conversationId) ⇒ chỉ cần đăng nhập.
 *  - Ảnh lưu riêng trong thư mục ghi được, giới hạn 5MB, chỉ nhận ảnh hiển thị được trên web.
 *  - Trả về URL `/chatavatar/<file>` để FE lưu vào `ZTB_CHAT_CONVERSATION.AVATAR`.
 *
 *   POST /chatavatar   (multipart, field "uploadedfile")
 *   GET  /chatavatar/:file
 *
 * ⚠️ BÀI HỌC TỪ LỖI PRODUCTION `POST /chatavatar 400`:
 *  Đường dẫn mặc định cũ là `path.join(__dirname, "..", "outbinary", "chatavatars")`.
 *  Khi backend chạy dưới dạng **pkg** (`npm run build` ⇒ `outbinary/updatebe.exe`), `__dirname`
 *  nằm trong snapshot CHỈ ĐỌC của pkg ⇒ `mkdirSync` lỗi ⇒ multer trả 400 với thông báo khó hiểu.
 *  Nay thư mục được chọn theo thứ tự ưu tiên và LUÔN có phương án dự phòng ghi được.
 */
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const router = express.Router();
const { checkLoginIndex } = require("../middleware/auth");

const MAX_AVATAR_BYTES =
  parseInt(process.env.CHAT_AVATAR_MAX_BYTES || "0", 10) || 5 * 1024 * 1024;

/** MIME ⇒ đuôi lưu trên đĩa (chuẩn hoá để tránh đuôi lạ/không có đuôi). */
const MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/apng": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "image/x-ms-bmp": ".bmp",
  "image/avif": ".avif",
};

/** Đuôi tệp coi là ảnh (dùng khi trình duyệt gửi MIME chung chung như octet-stream). */
const EXT_OK = new Set([
  ".jpg",
  ".jpeg",
  ".jpe",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".avif",
  ".jfif",
]);

/** Định dạng ẢNH nhưng trình duyệt không hiển thị được ⇒ báo rõ để người dùng đổi ảnh khác. */
const UNSUPPORTED_MIME = new Set(["image/heic", "image/heif", "image/tiff"]);
const UNSUPPORTED_EXT = new Set([".heic", ".heif", ".tif", ".tiff"]);

/**
 * Chọn thư mục GHI ĐƯỢC cho avatar.
 *
 * Thứ tự: env `CHAT_AVATAR_FOLDER` → cạnh thư mục upload chat (`CHAT_UPLOAD_FOLDER`) →
 * `outbinary/chatavatars` cạnh tiến trình → thư mục tạm của HĐH.
 * Bỏ qua mọi đường dẫn không tạo/ghi được (ví dụ snapshot chỉ đọc của pkg).
 */
function resolveAvatarFolder() {
  const envChatUpload = String(process.env.CHAT_UPLOAD_FOLDER || "").trim();
  const candidates = [
    process.env.CHAT_AVATAR_FOLDER,
    // Đặt cạnh thư mục chat files để cùng nằm trên ổ đĩa đã cấu hình ghi được cho production.
    envChatUpload ? path.join(path.dirname(envChatUpload), "chatavatars") : null,
    path.join(process.cwd(), "outbinary", "chatavatars"),
    path.join(__dirname, "..", "outbinary", "chatavatars"),
    path.join(os.tmpdir(), "erp-chat-avatars"),
  ].filter(Boolean);

  let lastError = null;
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (error) {
      lastError = error;
      console.warn(`[chatavatar] Không dùng được thư mục "${dir}": ${error?.message || error}`);
    }
  }
  throw lastError || new Error("Không tìm được thư mục lưu avatar");
}

/** Ghi buffer vào tệp — thử lại ở thư mục tạm nếu thư mục chính lỗi. */
function writeAvatarFile(buffer, filename) {
  const primary = resolveAvatarFolder();
  try {
    const target = path.join(primary, filename);
    fs.writeFileSync(target, buffer);
    return { dir: primary, filePath: target };
  } catch (error) {
    const fallback = path.join(os.tmpdir(), "erp-chat-avatars");
    fs.mkdirSync(fallback, { recursive: true });
    const target = path.join(fallback, filename);
    fs.writeFileSync(target, buffer);
    console.warn(
      `[chatavatar] Ghi vào "${primary}" lỗi (${error?.message || error}) ⇒ dùng "${fallback}"`
    );
    return { dir: fallback, filePath: target };
  }
}

// Dùng memoryStorage để tự kiểm soát lỗi ghi đĩa và trả về thông báo rõ ràng
// thay vì thông báo ENOTDIR/EROFS khó hiểu của multer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
});

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
      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).send({
          tk_status: "NG",
          message: 'Sai trường tệp: cần gửi field tên "uploadedfile"',
        });
      }
      console.error("[chatavatar upload] multer:", error?.message || error);
      return res.status(400).send({ tk_status: "NG", message: error?.message || "Upload thất bại" });
    });
  },
  checkLoginIndex,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).send({ tk_status: "NG", message: "Thiếu file" });

      const mime = String(req.file.mimetype || "").toLowerCase();
      const ext = path.extname(req.file.originalname || "").toLowerCase();

      if (UNSUPPORTED_MIME.has(mime) || UNSUPPORTED_EXT.has(ext)) {
        return res.status(400).send({
          tk_status: "NG",
          message: "Ảnh HEIC/TIFF chưa được hỗ trợ. Hãy chọn ảnh JPG/PNG/WEBP.",
        });
      }
      // Chấp nhận nếu MIME là ảnh hợp lệ HOẶC đuôi tệp là ảnh (một số máy gửi MIME chung chung).
      if (!MIME_EXT[mime] && !EXT_OK.has(ext)) {
        return res.status(400).send({
          tk_status: "NG",
          message: "Chỉ nhận ảnh JPG/PNG/GIF/WEBP/BMP/AVIF",
        });
      }

      const finalExt = MIME_EXT[mime] || (ext === ".jpeg" ? ".jpg" : ext || ".jpg");
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${finalExt}`;

      try {
        writeAvatarFile(req.file.buffer, filename);
      } catch (error) {
        console.error("[chatavatar upload] ghi tệp:", error);
        return res.status(500).send({
          tk_status: "NG",
          message: `Không lưu được ảnh trên máy chủ (${error?.code || error?.message || "lỗi ghi đĩa"})`,
        });
      }

      res.send({
        tk_status: "OK",
        data: { url: `/chatavatar/${filename}`, size: req.file.size },
      });
    } catch (error) {
      console.error("[chatavatar upload]", error);
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

  // Ảnh có thể nằm ở thư mục chính hoặc thư mục tạm dự phòng (xem writeAvatarFile).
  let dirs = [];
  try {
    dirs.push(resolveAvatarFolder());
  } catch {
    /* không resolve được thư mục chính ⇒ chỉ thử thư mục tạm */
  }
  dirs.push(path.join(os.tmpdir(), "erp-chat-avatars"));

  const target = dirs.map((dir) => path.join(dir, name)).find((file) => fs.existsSync(file));
  if (!target) {
    return res.status(404).send({ tk_status: "NG", message: "Ảnh không tồn tại" });
  }

  res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(target).pipe(res);
});

module.exports = router;
