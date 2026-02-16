const express = require("express");
const authRequired = require("../middleware/auth");
const controller = require("../controllers/requestController");

const router = express.Router();

router.use(authRequired);
router.get("/me", controller.getMyRequests);
router.post("/", controller.createRequest);
router.patch("/:id/cancel", controller.cancelRequest);
router.delete("/me/non-pending", controller.clearNonPending);
router.get("/:id/receipt", controller.getReceipt);

module.exports = router;
