const Supplier = require('../models/Supplier');
const SupplierTransaction = require('../models/SupplierTransaction');
const Medicine = require('../models/Medicine');

// GET /api/suppliers
exports.getSuppliers = async (req, res) => {
    try {
        const { search, status, dues, sort = 'name', order = 'asc' } = req.query;
        const filter = {};

        if (search && search.trim()) {
            filter.$or = [
                { name: { $regex: search.trim(), $options: 'i' } },
                { contactPerson: { $regex: search.trim(), $options: 'i' } },
                { phone: { $regex: search.trim(), $options: 'i' } },
                { email: { $regex: search.trim(), $options: 'i' } },
                { gstin: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        if (status && status !== 'all') filter.status = status;

        if (dues === 'due') {
            filter.outstandingDues = { $gt: 0 };
        } else if (dues === 'clear') {
            filter.outstandingDues = { $lte: 0 };
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const allowedSort = ['name', 'outstandingDues', 'createdAt', 'updatedAt'];
        const sortField = allowedSort.includes(sort) ? sort : 'name';
        const sortObj = { [sortField]: order === 'desc' ? -1 : 1 };

        const [total, suppliers, duesAgg, withDues] = await Promise.all([
            Supplier.countDocuments(filter),
            Supplier.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
            Supplier.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: null, totalDues: { $sum: '$outstandingDues' }, count: { $sum: 1 } } }
            ]),
            Supplier.countDocuments({ outstandingDues: { $gt: 0 } })
        ]);

        // Linked medicine counts per supplier name
        const names = suppliers.map(s => s.name);
        const medCounts = names.length
            ? await Medicine.aggregate([
                { $match: { stockistName: { $in: names }, status: { $ne: 'Inactive' } } },
                { $group: { _id: '$stockistName', count: { $sum: 1 } } }
            ])
            : [];
        const medCountMap = Object.fromEntries(medCounts.map(m => [m._id, m.count]));

        const result = suppliers.map(s => ({
            ...s,
            id: s._id,
            medicineCount: medCountMap[s.name] || 0
        }));

        res.json({
            success: true,
            count: result.length,
            total,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            summary: {
                activeSuppliers: duesAgg[0]?.count || 0,
                totalOutstandingDues: duesAgg[0]?.totalDues || 0,
                withDues: withDues || 0
            },
            suppliers: result
        });
    } catch (err) {
        console.error('Get suppliers error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch suppliers.' });
    }
};

// GET /api/suppliers/:id
exports.getSupplierById = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id).lean();
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        const [medicineCount, recentTxns] = await Promise.all([
            Medicine.countDocuments({ stockistName: supplier.name, status: { $ne: 'Inactive' } }),
            SupplierTransaction.find({ supplierId: supplier._id })
                .sort({ transactionDate: -1, createdAt: -1 })
                .limit(50)
                .lean()
        ]);

        res.json({
            success: true,
            supplier: {
                ...supplier,
                id: supplier._id,
                medicineCount,
                transactions: recentTxns.map(t => ({ ...t, id: t._id }))
            }
        });
    } catch (err) {
        console.error('Get supplier error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch supplier.' });
    }
};

// POST /api/suppliers
exports.addSupplier = async (req, res) => {
    try {
        const { name, contactPerson, phone, email, address, gstin, notes, status, outstandingDues } = req.body;

        const supplier = await Supplier.create({
            name,
            contactPerson: contactPerson || '',
            phone: phone || '',
            email: email || '',
            address: address || '',
            gstin: gstin || '',
            notes: notes || '',
            status: status || 'Active',
            outstandingDues: outstandingDues ? parseFloat(outstandingDues) : 0
        });

        res.status(201).json({
            success: true,
            message: `"${supplier.name}" added successfully.`,
            supplier: { ...supplier.toObject(), id: supplier._id, medicineCount: 0 }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A supplier with this name already exists.' });
        }
        console.error('Add supplier error:', err);
        res.status(500).json({ success: false, message: 'Failed to add supplier.' });
    }
};

// PUT /api/suppliers/:id
exports.updateSupplier = async (req, res) => {
    try {
        const existing = await Supplier.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        const { name, contactPerson, phone, email, address, gstin, notes, status } = req.body;
        const oldName = existing.name;

        existing.name = name;
        existing.contactPerson = contactPerson || '';
        existing.phone = phone || '';
        existing.email = email || '';
        existing.address = address || '';
        existing.gstin = gstin || '';
        existing.notes = notes || '';
        if (status) existing.status = status;

        await existing.save();

        // Keep medicine stockistName in sync when renamed
        if (oldName !== existing.name) {
            await Medicine.updateMany(
                { stockistName: oldName },
                { $set: { stockistName: existing.name } }
            );
        }

        const medicineCount = await Medicine.countDocuments({
            stockistName: existing.name,
            status: { $ne: 'Inactive' }
        });

        res.json({
            success: true,
            message: `"${existing.name}" updated successfully.`,
            supplier: { ...existing.toObject(), id: existing._id, medicineCount }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A supplier with this name already exists.' });
        }
        console.error('Update supplier error:', err);
        res.status(500).json({ success: false, message: 'Failed to update supplier.' });
    }
};

// DELETE /api/suppliers/:id
exports.deleteSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findByIdAndDelete(req.params.id);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        await SupplierTransaction.deleteMany({ supplierId: req.params.id });

        res.json({
            success: true,
            message: `"${supplier.name}" deleted successfully.`
        });
    } catch (err) {
        console.error('Delete supplier error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete supplier.' });
    }
};

