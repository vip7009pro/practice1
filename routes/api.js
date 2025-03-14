const express = require("express");
const router = express.Router();
const { processApi } = require("../services/dbService");
const { checkLoginIndex } = require("../middleware/auth");

router.post("/", checkLoginIndex, processApi);

module.exports = router;