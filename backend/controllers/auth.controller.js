const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOtpEmail } = require('../utils/emailService');

let generateOTP;
import('../../shared/sharedUtils.js').then(utils => {
    generateOTP = utils.generateOTP;
}).catch(err => {
    console.error('Failed to load shared utils in auth.controller.js:', err);
});

// Sign JWT token
const signToken = (userId) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!');
        throw new Error('JWT_SECRET is not configured. Please set it in environment variables.');
    }
    return jwt.sign({ id: userId }, secret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password. Please try again.'
            });
        }

        const token = signToken(user._id);

        res.json({
            success: true,
            message: 'Login successful. Welcome to Anika Pharmacy!',
            token,
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = email.toLowerCase();
        const ADMIN_EMAILS = ['admin@anika.yopmail.com', 'avinashverma2408@gmail.com', 'admin@anika.com'];

        // Allow only whitelisted emails
        if (!ADMIN_EMAILS.includes(normalizedEmail)) {
            return res.status(404).json({
                success: false,
                message: 'this user is not exit'
            });
        }

        let user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            // Seed admin user if not found (admin@anika.com / admin123)
            const newUser = new User({
                email: 'admin@anika.com',
                passwordHash: 'admin123',
                role: 'admin'
            });
            user = await newUser.save();
        }

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.otpCode = otp;
        user.otpExpiry = otpExpiry;
        await user.save({ validateBeforeSave: false });

        // Send OTP email
        try {
            await sendOtpEmail(email, otp);
        } catch (emailErr) {
            console.error('Email send error:', emailErr.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email. Please check email configuration.'
            });
        }

        // Return success – include OTP in dev mode for easy testing
        if (process.env.NODE_ENV !== 'production') {
            res.json({
                success: true,
                message: 'OTP sent to your email address. Valid for 10 minutes.',
                otp: otp // only for development
            });
        } else {
            res.json({
                success: true,
                message: 'OTP sent to your email address. Valid for 10 minutes.'
            });
        }
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.otpCode !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP code. Please try again.'
            });
        }

        if (!user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        res.json({
            success: true,
            message: 'OTP verified successfully. You may now reset your password.'
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || user.otpCode !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP. Please restart the reset process.'
            });
        }

        if (!user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Set new password and clear OTP
        user.passwordHash = newPassword; // pre-save hook will hash it
        user.otpCode = null;
        user.otpExpiry = null;
        await user.save();

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// POST /api/auth/update-password  (requires auth)
exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user._id);
        if (!user || !(await user.comparePassword(currentPassword))) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        user.passwordHash = newPassword; // pre-save hook hashes it
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully.'
        });
    } catch (err) {
        console.error('Update password error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
