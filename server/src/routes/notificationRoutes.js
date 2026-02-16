const express = require("express");
const authRequired = require("../middleware/auth");
const controller = require("../controllers/notificationController");

const router = express.Router();

router.use(authRequired);
router.get("/me", controller.getMyNotifications);
router.patch("/me/read-all", controller.markAllRead);

module.exports = router;
