const express = require("express");
const router = express.Router();
const { login, logout, loginVendors, logoutVendors } = require("../services/authService");

router.post("/login", login);
router.post("/logout", logout);
router.post("/loginVendors", loginVendors);
router.post("/logoutVendors", logoutVendors);

module.exports = router;