const express = require("express");
const multer = require("multer");
const fs = require("fs");
const router = express.Router();
const { uploadFile } = require("../services/fileService");
const { checkLoginUpdateIndex } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = process.env.TEMP_UPLOAD_FOLDER;
    if (tempDir && !fs.existsSync(tempDir)) {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
      } catch (err) {
        console.error("Error creating TEMP_UPLOAD_FOLDER:", err);
      }
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_BYTES || "0", 10) || 20 * 1024 * 1024 * 1024,
  },
});

router.post("/", checkLoginUpdateIndex, (req, res, next) => {
  req.on("aborted", () => {
    console.log("uploadfile aborted by client");
  });

  upload.single("uploadedfile")(req, res, (err) => {
    if (err) {
      const msg = err && err.code ? `${err.code}: ${err.message}` : String(err);
      res.status(400).send({ tk_status: "NG", message: "Upload file thất bại: " + msg });
      return;
    }
    next();
  });
}, uploadFile);

module.exports = router;