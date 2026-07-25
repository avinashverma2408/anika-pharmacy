const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const { upsertFromBill, normalizeMobile } = require('../utils/customerUpsert');

// GET /api/customers
exports.getCustomers = async (req, res) => {
    try {
        const { search, status, sort = 'lastVisitAt', order = 'desc' } = req.query;
        const filter = {};

        if (search && search.trim()) {
            const term = search.trim();
            const digits = normalizeMobile(term);
            filter.$or = [
                { name: { $regex: term, $options: 'i' } },
                { address: { $regex: term, $options: 'i' } },
                { preferredDoctor: { $regex: term, $options: 'i' } }
            ];
            if (digits) {
                filter.$or.push({ mobile: { $regex: digits, $options: 'i' } });
            }
        }

        if (status && status !== 'all') filter.status = status;

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const allowedSort = ['name', 'mobile', 'lastVisitAt', 'totalSpent', 'totalPurchases', 'createdAt'];
        const sortField = allowedSort.includes(sort) ? sort : 'lastVisitAt';
        const sortObj = { [sortField]: order === 'asc' ? 1 : -1 };

        const [total, customers, summaryAgg] = await Promise.all([
            Customer.countDocuments(filter),
            Customer.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
            Customer.aggregate([
                { $match: { status: 'Active' } },
                {
                    $group: {
                        _id: null,
                        activeCustomers: { $sum: 1 },
                        totalSpent: { $sum: '$totalSpent' },
                        totalPurchases: { $sum: '$totalPurchases' }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            count: customers.length,
            total,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            summary: {
                activeCustomers: summaryAgg[0]?.activeCustomers || 0,
                totalSpent: summaryAgg[0]?.totalSpent || 0,
                totalPurchases: summaryAgg[0]?.totalPurchases || 0
            },
            customers: customers.map((c) => ({ ...c, id: c._id }))
        });
    } catch (err) {
        console.error('Get customers error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch customers.' });
    }
};

// GET /api/customers/lookup/:mobile
exports.lookupByMobile = async (req, res) => {
    try {
        const mobile = normalizeMobile(req.params.mobile);
        if (mobile.length < 10) {
            return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile.' });
        }

        const customer = await Customer.findOne({ mobile }).lean();
        if (!customer) {
            return res.json({ success: true, found: false, customer: null });
        }

        const recentBills = await Bill.find({ customerId: customer._id })
            .sort({ billDate: -1 })
            .limit(5)
            .select('invoiceNo billDate netTotal paymentMode')
            .lean();

        res.json({
            success: true,
            found: true,
            customer: { ...customer, id: customer._id, recentBills }
        });
    } catch (err) {
        console.error('Lookup customer error:', err);
        res.status(500).json({ success: false, message: 'Failed to lookup customer.' });
    }
};

// GET /api/customers/:id
exports.getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id).lean();
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }

        const bills = await Bill.find({
            $or: [
                { customerId: customer._id },
                { patientMobile: customer.mobile }
            ]
        })
            .sort({ billDate: -1 })
            .limit(50)
            .lean();

        res.json({
            success: true,
            customer: {
                ...customer,
                id: customer._id,
                bills: bills.map((b) => ({ ...b, id: b._id }))
            }
        });
    } catch (err) {
        console.error('Get customer error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch customer.' });
    }
};

