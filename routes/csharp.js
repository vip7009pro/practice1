const express = require("express");
const router = express.Router();
const { checkLoginIndex } = require("../middleware/auth");
const { processCsharpRequest } = require("../services/csharpService");

// Route chính cho C#
router.post("/", checkLoginIndex, processCsharpRequest);

module.exports = router;