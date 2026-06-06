const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Medicine name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [150, 'Name cannot exceed 150 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: {
            values: ['Tablet', 'Syrup', 'Injection', 'Vaccine', 'Ointment', 'Other'],
            message: 'Category must be one of: Tablet, Syrup, Injection, Vaccine, Ointment, Other'
        }
    },
    batch: {
        type: String,
        required: [true, 'Batch number is required'],
        trim: true,
        uppercase: true,
        minlength: [2, 'Batch must be at least 2 characters'],
        maxlength: [30, 'Batch cannot exceed 30 characters']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0.01, 'Price must be greater than 0'],
        max: [999999, 'Price seems too high']
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        max: [999999, 'Quantity seems too high'],
        default: 0
    },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required']
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: {
            values: ['Active', 'Inactive', 'Out of Stock'],
            message: 'Status must be: Active, Inactive, or Out of Stock'
        },
        default: 'Active'
    },
    stockistName: {
        type: String,
        trim: true,
        default: ''
    },
    ptr: {
        type: Number,
        min: [0, 'PTR/Purchasing rate cannot be negative'],
        max: [999999, 'PTR seems too high'],
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual: days left until expiry (based on real today)
medicineSchema.virtual('daysUntilExpiry').get(function () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(this.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
});

// Index for fast search
medicineSchema.index({ name: 'text', batch: 'text' });
medicineSchema.index({ expiryDate: 1 });
medicineSchema.index({ status: 1 });

module.exports = mongoose.model('Medicine', medicineSchema);
