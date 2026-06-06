const express = require('express');
const router = express.Router();
const medCtrl = require('../controllers/medicine.controller');
const { protect } = require('../middleware/auth.middleware');
const {
    validate,
    medicineRules,
    statusUpdateRules,
    mongoIdParam
} = require('../middleware/validate.middleware');

// All routes require auth
router.use(protect);

router.get('/counts',   medCtrl.getMedicineCounts);
router.get('/',         medCtrl.getMedicines);
router.post('/',        medicineRules,                   validate, medCtrl.addMedicine);
router.put('/:id',      mongoIdParam('id'), medicineRules, validate, medCtrl.updateMedicine);
router.delete('/:id',   mongoIdParam('id'),              validate, medCtrl.deleteMedicine);
router.patch('/:id/status', mongoIdParam('id'), statusUpdateRules, validate, medCtrl.updateStatus);

module.exports = router;
