const express = require("express");
const controller = require("../controllers/publicController");

const router = express.Router();

router.get("/settings", controller.getSettings);

module.exports = router;
