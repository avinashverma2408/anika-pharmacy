const express = require('express');
const router = express.Router();
const supplierCtrl = require('../controllers/supplier.controller');
const { protect } = require('../middleware/auth.middleware');
const {
    validate,
    supplierRules,
    supplierTransactionRules,
    mongoIdParam
} = require('../middleware/validate.middleware');

router.use(protect);

router.post('/sync-from-stockists', supplierCtrl.syncFromStockists);
router.get('/', supplierCtrl.getSuppliers);
router.post('/', supplierRules, validate, supplierCtrl.addSupplier);
router.get('/:id', mongoIdParam('id'), validate, supplierCtrl.getSupplierById);
router.put('/:id', mongoIdParam('id'), supplierRules, validate, supplierCtrl.updateSupplier);
router.delete('/:id', mongoIdParam('id'), validate, supplierCtrl.deleteSupplier);
router.get('/:id/transactions', mongoIdParam('id'), validate, supplierCtrl.getTransactions);
router.post(
    '/:id/transactions',
    mongoIdParam('id'),
    supplierTransactionRules,
    validate,
    supplierCtrl.addTransaction
);

module.exports = router;
