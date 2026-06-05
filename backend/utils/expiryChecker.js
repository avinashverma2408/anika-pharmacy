const cron = require('node-cron');
const Medicine = require('../models/Medicine');
const Notification = require('../models/Notification');
let calculateDaysDifference, formatDateDisplay, getExpiryStatus;
import('../../shared/sharedUtils.js').then(utils => {
    calculateDaysDifference = utils.calculateDaysDifference;
    formatDateDisplay = utils.formatDateDisplay;
    getExpiryStatus = utils.getExpiryStatus;
}).catch(err => {
    console.error('Failed to load shared utils in expiryChecker.js:', err);
});

/**
 * Get expiry category for a medicine based on days remaining
 */
function getExpiryAlert(daysLeft, medicine) {
    const { name, batch, expiryDate } = medicine;
    const expiryStr = formatDateDisplay(expiryDate);
    const { status, severity } = getExpiryStatus(daysLeft);

    if (status === 'expired') {
        return {
            type: 'expired', severity,
            message: `⚠️ CRITICAL: "${name}" (Batch #${batch}) has EXPIRED on ${expiryStr}! Discard immediately.`,
            hindiMessage: `दवा "${name}" (Batch #${batch}) एक्सपायर हो चुकी है (${expiryStr})! इसे तुरंत नष्ट करें।`
        };
    } else if (status === 'expiry') {
        return {
            type: 'expiry', severity,
            message: `🚨 URGENT: "${name}" (Batch #${batch}) EXPIRES TODAY! Remove from sales inventory.`,
            hindiMessage: `दवा "${name}" (Batch #${batch}) आज एक्सपायर हो रही है! इसे तुरंत बिक्री से हटाएं।`
        };
    } else if (status === '7days') {
        return {
            type: '7days', severity,
            message: `⚠️ WARNING: "${name}" (Batch #${batch}) will expire in ${daysLeft} day(s) on ${expiryStr}.`,
            hindiMessage: `चेतावनी: "${name}" (Batch #${batch}) ${daysLeft} दिन में एक्सपायर होने वाली है।`
        };
    } else if (status === '20days') {
        return {
            type: '20days', severity,
            message: `🔔 NOTICE: "${name}" (Batch #${batch}) will expire in ${daysLeft} days on ${expiryStr}.`,
            hindiMessage: `सूचना: "${name}" (Batch #${batch}) ${daysLeft} दिनों में एक्सपायर होने वाली है।`
        };
    }
    return null;
}

/**
 * Main expiry checker — called by cron and on-demand
 */
async function checkAndCreateExpiryAlerts() {
    try {
        const medicines = await Medicine.find({ status: { $ne: 'Inactive' } });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let newCount = 0;

        for (const med of medicines) {
            const daysLeft = calculateDaysDifference(today, med.expiryDate);

            const alert = getExpiryAlert(daysLeft, med);
            if (!alert) continue;

            // Check if this type of alert was already created today for this medicine
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const existing = await Notification.findOne({
                medicineId: med._id,
                type: alert.type,
                createdAt: { $gte: todayStart, $lte: todayEnd }
            });

            if (!existing) {
                await Notification.create({
                    medicineId: med._id,
                    medicineName: med.name,
                    batch: med.batch,
                    type: alert.type,
                    severity: alert.severity,
                    message: alert.message,
                    hindiMessage: alert.hindiMessage,
                    read: false
                });
                newCount++;
                console.log(`🔔 Alert created: ${alert.type} for "${med.name}"`);
            }
        }

        if (newCount > 0) {
            console.log(`✅ Expiry check: ${newCount} new alert(s) created`);
        } else {
            console.log('✅ Expiry check: No new alerts needed');
        }

        return newCount;
    } catch (err) {
        console.error('❌ Expiry check error:', err.message);
        throw err;
    }
}

/**
 * Schedule daily cron job at 8:00 AM
 */
function startExpiryChecker() {
    // Run immediately on server start
    checkAndCreateExpiryAlerts();

    // Run every day at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ [CRON] Running daily expiry check...');
        await checkAndCreateExpiryAlerts();
    }, { timezone: 'Asia/Kolkata' });

    console.log('⏰ Expiry checker cron job scheduled (daily 8:00 AM IST)');
}

module.exports = { startExpiryChecker, checkAndCreateExpiryAlerts, getExpiryAlert };