// GET /api/suppliers/:id/transactions
exports.getTransactions = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const filter = { supplierId: supplier._id };
        if (req.query.type && req.query.type !== 'all') filter.type = req.query.type;

        const [total, transactions] = await Promise.all([
            SupplierTransaction.countDocuments(filter),
            SupplierTransaction.find(filter)
                .sort({ transactionDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        res.json({
            success: true,
            total,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            outstandingDues: supplier.outstandingDues,
            transactions: transactions.map(t => ({ ...t, id: t._id }))
        });
    } catch (err) {
        console.error('Get transactions error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch purchase history.' });
    }
};

// POST /api/suppliers/:id/transactions — record purchase / payment / adjustment
exports.addTransaction = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found.' });
        }

        const { type, amount, invoiceNo, notes, transactionDate } = req.body;
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
            return res.status(422).json({ success: false, message: 'Amount must be greater than 0.' });
        }

        let newDues = supplier.outstandingDues;
        if (type === 'purchase') {
            newDues += amt;
        } else if (type === 'payment') {
            if (amt > supplier.outstandingDues) {
                return res.status(422).json({
                    success: false,
                    message: `Payment (₹${amt.toFixed(2)}) cannot exceed outstanding dues (₹${supplier.outstandingDues.toFixed(2)}).`
                });
            }
            newDues -= amt;
        } else if (type === 'adjustment') {
            // Adjustment sets dues to the given amount (absolute balance)
            newDues = amt;
        }

        newDues = Math.max(0, Math.round(newDues * 100) / 100);
        supplier.outstandingDues = newDues;
        await supplier.save();

        const txn = await SupplierTransaction.create({
            supplierId: supplier._id,
            type,
            amount: type === 'adjustment' ? amt : amt,
            invoiceNo: invoiceNo || '',
            notes: notes || '',
            transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
            balanceAfter: newDues
        });

        res.status(201).json({
            success: true,
            message: type === 'purchase'
                ? `Purchase of ₹${amt.toFixed(2)} recorded.`
                : type === 'payment'
                    ? `Payment of ₹${amt.toFixed(2)} recorded.`
                    : `Dues adjusted to ₹${newDues.toFixed(2)}.`,
            transaction: { ...txn.toObject(), id: txn._id },
            outstandingDues: newDues
        });
    } catch (err) {
        console.error('Add transaction error:', err);
        res.status(500).json({ success: false, message: 'Failed to record transaction.' });
    }
};

// POST /api/suppliers/sync-from-stockists — create suppliers from medicine stockist names
exports.syncFromStockists = async (req, res) => {
    try {
        const names = await Medicine.distinct('stockistName', {
            stockistName: { $nin: [null, ''] }
        });

        const unique = [...new Set(
            names.map((n) => String(n).trim()).filter(Boolean)
        )];

        if (unique.length === 0) {
            return res.json({
                success: true,
                message: 'No stockist names found on medicines.',
                created: 0
            });
        }

        const existing = await Supplier.find({ name: { $in: unique } }).select('name').lean();
        const existingSet = new Set(existing.map((s) => s.name));
        const toCreate = unique
            .filter((name) => !existingSet.has(name))
            .map((name) => ({ name, status: 'Active', outstandingDues: 0 }));

        let created = 0;
        if (toCreate.length > 0) {
            const result = await Supplier.insertMany(toCreate, { ordered: false });
            created = result.length;
        }

        res.json({
            success: true,
            message: created > 0
                ? `Synced ${created} supplier(s) from stockist names.`
                : 'All stockists already exist as suppliers.',
            created
        });
    } catch (err) {
        // Partial insert with ordered:false may throw BulkWriteError but still insert some
        if (err?.insertedDocs?.length) {
            return res.json({
                success: true,
                message: `Synced ${err.insertedDocs.length} supplier(s) from stockist names.`,
                created: err.insertedDocs.length
            });
        }
        console.error('Sync suppliers error:', err);
        res.status(500).json({ success: false, message: 'Failed to sync suppliers.' });
    }
};
