/**
 * Shared utility functions for both backend (Node.js) and frontend (Vite React)
 */

export function getLocalDateString(dateObj) {
    const date = new Date(dateObj);
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const dd   = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function addDays(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return getLocalDateString(date);
}

export function calculateDaysDifference(startDateStr, endDateStr) {
    const start = new Date(startDateStr); start.setHours(0,0,0,0);
    const end   = new Date(endDateStr);   end.setHours(0,0,0,0);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

export function formatDateDisplay(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTimeDisplay(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const datePart = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const timePart = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
}

export function getExpiryStatus(daysLeft) {
    if (daysLeft < 0) {
        return { status: 'expired', severity: 'critical', urgencyClass: 'critical', daysLabel: 'EXPIRED' };
    } else if (daysLeft === 0) {
        return { status: 'expiry', severity: 'critical', urgencyClass: 'critical', daysLabel: 'EXPIRES TODAY' };
    } else if (daysLeft <= 7) {
        return { status: '7days', severity: 'orange', urgencyClass: 'orange', daysLabel: `${daysLeft} Days (Expiring next week)` };
    } else if (daysLeft <= 20) {
        return { status: '20days', severity: 'warning', urgencyClass: 'warning', daysLabel: `${daysLeft} Days left` };
    }
    return { status: 'safe', severity: 'success', urgencyClass: 'safe', daysLabel: `${daysLeft} Days left` };
}

export function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}
