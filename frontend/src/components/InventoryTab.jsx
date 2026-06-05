import React, { useState } from 'react';
import { usePharmacyStore, calculateDaysDifference, formatDateDisplay } from '../store/usePharmacyStore';

export default function InventoryTab() {
    const {
        medicines,
        isLoadingMedicines,
        setAddModalOpen,
        setEditModalOpen,
        setDeleteModalOpen,
        updateMedicineStatus,
        globalSearchQuery
    } = usePharmacyStore();

    // Local toolbar filter states
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expiryFilter, setExpiryFilter] = useState('all');

    const handleResetFilters = () => {
        setCategoryFilter('all');
        setStatusFilter('all');
        setExpiryFilter('all');
    };

    // Filter medicines
    const todayStr = new Date().toISOString().slice(0, 10);
    const filteredMedicines = medicines.filter(med => {
        const matchesSearch = med.name.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
                              med.batch.toLowerCase().includes(globalSearchQuery.toLowerCase());

        const matchesCategory = categoryFilter === 'all' || med.category === categoryFilter;
        const matchesStatus   = statusFilter === 'all'   || med.status === statusFilter;

        const daysLeft = calculateDaysDifference(todayStr, med.expiryDate);
        let matchesExpiry = true;

        if (expiryFilter === 'expired')      matchesExpiry = daysLeft < 0;
        else if (expiryFilter === 'expires-today') matchesExpiry = daysLeft === 0;
        else if (expiryFilter === 'expires-7')     matchesExpiry = daysLeft >= 0 && daysLeft <= 7;
        else if (expiryFilter === 'expires-20')    matchesExpiry = daysLeft >= 0 && daysLeft <= 20;
        else if (expiryFilter === 'safe')           matchesExpiry = daysLeft > 20;

        return matchesSearch && matchesCategory && matchesStatus && matchesExpiry;
    });

    return (
        <section id="tab-inventory" className="tab-pane active">
            <div className="page-header flex-header">
                <div>
                    <h2>Medicine Inventory</h2>
                    <p className="subtitle">Search, filter, edit, and keep track of your pharmaceutical stock.</p>
                </div>
                <button 
                    className="btn btn-primary" 
                    id="inventory-add-btn"
                    onClick={() => setAddModalOpen(true)}
                >
                    <i className="fa-solid fa-plus"></i> Add Product
                </button>
            </div>

            {/* Filter Tool Bar */}
            <div className="filter-toolbar card-panel">
                <div className="filter-group">
                    <label htmlFor="filter-category">Category</label>
                    <select 
                        id="filter-category" 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        <option value="Tablet">Tablets</option>
                        <option value="Syrup">Syrups</option>
                        <option value="Injection">Injections</option>
                        <option value="Vaccine">Vaccines</option>
                        <option value="Ointment">Ointments</option>
                        <option value="Other">Others</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="filter-status">Status</label>
                    <select 
                        id="filter-status" 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Out of Stock">Out of Stock</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="filter-expiry">Expiry Filter</label>
                    <select 
                        id="filter-expiry" 
                        value={expiryFilter}
                        onChange={(e) => setExpiryFilter(e.target.value)}
                    >
                        <option value="all">All Expiries</option>
                        <option value="expired">Already Expired</option>
                        <option value="expires-today">Expires Today</option>
                        <option value="expires-7">Expires within 7 Days</option>
                        <option value="expires-20">Expires within 20 Days</option>
                        <option value="safe">Safe (&gt;20 Days)</option>
                    </select>
                </div>

                <button 
                    id="reset-filters-btn" 
                    className="btn btn-outline btn-small"
                    onClick={handleResetFilters}
                >
                    Reset
                </button>
            </div>

            {/* Products Table */}
            <div className="table-container card-panel">
                <table className="data-table" id="inventory-table">
                    <thead>
                        <tr>
                            <th>Medicine Name</th>
                            <th>Category</th>
                            <th>Batch No.</th>
                            <th>Expiry Date</th>
                            <th>Days Left</th>
                            <th>Price</th>
                            <th>Qty</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoadingMedicines ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: 9 }).map((_, j) => (
                                        <td key={j}>
                                            <span style={{ display: 'inline-block', width: '80%', height: 14, background: 'var(--bg-input)', borderRadius: 4, animation: 'pulse 1.5s infinite' }}></span>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filteredMedicines.map(med => {
                            const daysLeft = calculateDaysDifference(todayStr, med.expiryDate);
                            
                            let daysBadgeClass = "badge-safe";
                            let daysText = `${daysLeft} days`;

                            if (daysLeft < 0) {
                                daysBadgeClass = "badge-critical";
                                daysText = `Expired (${Math.abs(daysLeft)}d ago)`;
                            } else if (daysLeft === 0) {
                                daysBadgeClass = "badge-danger";
                                daysText = "Expires Today";
                            } else if (daysLeft <= 7) {
                                daysBadgeClass = "badge-orange";
                                daysText = `${daysLeft} days left`;
                            } else if (daysLeft <= 20) {
                                daysBadgeClass = "badge-warning";
                                daysText = `${daysLeft} days left`;
                            }

                                return (
                                    <tr key={med._id || med.id}>
                                        <td><strong>{med.name}</strong></td>
                                        <td>{med.category}</td>
                                        <td>
                                            <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                                                {med.batch}
                                            </code>
                                        </td>
                                        <td>{formatDateDisplay(med.expiryDate)}</td>
                                        <td><span className={`badge ${daysBadgeClass}`}>{daysText}</span></td>
                                        <td>₹{med.price.toFixed(2)}</td>
                                        <td>{med.quantity}</td>
                                        <td>
                                            <select
                                                value={med.status}
                                                className="table-status-select"
                                                style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: '12px' }}
                                                onChange={(e) => updateMedicineStatus(med._id || med.id, e.target.value)}
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                                <option value="Out of Stock">Out of Stock</option>
                                            </select>
                                        </td>
                                        <td className="text-right">
                                            <div className="action-btn-group">
                                                <button className="btn-icon-only edit" title="Edit Medicine" onClick={() => setEditModalOpen(true, med)}>
                                                    <i className="fa-solid fa-pen-to-square"></i>
                                                </button>
                                                <button className="btn-icon-only delete" title="Delete Medicine" onClick={() => setDeleteModalOpen(true, med)}>
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                        })}
                    </tbody>
                </table>
                
                {filteredMedicines.length === 0 && (
                    <div className="empty-state" style={{ display: 'flex' }}>
                        <i className="fa-solid fa-folder-open"></i>
                        <p>No products found matching the criteria.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
