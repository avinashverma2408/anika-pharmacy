const express = require('express');
const router = express.Router();
const billCtrl = require('../controllers/bill.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require auth
router.use(protect);

router.post('/',      billCtrl.createBill);
router.get('/',       billCtrl.getBills);
router.get('/stats',  billCtrl.getBillStats);
router.delete('/:id', billCtrl.deleteBill);

module.exports = router;
