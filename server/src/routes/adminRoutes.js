const express = require("express");
const authRequired = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const controller = require("../controllers/adminController");

const router = express.Router();

router.use(authRequired);
router.use(requireRole("admin"));

router.get("/requests", controller.getRequests);
router.patch("/requests/:id/status", controller.updateRequestStatus);
router.get("/residents", controller.getResidents);
router.get("/activity", controller.getActivity);
router.get("/settings", controller.getSettings);
router.patch("/settings", controller.updateSettings);
router.get("/accounts", controller.getAdminAccounts);
router.post("/accounts", controller.createAdminAccount);
router.delete("/accounts/:id", controller.deleteAdminAccount);

module.exports = router;
