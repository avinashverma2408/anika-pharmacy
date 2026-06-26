const Bill = require('../models/Bill');

// POST /api/bills - Save a new invoice
exports.createBill = async (req, res) => {
    try {
        const {
            invoiceNo,
            patientName,
            patientMobile,
            patientAddress,
            doctorName,
            paymentMode,
            billDate,
            items,
            subTotal,
            discountPercent,
            discountAmount,
            taxableValue,
            cgst,
            sgst,
            netTotal
        } = req.body;

        // Verify if invoice number already exists
        const existing = await Bill.findOne({ invoiceNo });
        if (existing) {
            return res.status(400).json({ success: false, message: `Invoice number ${invoiceNo} already exists.` });
        }

        const newBill = await Bill.create({
            invoiceNo,
            patientName: patientName || 'CASH CUSTOMER',
            patientMobile: patientMobile || '',
            patientAddress,
            doctorName: doctorName || '',
            paymentMode: paymentMode || 'Cash',
            billDate: billDate ? new Date(billDate) : new Date(),
            items,
            subTotal,
            discountPercent,
            discountAmount,
            taxableValue,
            cgst,
            sgst,
            netTotal
        });

        res.status(201).json({
            success: true,
            message: 'Invoice saved successfully.',
            bill: newBill
        });
    } catch (err) {
        console.error('Create bill error:', err);
        res.status(500).json({ success: false, message: 'Failed to save invoice.' });
    }
};

// GET /api/bills - Get list of bills with filters
exports.getBills = async (req, res) => {
    try {
        const { search, month, year, date, page = 1, limit = 10 } = req.query;

        const filter = {};

        // Search text on patientName, invoiceNo, patientMobile, or item name
        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { invoiceNo: regex },
                { patientName: regex },
                { patientMobile: regex },
                { 'items.name': regex }
            ];
        }

        // Filter by exact date (Shift Settlement)
        if (date) {
            const queryDate = new Date(date);
            const startDate = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate());
            const endDate = new Date(queryDate.getFullYear(), queryDate.getMonth(), queryDate.getDate() + 1);
            filter.billDate = { $gte: startDate, $lt: endDate };
        } else if (year) {
            const y = parseInt(year);
            if (month) {
                const m = parseInt(month) - 1; // JS month is 0-indexed
                const startDate = new Date(y, m, 1);
                const endDate = new Date(y, m + 1, 1);
                filter.billDate = { $gte: startDate, $lt: endDate };
            } else {
                const startDate = new Date(y, 0, 1);
                const endDate = new Date(y + 1, 0, 1);
                filter.billDate = { $gte: startDate, $lt: endDate };
            }
        }

        const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));

        const [total, bills] = await Promise.all([
            Bill.countDocuments(filter),
            Bill.find(filter).sort({ billDate: -1 }).skip(skip).limit(parseInt(limit)).lean()
        ]);

        res.json({
            success: true,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            bills
        });
    } catch (err) {
        console.error('Get bills error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch bills.' });
    }
};