// POST /api/customers
exports.addCustomer = async (req, res) => {
    try {
        const mobile = normalizeMobile(req.body.mobile);
        if (mobile.length < 10) {
            return res.status(422).json({ success: false, message: 'Mobile must be at least 10 digits.' });
        }

        const customer = await Customer.create({
            name: (req.body.name || '').trim() || 'CASH CUSTOMER',
            mobile,
            address: req.body.address || '',
            preferredDoctor: req.body.preferredDoctor || '',
            notes: req.body.notes || '',
            status: req.body.status || 'Active'
        });

        res.status(201).json({
            success: true,
            message: `"${customer.name}" added successfully.`,
            customer: { ...customer.toObject(), id: customer._id }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A customer with this mobile already exists.' });
        }
        console.error('Add customer error:', err);
        res.status(500).json({ success: false, message: 'Failed to add customer.' });
    }
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }

        if (req.body.mobile !== undefined) {
            const mobile = normalizeMobile(req.body.mobile);
            if (mobile.length < 10) {
                return res.status(422).json({ success: false, message: 'Mobile must be at least 10 digits.' });
            }
            customer.mobile = mobile;
        }

        if (req.body.name !== undefined) customer.name = String(req.body.name).trim() || customer.name;
        if (req.body.address !== undefined) customer.address = req.body.address || '';
        if (req.body.preferredDoctor !== undefined) customer.preferredDoctor = req.body.preferredDoctor || '';
        if (req.body.notes !== undefined) customer.notes = req.body.notes || '';
        if (req.body.status) customer.status = req.body.status;

        await customer.save();

        res.json({
            success: true,
            message: `"${customer.name}" updated successfully.`,
            customer: { ...customer.toObject(), id: customer._id }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A customer with this mobile already exists.' });
        }
        console.error('Update customer error:', err);
        res.status(500).json({ success: false, message: 'Failed to update customer.' });
    }
};

// DELETE /api/customers/:id
exports.deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByIdAndDelete(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }

        // Keep bills; only detach customer reference
        await Bill.updateMany(
            { customerId: req.params.id },
            { $unset: { customerId: 1 } }
        );

        res.json({
            success: true,
            message: `"${customer.name}" deleted successfully.`
        });
    } catch (err) {
        console.error('Delete customer error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete customer.' });
    }
};

// POST /api/customers/sync-from-bills
exports.syncFromBills = async (req, res) => {
    try {
        const bills = await Bill.find({
            patientMobile: { $nin: [null, ''] }
        }).select('patientName patientMobile patientAddress doctorName billDate netTotal').lean();

        let created = 0;
        let updated = 0;
        const seen = new Set();

        for (const bill of bills) {
            const mobile = normalizeMobile(bill.patientMobile);
            if (mobile.length < 10 || seen.has(mobile)) continue;
            seen.add(mobile);

            const existing = await Customer.findOne({ mobile });
            if (!existing) {
                await upsertFromBill({
                    name: bill.patientName,
                    mobile,
                    address: bill.patientAddress,
                    doctorName: bill.doctorName,
                    billDate: bill.billDate,
                    netTotal: 0
                });
                created++;
            } else {
                updated++;
            }
        }

        // Recalculate aggregates from all bills
        const customers = await Customer.find();
        for (const customer of customers) {
            const stats = await Bill.aggregate([
                {
                    $match: {
                        $or: [
                            { customerId: customer._id },
                            { patientMobile: customer.mobile }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPurchases: { $sum: 1 },
                        totalSpent: { $sum: '$netTotal' },
                        lastVisitAt: { $max: '$billDate' }
                    }
                }
            ]);

            if (stats[0]) {
                customer.totalPurchases = stats[0].totalPurchases;
                customer.totalSpent = stats[0].totalSpent;
                customer.lastVisitAt = stats[0].lastVisitAt;
                await customer.save();
            }

            await Bill.updateMany(
                { patientMobile: customer.mobile, customerId: { $exists: false } },
                { $set: { customerId: customer._id } }
            );
            await Bill.updateMany(
                { patientMobile: customer.mobile, customerId: null },
                { $set: { customerId: customer._id } }
            );
        }

        res.json({
            success: true,
            message: `Synced customers from bills (${created} new, ${updated} existing).`,
            created,
            updated
        });
    } catch (err) {
        console.error('Sync customers error:', err);
        res.status(500).json({ success: false, message: 'Failed to sync customers from bills.' });
    }
};

exports.upsertFromBill = upsertFromBill;
exports.normalizeMobile = normalizeMobile;
