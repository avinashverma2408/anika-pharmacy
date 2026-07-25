const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
        maxlength: [120, 'Name cannot exceed 120 characters'],
        default: 'CASH CUSTOMER'
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true,
        unique: true,
        minlength: [10, 'Mobile must be 10 digits'],
        maxlength: [15, 'Mobile cannot exceed 15 digits']
    },
    address: {
        type: String,
        trim: true,
        default: '',
        maxlength: [300, 'Address cannot exceed 300 characters']
    },
    preferredDoctor: {
        type: String,
        trim: true,
        default: '',
        maxlength: [120, 'Doctor name cannot exceed 120 characters']
    },
    notes: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    totalPurchases: {
        type: Number,
        default: 0,
        min: 0
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: 0
    },
    lastVisitAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

customerSchema.index({ name: 'text', mobile: 'text', address: 'text' });
customerSchema.index({ lastVisitAt: -1 });
customerSchema.index({ totalSpent: -1 });

module.exports = mongoose.model('Customer', customerSchema);
