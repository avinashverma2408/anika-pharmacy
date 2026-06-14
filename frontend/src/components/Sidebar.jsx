import React from 'react';
import { usePharmacyStore } from '../store/usePharmacyStore';

export default function Sidebar() {
    const { activeTab, setActiveTab, setLogoutModalOpen } = usePharmacyStore();

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
        { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
        { id: 'calendar', label: 'Expiry Calendar', icon: 'fa-calendar-days' },
        { id: 'billing', label: 'GST Billing', icon: 'fa-file-invoice-dollar' },
        { id: 'simulator', label: 'Expiry Simulator', icon: 'fa-flask-vial' },
        { id: 'notifications-log', label: 'Alert Logs', icon: 'fa-bell-concierge' },
        { id: 'settings', label: 'Settings', icon: 'fa-gear' }
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <img src="/logo.png" alt="Anika Pharmacy Logo" className="logo-icon-img" />
                <div className="brand-text">
                    <h1>Anika Pharmacy</h1>
                    <span>Medical Store Portal</span>
                </div>
            </div>
            
            <nav className="sidebar-menu">
                {menuItems.map(item => (
                    <a 
                        key={item.id}
                        href="#" 
                        className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            setActiveTab(item.id);
                        }}
                    >
                        <i className={`fa-solid ${item.icon}`}></i>
                        <span>{item.label}</span>
                    </a>
                ))}
            </nav>

            <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="user-profile">
                    <div className="avatar">AP</div>
                    <div className="user-info">
                        <span className="user-name">Admin Portal</span>
                        <span className="user-role">Store Manager</span>
                    </div>
                </div>
                <a 
                    href="#" 
                    className="logout-link"
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '10px 16px', 
                        color: '#fda4af', 
                        fontSize: '13px', 
                        textDecoration: 'none', 
                        borderRadius: '8px', 
                        background: 'rgba(239, 68, 68, 0.08)', 
                        transition: 'background-color 0.2s',
                        fontWeight: '500'
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        setLogoutModalOpen(true);
                    }}
                >
                    <i className="fa-solid fa-right-from-bracket"></i>
                    <span>Logout Portal</span>
                </a>
            </div>
        </aside>
    );
}
