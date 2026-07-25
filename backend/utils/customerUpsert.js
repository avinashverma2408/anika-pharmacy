const Customer = require('../models/Customer');

function normalizeMobile(mobile = '') {
    return String(mobile).replace(/\D/g, '');
}

/**
 * Create or update customer from bill patient fields.
 * Returns customer doc or null when mobile is missing/invalid.
 */
async function upsertFromBill({ name, mobile, address, doctorName, billDate, netTotal }) {
    const cleanMobile = normalizeMobile(mobile);
    if (cleanMobile.length < 10) return null;

    const visitDate = billDate ? new Date(billDate) : new Date();
    const amount = Number(netTotal) || 0;
    const cleanName = (name && String(name).trim()) || 'CASH CUSTOMER';

    let customer = await Customer.findOne({ mobile: cleanMobile });

    if (!customer) {
        customer = await Customer.create({
            name: cleanName,
            mobile: cleanMobile,
            address: address || '',
            preferredDoctor: doctorName || '',
            totalPurchases: 1,
            totalSpent: amount,
            lastVisitAt: visitDate,
            status: 'Active'
        });
        return customer;
    }

    customer.name = cleanName !== 'CASH CUSTOMER' ? cleanName : customer.name;
    if (address) customer.address = address;
    if (doctorName) customer.preferredDoctor = doctorName;
    customer.totalPurchases = (customer.totalPurchases || 0) + 1;
    customer.totalSpent = (customer.totalSpent || 0) + amount;
    if (!customer.lastVisitAt || visitDate > customer.lastVisitAt) {
        customer.lastVisitAt = visitDate;
    }
    customer.status = 'Active';
    await customer.save();
    return customer;
}

module.exports = { upsertFromBill, normalizeMobile };
