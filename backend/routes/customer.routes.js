const express = require('express');
const router = express.Router();
const customerCtrl = require('../controllers/customer.controller');
const { protect } = require('../middleware/auth.middleware');
const {
    validate,
    customerRules,
    mongoIdParam
} = require('../middleware/validate.middleware');

router.use(protect);

router.post('/sync-from-bills', customerCtrl.syncFromBills);
router.get('/lookup/:mobile', customerCtrl.lookupByMobile);
router.get('/', customerCtrl.getCustomers);
router.post('/', customerRules, validate, customerCtrl.addCustomer);
router.get('/:id', mongoIdParam('id'), validate, customerCtrl.getCustomerById);
router.put('/:id', mongoIdParam('id'), customerRules, validate, customerCtrl.updateCustomer);
router.delete('/:id', mongoIdParam('id'), validate, customerCtrl.deleteCustomer);

module.exports = router;
