const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
    medicineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    batch: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    ptr: {
        type: Number,
        default: 0
    },
    gstRate: {
        type: Number,
        default: 5
    },
    amount: {
        type: Number,
        required: true
    }
});

const billSchema = new mongoose.Schema({
    invoiceNo: {
        type: String,
        required: [true, 'Invoice number is required'],
        unique: true,
        trim: true
    },
    patientName: {
        type: String,
        default: 'CASH CUSTOMER',
        trim: true
    },
    patientMobile: {
        type: String,
        default: '',
        trim: true
    },
    patientAddress: {
        type: String,
        default: '',
        trim: true
    },
    doctorName: {
        type: String,
        default: '',
        trim: true
    },
    paymentMode: {
        type: String,
        required: true,
        enum: ['Cash', 'Card', 'UPI'],
        default: 'Cash'
    },
    billDate: {
        type: Date,
        default: Date.now
    },
    items: [billItemSchema],
    subTotal: {
        type: Number,
        required: true,
        default: 0
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    taxableValue: {
        type: Number,
        required: true,
        default: 0
    },
    cgst: {
        type: Number,
        required: true,
        default: 0
    },
    sgst: {
        type: Number,
        required: true,
        default: 0
    },
    netTotal: {
        type: Number,
        required: true,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for fast querying
billSchema.index({ patientName: 'text', invoiceNo: 'text', patientMobile: 'text' });
billSchema.index({ billDate: -1 });

module.exports = mongoose.model('Bill', billSchema);
