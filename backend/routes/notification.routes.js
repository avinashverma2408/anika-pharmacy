const express = require('express');
const router = express.Router();
const notifCtrl = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require auth
router.use(protect);

router.get('/',                  notifCtrl.getNotifications);
router.patch('/mark-all-read',   notifCtrl.markAllRead);
router.delete('/',               notifCtrl.clearAll);

// Dashboard stats (mounted at /api/dashboard/stats)
router.get('/stats',             notifCtrl.getDashboardStats);

module.exports = router;
