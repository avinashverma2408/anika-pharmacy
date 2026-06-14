import React, { useState, useEffect, useCallback } from 'react';
import { usePharmacyStore, calculateDaysDifference, formatDateDisplay, formatDateTimeDisplay } from '../store/usePharmacyStore';
import { medicineApi } from '../api/apiClient';
import ProductDetails from './ProductDetails';

const PAGE_SIZE = 10;

export default function InventoryTab() {
    const {
        isLoadingMedicines,
        setAddModalOpen,
        setEditModalOpen,
        setDeleteModalOpen,
        updateMedicineStatus,
        globalSearchQuery,
        selectedMedicineForDetails,
        setSelectedMedicineForDetails,
        simulatedDate,
        medicines: storeMedicines,   // used for add/edit/delete optimistic updates
        inventorySubTab: subTab,
        setInventorySubTab: setSubTab,
    } = usePharmacyStore();

    // ── Local state ───────────────────────────────────────────────────────────
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [currentPage, setCurrentPage]   = useState(1);

    // Server-fetched page data
    const [pageData, setPageData]         = useState({ medicines: [], total: 0, totalPages: 1 });
    const [isLoading, setIsLoading]       = useState(false);

    // Sub-tab counts (fetched separately — all docs, no page limit)
    const [tabCounts, setTabCounts]       = useState({ active: 0, expiring: 0, expired: 0, outofstock: 0, inactive: 0, all: 0 });

    const todayStr = simulatedDate;

    // ── Fetch page from server ─────────────────────────────────────────────────
    const fetchPage = useCallback(async (page, tab, category, search) => {
        setIsLoading(true);
        try {
            // Build expiry + status params from sub-tab
            const params = { page, limit: PAGE_SIZE };
            if (search) params.search = search;
            if (category !== 'all') params.category = category;

            if (tab === 'active') {
                params.status = 'Active';
                params.expiry = 'safe';
            } else if (tab === 'expiring') {
                params.status = 'Active';
                params.expiry = 'expires-20';
            } else if (tab === 'expired') {
                params.status = 'all';
                params.expiry = 'expired';
            } else if (tab === 'outofstock') {
                params.status = 'Out of Stock';
                params.expiry = 'not-expired';
            } else if (tab === 'inactive') {
                params.status = 'Inactive';
            } else if (tab === 'all') {
                params.status = 'all';
            }
            // 'all' — no extra filter

            const { data } = await medicineApi.getAll(params);
            setPageData({
                medicines:  data.medicines  || [],
                total:      data.total      || 0,
                totalPages: data.totalPages || 1,
            });
        } catch {
            setPageData({ medicines: [], total: 0, totalPages: 1 });
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ── Fetch tab counts — single efficient API call ────────────────────────────
    const fetchCounts = useCallback(async (search, category) => {
        try {
            const params = {};
            if (search) params.search = search;
            if (category !== 'all') params.category = category;

            const { data } = await medicineApi.getCounts(params);
            if (data.success) {
                setTabCounts(data.counts);
            }
        } catch {
            // Silently ignore count fetch errors
        }
    }, []);

    // ── Re-fetch whenever filters / page / simulatedDate / medicines change ───────
    useEffect(() => {
        fetchPage(currentPage, subTab, categoryFilter, globalSearchQuery);
    }, [currentPage, subTab, categoryFilter, globalSearchQuery, simulatedDate, storeMedicines, fetchPage]);

    useEffect(() => {
        fetchCounts(globalSearchQuery, categoryFilter);
    }, [globalSearchQuery, categoryFilter, simulatedDate, storeMedicines, fetchCounts]);

    // ── Filter/tab change helpers ──────────────────────────────────────────────
    const handleSubTabChange = (tab) => {
        setSubTab(tab);
        setCurrentPage(1);
    };

    const handleCategoryChange = (val) => {
        setCategoryFilter(val);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setCategoryFilter('all');
        setCurrentPage(1);
    };

    // ── Pagination helper ──────────────────────────────────────────────────────
    const safePage    = Math.min(currentPage, pageData.totalPages);
    const totalPages  = pageData.totalPages;
    const startItem   = pageData.total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const endItem     = Math.min(safePage * PAGE_SIZE, pageData.total);

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
                        {[
                            { key: 'active',     label: 'Active Stock',   badgeClass: 'badge-safe' },
                            { key: 'expiring',   label: 'Expiring Soon',  badgeClass: 'badge-warning' },
                            { key: 'expired',    label: 'Expired Stock',  badgeClass: 'badge-danger' },
                            { key: 'outofstock', label: 'Out of Stock',   badgeClass: 'badge-orange' },
                            { key: 'inactive',   label: 'Inactive Stock', badgeClass: 'badge-inactive' },
                            { key: 'all',        label: 'All Catalog',    badgeClass: 'badge-info' },
                        ].map(({ key, label, badgeClass }) => (
                            <button
                                key={key}
                                className={`sub-tab-btn ${subTab === key ? 'active' : ''}`}
                                onClick={() => handleSubTabChange(key)}
                            >
                                {label} <span className={`tab-badge ${badgeClass}`}>{tabCounts[key] ?? 0}</span>
                            </button>
                        ))}
                    </div>

                    {/* Filter Toolbar */}
                    <div className="filter-toolbar card-panel">
                        <div className="filter-group">
                            <label htmlFor="filter-category">Category</label>
                            <select
                                id="filter-category"
                                value={categoryFilter}
                                onChange={(e) => handleCategoryChange(e.target.value)}
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
                                    <th>Added Date & Time</th>
                                    <th>PTR</th>
                                    <th>MRP / Price</th>
                                    <th>Qty</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(isLoading || isLoadingMedicines) ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 12 }).map((_, j) => (
                                                <td key={j}>
                                                    <span style={{ display: 'inline-block', width: '80%', height: 14, background: 'var(--bg-input)', borderRadius: 4, animation: 'pulse 1.5s infinite' }}></span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : pageData.medicines.map(med => {
                                    const daysLeft = calculateDaysDifference(todayStr, med.expiryDate);

                                    let daysBadgeClass = 'badge-safe';
                                    let daysText = `${daysLeft} days`;

                                    if (daysLeft < 0) {
                                        daysBadgeClass = 'badge-critical';
                                        daysText = `Expired (${Math.abs(daysLeft)}d ago)`;
                                    } else if (daysLeft === 0) {
                                        daysBadgeClass = 'badge-danger';
                                        daysText = 'Expires Today';
                                    } else if (daysLeft <= 7) {
                                        daysBadgeClass = 'badge-orange';
                                        daysText = `${daysLeft} days left`;
                                    } else if (daysLeft <= 20) {
                                        daysBadgeClass = 'badge-warning';
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
                                            <td>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {formatDateTimeDisplay(med.createdAt)}
                                                </span>
                                            </td>
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

                        {!isLoading && pageData.medicines.length === 0 && (
                            <div className="empty-state" style={{ display: 'flex' }}>
                                <i className="fa-solid fa-folder-open"></i>
                                <p>No products found matching the criteria.</p>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {pageData.total > 0 && (
                            <div className="pagination-bar">
                                <span className="pagination-info">
                                    {pageData.total === 0
                                        ? 'No items'
                                        : `Showing ${startItem}–${endItem} of ${pageData.total} items`
                                    }
                                </span>
                                <div className="pagination-controls">
                                    <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={safePage === 1} title="First Page">
                                        <i className="fa-solid fa-angles-left"></i>
                                    </button>
                                    <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} title="Previous">
                                        <i className="fa-solid fa-chevron-left"></i>
                                    </button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                                        .reduce((acc, p, idx, arr) => {
                                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('ellipsis-' + idx);
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map(item =>
                                            typeof item === 'string' ? (
                                                <span key={item} className="pagination-ellipsis">…</span>
                                            ) : (
                                                <button
                                                    key={item}
                                                    className={`pagination-btn ${safePage === item ? 'active' : ''}`}
                                                    onClick={() => setCurrentPage(item)}
                                                >
                                                    {item}
                                                </button>
                                            )
                                        )
                                    }

                                    <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} title="Next">
                                        <i className="fa-solid fa-chevron-right"></i>
                                    </button>
                                    <button className="pagination-btn" onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} title="Last Page">
                                        <i className="fa-solid fa-angles-right"></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
