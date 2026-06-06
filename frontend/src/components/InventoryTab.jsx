import React, { useState } from 'react';
import { usePharmacyStore, calculateDaysDifference, formatDateDisplay } from '../store/usePharmacyStore';
import ProductDetails from './ProductDetails';

export default function InventoryTab() {
    const {
        medicines,
        isLoadingMedicines,
        setAddModalOpen,
        setEditModalOpen,
        setDeleteModalOpen,
        updateMedicineStatus,
        globalSearchQuery,
        selectedMedicineForDetails,
        setSelectedMedicineForDetails,
        simulatedDate
    } = usePharmacyStore();

    // Local filter and sub-tab states
    const [subTab, setSubTab] = useState('active'); // active, expired, outofstock, all
    const [categoryFilter, setCategoryFilter] = useState('all');

    const handleResetFilters = () => {
        setCategoryFilter('all');
    };

    const todayStr = simulatedDate;

    // Compute sub-tab counts
    let activeCount = 0;
    let expiredCount = 0;
    let outOfStockCount = 0;
    let allCount = medicines.length;

    medicines.forEach(med => {
        const daysLeft = calculateDaysDifference(todayStr, med.expiryDate);
        const isExpired = daysLeft < 0;
        const isOutOfStock = med.quantity === 0 || med.status === 'Out of Stock';

        if (isExpired) {
            expiredCount++;
        }
        if (isOutOfStock) {
            outOfStockCount++;
        }
        if (!isExpired && !isOutOfStock && med.status === 'Active') {
            activeCount++;
        }
    });

    // Filter medicines based on search, category, and selected sub-tab
    const filteredMedicines = medicines.filter(med => {
        // Global Search
        const matchesSearch = med.name.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
                              med.batch.toLowerCase().includes(globalSearchQuery.toLowerCase());

        // Category
        const matchesCategory = categoryFilter === 'all' || med.category === categoryFilter;

        // Sub Tab
        const daysLeft = calculateDaysDifference(todayStr, med.expiryDate);
        const isExpired = daysLeft < 0;
        const isOutOfStock = med.quantity === 0 || med.status === 'Out of Stock';

        let matchesTab = true;
        if (subTab === 'active') {
            matchesTab = !isExpired && !isOutOfStock && med.status === 'Active';
        } else if (subTab === 'expired') {
            matchesTab = isExpired;
        } else if (subTab === 'outofstock') {
            matchesTab = isOutOfStock;
        }

        return matchesSearch && matchesCategory && matchesTab;
    });

    return (
        <section id="tab-inventory" className="tab-pane active">
            {selectedMedicineForDetails ? (
                <ProductDetails />
            ) : (
                <>
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

                    {/* Sub Tab Navigation */}
                    <div className="sub-tabs-container">
                        <button 
                            className={`sub-tab-btn ${subTab === 'active' ? 'active' : ''}`}
                            onClick={() => setSubTab('active')}
                        >
                            Active Stock <span className="tab-badge badge-safe">{activeCount}</span>
                        </button>
                        <button 
                            className={`sub-tab-btn ${subTab === 'expired' ? 'active' : ''}`}
                            onClick={() => setSubTab('expired')}
                        >
                            Expired Stock <span className="tab-badge badge-danger">{expiredCount}</span>
                        </button>
                        <button 
                            className={`sub-tab-btn ${subTab === 'outofstock' ? 'active' : ''}`}
                            onClick={() => setSubTab('outofstock')}
                        >
                            Out of Stock <span className="tab-badge badge-warning">{outOfStockCount}</span>
                        </button>
                        <button 
                            className={`sub-tab-btn ${subTab === 'all' ? 'active' : ''}`}
                            onClick={() => setSubTab('all')}
                        >
                            All Catalog <span className="tab-badge badge-info">{allCount}</span>
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

                        <button 
                            id="reset-filters-btn" 
                            className="btn btn-outline btn-small"
                            onClick={handleResetFilters}
                            style={{ alignSelf: 'flex-end', height: '40px' }}
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
                            <th>Stockist</th>
                            <th>Expiry Date</th>
                            <th>Days Left</th>
                            <th>PTR</th>
                            <th>MRP / Price</th>
                            <th>Qty</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoadingMedicines ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: 11 }).map((_, j) => (
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
                                        <td>
                                            <a 
                                                href="#" 
                                                className="medicine-name-link"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setSelectedMedicineForDetails(med);
                                                }}
                                            >
                                                {med.name}
                                            </a>
                                        </td>
                                        <td>{med.category}</td>
                                        <td>
                                            <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                                                {med.batch}
                                            </code>
                                        </td>
                                        <td>{med.stockistName || <em style={{ color: 'var(--text-muted)' }}>None</em>}</td>
                                        <td>{formatDateDisplay(med.expiryDate)}</td>
                                        <td><span className={`badge ${daysBadgeClass}`}>{daysText}</span></td>
                                        <td>₹{(med.ptr || 0).toFixed(2)}</td>
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
                                                <button className="btn-icon-only view" title="View Details" onClick={() => setSelectedMedicineForDetails(med)}>
                                                    <i className="fa-solid fa-eye"></i>
                                                </button>
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
                </>
            )}
        </section>
    );
}
