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
    if (isNaN(date.getTime())) return 'N/A';
    
    // Day: e.g. 5
    const day = date.getDate();
    
    // Month: e.g. June
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const month = monthNames[date.getMonth()];
    
    // Year: e.g. 2026
    const year = date.getFullYear();
    
    // Time format e.g. 03:00 PM
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 hour should be 12
    const strHours = String(hours).padStart(2, '0');
    
    return `${day} ${month} ${year} & ${strHours}:${minutes} ${ampm}`;
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
