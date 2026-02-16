const express = require("express");
const authRequired = require("../middleware/auth");
const controller = require("../controllers/userController");

const router = express.Router();

router.use(authRequired);
router.get("/me", controller.getMe);
router.patch("/me", controller.updateMe);
router.patch("/me/password", controller.updateMyPassword);
router.patch("/me/preferences", controller.updatePreferences);

module.exports = router;
