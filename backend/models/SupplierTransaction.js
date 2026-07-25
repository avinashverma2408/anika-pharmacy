const mongoose = require('mongoose');

const supplierTransactionSchema = new mongoose.Schema({
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: {
            values: ['purchase', 'payment', 'adjustment'],
            message: 'Type must be purchase, payment, or adjustment'
        }
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0'],
        max: [99999999, 'Amount seems too high']
    },
    invoiceNo: {
        type: String,
        trim: true,
        default: '',
        maxlength: [50, 'Invoice number cannot exceed 50 characters']
    },
    notes: {
        type: String,
        trim: true,
        default: '',
        maxlength: [300, 'Notes cannot exceed 300 characters']
    },
    transactionDate: {
        type: Date,
        default: Date.now
    },
    balanceAfter: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

supplierTransactionSchema.index({ supplierId: 1, transactionDate: -1 });
supplierTransactionSchema.index({ type: 1 });

module.exports = mongoose.model('SupplierTransaction', supplierTransactionSchema);
