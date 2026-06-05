const Medicine = require('../models/Medicine');
const { checkAndCreateExpiryAlerts } = require('../utils/expiryChecker');

let calculateDaysDifference;
import('../../shared/sharedUtils.js').then(utils => {
    calculateDaysDifference = utils.calculateDaysDifference;
}).catch(err => {
    console.error('Failed to load shared utils in medicine.controller.js:', err);
});

// GET /api/medicines
exports.getMedicines = async (req, res) => {
    try {
        const { search, category, status, expiry, sort = 'createdAt', order = 'desc' } = req.query;

        const filter = {};

        // Text search on name or batch
        if (search && search.trim()) {
            filter.$or = [
                { name: { $regex: search.trim(), $options: 'i' } },
                { batch: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        if (category && category !== 'all') filter.category = category;
        if (status && status !== 'all') filter.status = status;

        // Expiry filter
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (expiry === 'expired') {
            filter.expiryDate = { $lt: today };
        } else if (expiry === 'expires-today') {
            const tmrw = new Date(today); tmrw.setDate(tmrw.getDate() + 1);
            filter.expiryDate = { $gte: today, $lt: tmrw };
        } else if (expiry === 'expires-7') {
            const d7 = new Date(today); d7.setDate(d7.getDate() + 7);
            filter.expiryDate = { $gte: today, $lte: d7 };
        } else if (expiry === 'expires-20') {
            const d20 = new Date(today); d20.setDate(d20.getDate() + 20);
            filter.expiryDate = { $gte: today, $lte: d20 };
        } else if (expiry === 'safe') {
            const d20 = new Date(today); d20.setDate(d20.getDate() + 20);
            filter.expiryDate = { $gt: d20 };
        }

        const sortObj = {};
        const sortField = ['name', 'price', 'quantity', 'expiryDate', 'createdAt'].includes(sort) ? sort : 'createdAt';
        sortObj[sortField] = order === 'asc' ? 1 : -1;

        const medicines = await Medicine.find(filter).sort(sortObj).limit(20).lean();

        // Add daysUntilExpiry to each item
        const result = medicines.map(m => {
            return {
                ...m,
                id: m._id, // alias for frontend compatibility
                daysUntilExpiry: calculateDaysDifference(today, m.expiryDate)
            };
        });

        res.json({ success: true, count: result.length, medicines: result });
    } catch (err) {
        console.error('Get medicines error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch medicines.' });
    }
};

// POST /api/medicines
exports.addMedicine = async (req, res) => {
    try {
        const { name, category, batch, price, quantity, expiryDate, status } = req.body;

        const medicine = await Medicine.create({
            name, category, batch, price: parseFloat(price),
            quantity: parseInt(quantity), expiryDate, status
        });

        // Trigger expiry check for the new medicine
        await checkAndCreateExpiryAlerts();

        res.status(201).json({
            success: true,
            message: `"${medicine.name}" added successfully.`,
            medicine: { ...medicine.toObject(), id: medicine._id }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A medicine with this batch number already exists.' });
        }
        console.error('Add medicine error:', err);
        res.status(500).json({ success: false, message: 'Failed to add medicine.' });
    }
};

// PUT /api/medicines/:id
exports.updateMedicine = async (req, res) => {
    try {
        const { name, category, batch, price, quantity, expiryDate, status } = req.body;

        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            { name, category, batch, price: parseFloat(price), quantity: parseInt(quantity), expiryDate, status },
            { new: true, runValidators: true }
        );

        if (!medicine) {
            return res.status(404).json({ success: false, message: 'Medicine not found.' });
        }

        // Re-run expiry check
        await checkAndCreateExpiryAlerts();

        res.json({
            success: true,
            message: `"${medicine.name}" updated successfully.`,
            medicine: { ...medicine.toObject(), id: medicine._id }
        });
    } catch (err) {
        console.error('Update medicine error:', err);
        res.status(500).json({ success: false, message: 'Failed to update medicine.' });
    }
};

// DELETE /api/medicines/:id
exports.deleteMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findByIdAndDelete(req.params.id);

        if (!medicine) {
            return res.status(404).json({ success: false, message: 'Medicine not found.' });
        }

        // Delete related notifications
        const Notification = require('../models/Notification');
        await Notification.deleteMany({ medicineId: req.params.id });

        res.json({
            success: true,
            message: `"${medicine.name}" deleted successfully.`
        });
    } catch (err) {
        console.error('Delete medicine error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete medicine.' });
    }
};

// PATCH /api/medicines/:id/status
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) {
            return res.status(404).json({ success: false, message: 'Medicine not found.' });
        }

        medicine.status = status;
        // Auto adjust quantity when going out of stock
        if (status === 'Out of Stock') {
            medicine.quantity = 0;
        } else if (status === 'Active' && medicine.quantity === 0) {
            medicine.quantity = 10; // Default restock
        }

        await medicine.save();

        res.json({
            success: true,
            message: `Status changed to "${status}" successfully.`,
            medicine: { ...medicine.toObject(), id: medicine._id }
        });
    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
};
