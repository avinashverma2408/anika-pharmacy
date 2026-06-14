const Notification = require('../models/Notification');
const Medicine = require('../models/Medicine');
const { checkAndCreateExpiryAlerts } = require('../utils/expiryChecker');

// GET /api/notifications
exports.getNotifications = async (req, res) => {
    try {
        const simulatedDate = req.headers['x-simulated-date'];
        await checkAndCreateExpiryAlerts(simulatedDate);

        const { severity, read } = req.query;
        const filter = {};

        if (severity && severity !== 'all') filter.severity = severity;
        if (read === 'true') filter.read = true;
        if (read === 'false') filter.read = false;

        // Pagination
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
        const skip  = (page - 1) * limit;

        const [total, notifications] = await Promise.all([
            Notification.countDocuments(filter),
            Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
        ]);

        const result = notifications.map(n => ({
            ...n,
            id: n._id,
            timestamp: new Date(n.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            }) + ' (' + new Date(n.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }) + ')'
        }));

        const unreadCount = await Notification.countDocuments({ read: false });

        res.json({
            success: true,
            count: result.length,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            unreadCount,
            notifications: result
        });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
    }
};

// PATCH /api/notifications/mark-all-read
exports.markAllRead = async (req, res) => {
    try {
        const result = await Notification.updateMany({ read: false }, { read: true });
        res.json({
            success: true,
            message: `${result.modifiedCount} notification(s) marked as read.`
        });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ success: false, message: 'Failed to mark notifications as read.' });
    }
};

// DELETE /api/notifications
exports.clearAll = async (req, res) => {
    try {
        const result = await Notification.deleteMany({});
        res.json({
            success: true,
            message: `${result.deletedCount} notification(s) cleared.`
        });
    } catch (err) {
        console.error('Clear notifications error:', err);
        res.status(500).json({ success: false, message: 'Failed to clear notifications.' });
    }
};

// GET /api/dashboard/stats
exports.getDashboardStats = async (req, res) => {
    try {
        const simulatedDate = req.headers['x-simulated-date'];
        await checkAndCreateExpiryAlerts(simulatedDate);

        const today = simulatedDate ? new Date(simulatedDate) : new Date();
        today.setHours(0, 0, 0, 0);
        const d7 = new Date(today); d7.setDate(d7.getDate() + 7);
        const d20 = new Date(today); d20.setDate(d20.getDate() + 20);

        const [
            totalMedicines,
            activeMedicines, // Active & Safe (expiry > 20 days)
            outOfStock,
            expiredCount,
            expiring20Days,
            expiring7Days,
            expiringToday,
            inactiveCount,
            unreadNotifications
        ] = await Promise.all([
            Medicine.countDocuments({ status: { $ne: 'Inactive' } }),
            Medicine.countDocuments({ status: 'Active', expiryDate: { $gt: d20 }, quantity: { $gt: 0 } }),
            Medicine.countDocuments({ status: { $ne: 'Inactive' }, $or: [{ status: 'Out of Stock' }, { quantity: 0 }], expiryDate: { $gte: today } }),
            Medicine.countDocuments({ status: { $ne: 'Inactive' }, expiryDate: { $lt: today } }),
            Medicine.countDocuments({ status: 'Active', expiryDate: { $gte: today, $lte: d20 }, quantity: { $gt: 0 } }),
            Medicine.countDocuments({ status: 'Active', expiryDate: { $gte: today, $lte: d7 }, quantity: { $gt: 0 } }),
            Medicine.countDocuments({ status: 'Active', expiryDate: { $gte: today, $lt: new Date(today.getTime() + 86400000) }, quantity: { $gt: 0 } }),
            Medicine.countDocuments({ status: 'Inactive' }),
            Notification.countDocuments({ read: false })
        ]);

        // Recent alerts (last 5)
        const recentAlerts = await Notification.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Medicines expiring soon (next 20 days)
        const expiringSoon = await Medicine.find({
            status: 'Active',
            quantity: { $gt: 0 },
            expiryDate: { $gte: today, $lte: d20 }
        }).sort({ expiryDate: 1 }).limit(5).lean();

        res.json({
            success: true,
            stats: {
                totalMedicines,
                activeMedicines,
                outOfStock,
                expiredCount,
                expiring20Days,
                expiring7Days,
                expiringToday,
                inactiveCount,
                unreadNotifications
            },
            recentAlerts: recentAlerts.map(n => ({ ...n, id: n._id })),
            expiringSoon: expiringSoon.map(m => ({
                ...m,
                id: m._id,
                daysUntilExpiry: Math.ceil((new Date(m.expiryDate).setHours(0,0,0,0) - today.getTime()) / 86400000)
            }))
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
    }
};
