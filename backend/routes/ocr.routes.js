const express = require("express");
const router = express.Router();
const ocrCtrl = require("../controllers/ocr.controller");
const { protect } = require("../middleware/auth.middleware");

// Require auth
router.use(protect);

router.post("/scan-bill", ocrCtrl.scanBill);

module.exports = router;
