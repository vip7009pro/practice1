const express = require("express");
const router = express.Router();
const { processApi } = require("../services/dbService");
const { checkLoginVendorsIndex } = require("../middleware/auth");

router.post("/", checkLoginVendorsIndex, processApi);

module.exports = router;