// GET /api/bills/stats - Aggregate revenue stats
exports.getBillStats = async (req, res) => {
    try {
        const today = new Date();
        const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Overall stats
        const overallResult = await Bill.aggregate([
            {
                $project: {
                    netTotal: 1,
                    billCost: {
                        $sum: {
                            $map: {
                                input: '$items',
                                as: 'item',
                                in: { $multiply: [{ $ifNull: ['$$item.ptr', 0] }, '$$item.quantity'] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$netTotal' },
                    totalBills: { $sum: 1 },
                    totalCost: { $sum: '$billCost' }
                }
            }
        ]);

        // Current Month stats
        const currentMonthResult = await Bill.aggregate([
            {
                $match: {
                    billDate: { $gte: startOfCurrentMonth }
                }
            },
            {
                $project: {
                    netTotal: 1,
                    billCost: {
                        $sum: {
                            $map: {
                                input: '$items',
                                as: 'item',
                                in: { $multiply: [{ $ifNull: ['$$item.ptr', 0] }, '$$item.quantity'] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    monthlyRevenue: { $sum: '$netTotal' },
                    monthlyCount: { $sum: 1 },
                    monthlyCost: { $sum: '$billCost' }
                }
            }
        ]);

        // Month-wise group stats
        const monthlyGroups = await Bill.aggregate([
            {
                $project: {
                    netTotal: 1,
                    billDate: 1,
                    billCost: {
                        $sum: {
                            $map: {
                                input: '$items',
                                as: 'item',
                                in: { $multiply: [{ $ifNull: ['$$item.ptr', 0] }, '$$item.quantity'] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$billDate' },
                        month: { $month: '$billDate' }
                    },
                    revenue: { $sum: '$netTotal' },
                    cost: { $sum: '$billCost' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: {
                    '_id.year': -1,
                    '_id.month': -1
                }
            }
        ]);

        // Top Selling Medicines (Top 5 by quantity)
        const topSelling = await Bill.aggregate([
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.name",
                    category: { $first: "$items.category" },
                    quantity: { $sum: "$items.quantity" },
                    sales: { $sum: "$items.amount" }
                }
            },
            { $sort: { quantity: -1 } },
            { $limit: 5 }
        ]);

        // Top Profitable Medicines (Top 5 by profit)
        const topProfitable = await Bill.aggregate([
            { $unwind: "$items" },
            {
                $project: {
                    name: "$items.name",
                    category: "$items.category",
                    quantity: "$items.quantity",
                    amount: "$items.amount",
                    itemCost: { $multiply: [{ $ifNull: ["$items.ptr", 0] }, "$items.quantity"] }
                }
            },
            {
                $project: {
                    name: 1,
                    category: 1,
                    quantity: 1,
                    amount: 1,
                    profit: { $subtract: ["$amount", "$itemCost"] }
                }
            },
            {
                $group: {
                    _id: "$name",
                    category: { $first: "$category" },
                    quantity: { $sum: "$quantity" },
                    sales: { $sum: "$amount" },
                    profit: { $sum: "$profit" }
                }
            },
            { $sort: { profit: -1 } },
            { $limit: 5 }
        ]);

        // Map monthly groups to format labels
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const formattedMonthlyGroups = monthlyGroups.map(group => {
            const m = group._id.month;
            const y = group._id.year;
            const revenue = group.revenue;
            const cost = group.cost;
            const profit = revenue - cost;
            return {
                year: y,
                month: m,
                label: `${monthNames[m - 1]} ${y}`,
                revenue,
                profit,
                count: group.count
            };
        });

        const lifetimeRevenue = overallResult[0]?.totalRevenue || 0;
        const lifetimeBills = overallResult[0]?.totalBills || 0;
        const lifetimeCost = overallResult[0]?.totalCost || 0;
        const lifetimeProfit = lifetimeRevenue - lifetimeCost;

        const currentMonthRevenue = currentMonthResult[0]?.monthlyRevenue || 0;
        const currentMonthCost = currentMonthResult[0]?.monthlyCost || 0;
        const currentMonthProfit = currentMonthRevenue - currentMonthCost;

        res.json({
            success: true,
            stats: {
                lifetimeRevenue,
                lifetimeBills,
                lifetimeProfit,
                currentMonthRevenue,
                currentMonthProfit,
                monthlyBreakdown: formattedMonthlyGroups,
                topSelling,
                topProfitable
            }
        });
    } catch (err) {
        console.error('Get bill stats error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch billing statistics.' });
    }
};

// DELETE /api/bills/:id - Delete an invoice
exports.deleteBill = async (req, res) => {
    try {
        const bill = await Bill.findByIdAndDelete(req.params.id);
        if (!bill) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }
        res.json({ success: true, message: 'Invoice deleted successfully.' });
    } catch (err) {
        console.error('Delete bill error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete invoice.' });
    }
};
