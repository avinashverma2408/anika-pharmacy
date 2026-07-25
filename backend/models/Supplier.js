const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Supplier name is required'],
        trim: true,
        unique: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    contactPerson: {
        type: String,
        trim: true,
        default: '',
        maxlength: [100, 'Contact person cannot exceed 100 characters']
    },
    phone: {
        type: String,
        trim: true,
        default: '',
        maxlength: [20, 'Phone cannot exceed 20 characters']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
        maxlength: [100, 'Email cannot exceed 100 characters']
    },
    address: {
        type: String,
        trim: true,
        default: '',
        maxlength: [300, 'Address cannot exceed 300 characters']
    },
    gstin: {
        type: String,
        trim: true,
        uppercase: true,
        default: '',
        maxlength: [15, 'GSTIN cannot exceed 15 characters']
    },
    outstandingDues: {
        type: Number,
        min: [0, 'Outstanding dues cannot be negative'],
        default: 0
    },
    notes: {
        type: String,
        trim: true,
        default: '',
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    status: {
        type: String,
        enum: {
            values: ['Active', 'Inactive'],
            message: 'Status must be Active or Inactive'
        },
        default: 'Active'
    }
}, {
    timestamps: true
});

supplierSchema.index({ name: 'text', contactPerson: 'text', phone: 'text' });
supplierSchema.index({ status: 1 });
supplierSchema.index({ outstandingDues: -1 });

module.exports = mongoose.model('Supplier', supplierSchema);
