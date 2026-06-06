import React from 'react';
import { usePharmacyStore, calculateDaysDifference, formatDateDisplay, getExpiryStatus } from '../store/usePharmacyStore';

export default function DashboardTab() {
    const {
        medicines,
        dashboardStats,
        isLoadingStats,
        setAddModalOpen,
        setActiveTab
    } = usePharmacyStore();

    // Use API stats if available, else derive from local medicines
    const stats = dashboardStats?.stats;
    const totalCount       = stats?.totalMedicines  ?? medicines.length;
    const activeSafeCount  = stats?.activeMedicines  ?? medicines.filter(m => m.status === 'Active').length;
    const expiringSoonCount= stats?.expiring20Days  ?? 0;
    const expiredCount = stats?.expiredCount ?? 
        medicines.filter(m => calculateDaysDifference(new Date().toISOString().slice(0,10), m.expiryDate) < 0).length;
    const outOfStockCount = stats?.outOfStock ?? 
        medicines.filter(m => m.status === 'Out of Stock' || m.quantity === 0).length;

    // Expiring soon list from API or local compute
    const expiringSoonItems = dashboardStats?.expiringSoon
        ? dashboardStats.expiringSoon.map(m => ({ medicine: m, daysLeft: m.daysUntilExpiry ?? 0 }))
        : medicines
            .filter(m => {
                const d = calculateDaysDifference(new Date().toISOString().slice(0,10), m.expiryDate);
                return d >= 0 && d <= 20;
            })
            .map(m => ({ medicine: m, daysLeft: calculateDaysDifference(new Date().toISOString().slice(0,10), m.expiryDate) }))
            .sort((a, b) => a.daysLeft - b.daysLeft);

    const StatValue = ({ val }) => isLoadingStats
        ? <span style={{ display:'inline-block', width:32, height:20, background:'var(--bg-input)', borderRadius:4, animation:'pulse 1.5s infinite' }}></span>
        : <h3 className="stat-value">{val}</h3>;

    return (
        <section id="tab-dashboard" className="tab-pane active">
            <div className="page-header">
                <h2>Store Dashboard</h2>
                <p className="subtitle">Quick overview of pharmacy products and upcoming medicine expiries.</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon bg-primary"><i className="fa-solid fa-pills"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Total Medicines</span>
                        <StatValue val={totalCount} />
                    </div>
                </div>

                <div className="stat-card border-success">
                    <div className="stat-icon bg-success"><i className="fa-solid fa-circle-check"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Active &amp; Safe</span>
                        <StatValue val={activeSafeCount} />
                    </div>
                </div>

                <div className="stat-card border-warning">
                    <div className="stat-icon bg-warning text-dark"><i className="fa-solid fa-triangle-exclamation"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Expiring Soon (20d)</span>
                        <StatValue val={expiringSoonCount} />
                    </div>
                </div>

                <div className="stat-card border-danger">
                    <div className="stat-icon bg-danger"><i className="fa-solid fa-circle-xmark"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Expired Medicines</span>
                        <StatValue val={expiredCount} />
                    </div>
                </div>

                <div className="stat-card border-orange">
                    <div className="stat-icon bg-orange"><i className="fa-solid fa-boxes-stacked"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Out of Stock</span>
                        <StatValue val={outOfStockCount} />
                    </div>
                </div>
            </div>

            {/* Dashboard Split Layout */}
            <div className="dashboard-split">
                {/* Left: Urgent Expiries */}
                <div className="split-left card-panel">
                    <div className="panel-header">
                        <div className="panel-title-group">
                            <i className="fa-solid fa-hourglass-half panel-icon warning-text"></i>
                            <h3>Urgent Expiry Timeline</h3>
                        </div>
                        <span className={`badge ${expiringSoonCount > 0 ? 'badge-warning' : 'badge-safe'}`}>
                            {expiringSoonCount > 0 ? `${expiringSoonCount} Upcoming` : 'All Safe'}
                        </span>
                    </div>
                    <div className="panel-content">
                        <div className="timeline-list" id="urgent-expiry-list">
                            {expiringSoonItems.length === 0 ? (
                                <div className="empty-state">
                                    <i className="fa-solid fa-circle-check text-success" style={{ fontSize: '28px', color: 'var(--success)' }}></i>
                                    <p>No upcoming expiries detected. All products are safe!</p>
                                </div>
                            ) : (
                                expiringSoonItems.map(item => {
                                    const med = item.medicine;
                                    const days = item.daysLeft;
                                    
                                    const { urgencyClass, daysLabel } = getExpiryStatus(days);

                                    return (
                                        <div key={med.id} className={`timeline-item ${urgencyClass}`}>
                                            <i className="fa-solid fa-hourglass-half timeline-icon"></i>
                                            <div className="timeline-content">
                                                <div className="timeline-title">{med.name}</div>
                                                <div className="timeline-desc">Batch No: {med.batch} | Qty: {med.quantity} | Category: {med.category}</div>
                                                <div className="timeline-meta">
                                                    <span>Expiry: {formatDateDisplay(med.expiryDate)}</span>
                                                    <span className={`badge badge-${urgencyClass}`}>{daysLabel}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Fast Actions & Summary */}
                <div className="split-right">
                    <div className="card-panel quick-actions-panel">
                        <h3>Quick Actions</h3>
                        <div className="actions-buttons-grid">
                            <button className="btn btn-primary btn-icon" onClick={() => setAddModalOpen(true)}>
                                <i className="fa-solid fa-plus"></i> Add New Product
                            </button>
                            <button className="btn btn-secondary btn-icon" onClick={() => setActiveTab('simulator')}>
                                <i className="fa-solid fa-vial-circle-check"></i> Test Notification
                            </button>
                            <button className="btn btn-outline btn-icon" onClick={() => setActiveTab('notifications-log')}>
                                <i className="fa-solid fa-bell"></i> View Alert Logs
                            </button>
                        </div>
                    </div>

                    {/* System Status Notification Banner */}
                    <div className="info-card">
                        <i className="fa-solid fa-circle-info info-icon"></i>
                        <div className="info-text">
                            <h4>Notifications Policy</h4>
                            <p>This application will alert you in real-time. Make sure to allow browser notification permissions for system tray desktop popups!</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
