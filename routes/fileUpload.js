const express = require("express");
const multer = require("multer");
const router = express.Router();
const { uploadFile } = require("../services/fileService");
const { checkLoginUpdateIndex } = require("../middleware/auth");


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.TEMP_UPLOAD_FOLDER),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

router.post("/", checkLoginUpdateIndex, upload.single("uploadedfile"), uploadFile);

module.exports = router;