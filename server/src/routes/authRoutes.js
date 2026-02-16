const express = require("express");
const authRequired = require("../middleware/auth");
const controller = require("../controllers/authController");

const router = express.Router();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", authRequired, controller.me);
router.post("/forgot-password", controller.forgotPassword);
router.post("/verify-reset-code", controller.verifyResetCode);
router.post("/reset-password", controller.resetPassword);

module.exports = router;
