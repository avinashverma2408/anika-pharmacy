const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    medicineName: { type: String, required: true },
    batch: { type: String, required: true },
    type: {
        type: String,
        enum: ['expired', 'expiry', '7days', '20days', 'low-stock', 'out-of-stock'],
        required: true
    },
    severity: {
        type: String,
        enum: ['critical', 'orange', 'warning'],
        required: true
    },
    message: { type: String, required: true },
    hindiMessage: { type: String, required: true },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Prevent duplicate alerts for same medicine + type combo (per day)
notificationSchema.index(
    { medicineId: 1, type: 1, createdAt: 1 },
    { unique: false }
);

module.exports = mongoose.model('Notification', notificationSchema);
