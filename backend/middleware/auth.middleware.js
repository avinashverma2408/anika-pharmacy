const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided. Please login.'
        });
    }

    try {
        const secret = process.env.JWT_SECRET || 'anika_pharmacy_jwt_secret_key_2026';
        const decoded = jwt.verify(token, secret);
        req.user = await User.findById(decoded.id).select('-passwordHash -otpCode -otpExpiry');

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not found. Token invalid.'
            });
        }

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Please login again.'
        });
    }
};

module.exports = { protect };
