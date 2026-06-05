const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const {
    validate,
    loginRules,
    forgotPasswordRules,
    verifyOtpRules,
    resetPasswordRules,
    updatePasswordRules
} = require('../middleware/validate.middleware');

// Public routes
router.post('/login',           loginRules,          validate, authCtrl.login);
router.post('/forgot-password', forgotPasswordRules, validate, authCtrl.forgotPassword);
router.post('/verify-otp',      verifyOtpRules,      validate, authCtrl.verifyOtp);
router.post('/reset-password',  resetPasswordRules,  validate, authCtrl.resetPassword);

// Protected routes
router.post('/update-password', protect, updatePasswordRules, validate, authCtrl.updatePassword);

module.exports = router;
