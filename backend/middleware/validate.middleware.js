const { body, param, query, validationResult } = require('express-validator');

// Reusable: send validation errors as response
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
};

// --- Auth Validators ---
const loginRules = [
    body('email')
        .trim().notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address'),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const forgotPasswordRules = [
    body('email')
        .trim().notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address')
];

const verifyOtpRules = [
    body('email')
        .trim().notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address'),
    body('otp')
        .trim().notEmpty().withMessage('OTP is required')
        .isLength({ min: 4, max: 4 }).withMessage('OTP must be exactly 4 digits')
        .isNumeric().withMessage('OTP must contain only digits')
];

const resetPasswordRules = [
    body('email')
        .trim().notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Enter a valid email address'),
    body('otp')
        .trim().notEmpty().withMessage('OTP is required')
        .isLength({ min: 4, max: 4 }).withMessage('OTP must be exactly 4 digits'),
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/\d/).withMessage('Password must contain at least one number'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) throw new Error('Passwords do not match');
            return true;
        })
];

const updatePasswordRules = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
        .matches(/\d/).withMessage('Password must contain at least one number'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) throw new Error('Passwords do not match');
            return true;
        })
];

// --- Medicine Validators ---
const medicineRules = [
    body('name')
        .trim().notEmpty().withMessage('Medicine name is required')
        .isLength({ min: 2, max: 150 }).withMessage('Name must be 2-150 characters'),
    body('category')
        .trim().notEmpty().withMessage('Category is required')
        .isIn(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Vaccine', 'Ointment', 'Other'])
        .withMessage('Invalid category'),
    body('batch')
        .trim().notEmpty().withMessage('Batch number is required')
        .isLength({ min: 2, max: 30 }).withMessage('Batch must be 2-30 characters')
        .matches(/^[A-Za-z0-9\-]+$/).withMessage('Batch can only contain letters, numbers, and hyphens'),
    body('price')
        .notEmpty().withMessage('Price is required')
        .isFloat({ min: 0.01, max: 999999 }).withMessage('Price must be between 0.01 and 999,999'),
    body('quantity')
        .notEmpty().withMessage('Quantity is required')
        .isInt({ min: 0, max: 999999 }).withMessage('Quantity must be 0 or more'),
    body('expiryDate')
        .notEmpty().withMessage('Expiry date is required')
        .isISO8601().withMessage('Expiry date must be a valid date (YYYY-MM-DD)'),
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['Active', 'Inactive', 'Out of Stock']).withMessage('Invalid status'),
    body('stockistName')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 100 }).withMessage('Stockist name cannot exceed 100 characters'),
    body('ptr')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 999999 }).withMessage('PTR must be between 0 and 999,999'),
    body('hsn')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 20 }).withMessage('HSN must be 20 characters or less'),
    body('pack')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 20 }).withMessage('Pack must be 20 characters or less'),
    body('gstRate')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('GST rate must be a percentage between 0 and 100')
];

const statusUpdateRules = [
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['Active', 'Inactive', 'Out of Stock']).withMessage('Invalid status')
];

const mongoIdParam = (paramName = 'id') => [
    param(paramName)
        .isMongoId().withMessage(`Invalid ${paramName} — must be a valid MongoDB ID`)
];

module.exports = {
    validate,
    loginRules,
    forgotPasswordRules,
    verifyOtpRules,
    resetPasswordRules,
    updatePasswordRules,
    medicineRules,
    statusUpdateRules,
    mongoIdParam
};
