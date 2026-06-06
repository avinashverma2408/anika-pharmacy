import React from 'react';
import { usePharmacyStore, calculateDaysDifference, formatDateDisplay } from '../store/usePharmacyStore';

export default function ProductDetails() {
    const {
        selectedMedicineForDetails: med,
        setSelectedMedicineForDetails,
        setEditModalOpen,
        setDeleteModalOpen,
        simulatedDate
    } = usePharmacyStore();

    if (!med) return null;

    const todayStr = simulatedDate;
    const daysLeft = calculateDaysDifference(todayStr, med.expiryDate);

    // Expiry badge styling
    let daysBadgeClass = "badge-safe";
    let daysText = `${daysLeft} days left`;
    let daysDescription = "This product is in a safe expiry window.";

    if (daysLeft < 0) {
        daysBadgeClass = "badge-critical";
        daysText = `Expired (${Math.abs(daysLeft)}d ago)`;
        daysDescription = "This product has expired and must be disposed of immediately.";
    } else if (daysLeft === 0) {
        daysBadgeClass = "badge-danger";
        daysText = "Expires Today";
        daysDescription = "This product expires today! Pull it from inventory.";
    } else if (daysLeft <= 7) {
        daysBadgeClass = "badge-orange";
        daysText = `${daysLeft} days left`;
        daysDescription = "This product is expiring within a week. Action required.";
    } else if (daysLeft <= 20) {
        daysBadgeClass = "badge-warning";
        daysText = `${daysLeft} days left`;
        daysDescription = "This product will expire soon. Monitor closely.";
    }

    // Financial calculations
    const ptr = med.ptr || 0;
    const mrp = med.price || 0;
    const qty = med.quantity || 0;

    const unitMargin = mrp - ptr;
    const marginPercent = mrp > 0 ? (unitMargin / mrp) * 100 : 0;
    
    const totalCostValue = qty * ptr;
    const totalRetailValue = qty * mrp;
    const potentialProfit = qty * unitMargin;

    // Category icon mapper
    const getCategoryIcon = (category) => {
        switch (category) {
            case 'Tablet': return 'fa-capsules';
            case 'Syrup': return 'fa-prescription-bottle';
            case 'Injection': return 'fa-syringe';
            case 'Vaccine': return 'fa-shield-virus';
            case 'Ointment': return 'fa-pump-medical';
            default: return 'fa-pills';
        }
    };

    return (
        <div className="product-details-view animate-fade-in">
            {/* Header / Navigation */}
            <div className="details-header">
                <button 
                    className="btn btn-outline btn-icon-back"
                    onClick={() => setSelectedMedicineForDetails(null)}
                >
                    <i className="fa-solid fa-arrow-left"></i> Back to Inventory
                </button>
                <div className="details-action-buttons">
                    <button 
                        className="btn btn-secondary"
                        onClick={() => setEditModalOpen(true, med)}
                    >
                        <i className="fa-solid fa-pen-to-square"></i> Edit Medicine
                    </button>
                    <button 
                        className="btn btn-danger"
                        onClick={() => setDeleteModalOpen(true, med)}
                    >
                        <i className="fa-solid fa-trash-can"></i> Delete
                    </button>
                </div>
            </div>

            {/* Split Layout */}
            <div className="details-grid">
                {/* Left Side: General Profile Card */}
                <div className="details-card card-panel">
                    <div className="profile-summary">
                        <div className={`profile-icon-wrapper ${med.category.toLowerCase()}`}>
                            <i className={`fa-solid ${getCategoryIcon(med.category)}`}></i>
                        </div>
                        <div className="profile-text">
                            <h2>{med.name}</h2>
                            <span className="category-label">{med.category}</span>
                            <span className={`badge status-badge ${med.status.replace(/\s+/g, '').toLowerCase() === 'outofstock' ? 'badge-outofstock' : med.status.toLowerCase() === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                                {med.status}
                            </span>
                        </div>
                    </div>

                    <hr className="details-divider" />

                    <div className="details-info-list">
                        <div className="info-item">
                            <span className="info-label">Batch Number</span>
                            <span className="info-value">
                                <code className="batch-code">{med.batch}</code>
                            </span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">Pack Size</span>
                            <span className="info-value">{med.pack || '1*10'}</span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">HSN Code</span>
                            <span className="info-value">{med.hsn ? med.hsn : <em className="text-muted">N/A</em>}</span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">GST Rate</span>
                            <span className="info-value">{med.gstRate !== undefined ? `${med.gstRate}% (${med.gstRate/2}% CGST + ${med.gstRate/2}% SGST)` : '5% (2.5% CGST + 2.5% SGST)'}</span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">Stockist Name</span>
                            <span className="info-value">
                                {med.stockistName ? med.stockistName : <em className="text-muted">Not Assigned</em>}
                            </span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">Expiry Date</span>
                            <span className="info-value">{formatDateDisplay(med.expiryDate)}</span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">Timeline Status</span>
                            <span className="info-value">
                                <span className={`badge ${daysBadgeClass}`} style={{ marginBottom: '4px' }}>{daysText}</span>
                                <p className="timeline-desc-text">{daysDescription}</p>
                            </span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">Added On</span>
                            <span className="info-value text-secondary-val">
                                {med.createdAt ? new Date(med.createdAt).toLocaleString() : 'N/A'}
                            </span>
                        </div>

                        <div className="info-item">
                            <span className="info-label">Last Updated</span>
                            <span className="info-value text-secondary-val">
                                {med.updatedAt ? new Date(med.updatedAt).toLocaleString() : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Financial & Stock Valuation Analysis */}
                <div className="details-analytics">
                    {/* Unit Pricing Section */}
                    <div className="details-card card-panel">
                        <h3 className="analytics-section-title"><i className="fa-solid fa-calculator"></i> Unit Price &amp; Profit Margin</h3>
                        
                        <div className="metrics-row-grid">
                            <div className="metric-box">
                                <span className="metric-title">PTR (Purchase Price)</span>
                                <h4 className="metric-number">₹{ptr.toFixed(2)}</h4>
                                <span className="metric-subtitle">Cost to Retailer</span>
                            </div>

                            <div className="metric-box">
                                <span className="metric-title">MRP (Selling Price)</span>
                                <h4 className="metric-number text-primary-color">₹{mrp.toFixed(2)}</h4>
                                <span className="metric-subtitle">Price to Customer</span>
                            </div>

                            <div className="metric-box">
                                <span className="metric-title">Margin per Unit</span>
                                <h4 className={`metric-number ${unitMargin >= 0 ? 'text-success-color' : 'text-danger-color'}`}>
                                    ₹{unitMargin.toFixed(2)}
                                </h4>
                                <span className="metric-subtitle">Net Profit per Unit</span>
                            </div>

                            <div className="metric-box">
                                <span className="metric-title">Margin Percentage</span>
                                <h4 className={`metric-number ${marginPercent >= 0 ? 'text-success-color' : 'text-danger-color'}`}>
                                    {marginPercent.toFixed(1)}%
                                </h4>
                                <span className="metric-subtitle">Margin on Selling Price</span>
                            </div>
                        </div>

                        {/* Visual Margin Slider / Bar */}
                        {mrp > 0 && ptr > 0 && (
                            <div className="margin-percentage-bar-container">
                                <div className="bar-labels">
                                    <span>PTR Cost ({((ptr/mrp)*100).toFixed(0)}%)</span>
                                    <span>Profit Margin ({marginPercent.toFixed(0)}%)</span>
                                </div>
                                <div className="margin-percentage-progress-bar">
                                    <div className="progress-cost" style={{ width: `${(ptr / mrp) * 100}%` }}></div>
                                    <div className="progress-margin" style={{ width: `${(unitMargin / mrp) * 100}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stock Valuation Section */}
                    <div className="details-card card-panel">
                        <h3 className="analytics-section-title"><i className="fa-solid fa-warehouse"></i> Inventory Stock Valuation</h3>
                        
                        <div className="valuation-details-row">
                            <div className="valuation-qty-banner">
                                <span className="valuation-qty-label">Available Stock Qty</span>
                                <span className="valuation-qty-count">{qty} units</span>
                            </div>

                            <div className="valuation-stats-list">
                                <div className="val-stat-item">
                                    <span className="val-stat-label">Total Inventory Cost (at PTR)</span>
                                    <span className="val-stat-value">₹{totalCostValue.toFixed(2)}</span>
                                </div>
                                
                                <div className="val-stat-item">
                                    <span className="val-stat-label">Total Retail Value (at MRP)</span>
                                    <span className="val-stat-value font-highlight">₹{totalRetailValue.toFixed(2)}</span>
                                </div>

                                <div className="val-stat-item total-profit-item">
                                    <span className="val-stat-label">Total Potential Profit</span>
                                    <span className="val-stat-value text-success-color font-large">₹{potentialProfit.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
