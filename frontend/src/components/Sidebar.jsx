import React, { useMemo } from "react";
import { usePharmacyStore } from "../store/usePharmacyStore";

const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "fa-chart-pie" },
  { id: "inventory", label: "Inventory", icon: "fa-boxes-stacked" },
  { id: "calendar", label: "Expiry Calendar", icon: "fa-calendar-days" },
  { id: "billing", label: "GST Billing", icon: "fa-file-invoice-dollar" },
  { id: "analytics", label: "Sales Analytics", icon: "fa-chart-line" },
  { id: "suppliers", label: "Suppliers", icon: "fa-truck-field" },
  { id: "customers", label: "Customers", icon: "fa-user-group" },
  { id: "simulator", label: "Expiry Simulator", icon: "fa-flask-vial" },
  { id: "notifications-log", label: "Alert Logs", icon: "fa-bell-concierge" },
  { id: "settings", label: "Settings", icon: "fa-gear" },
];

export default function Sidebar() {
  const activeTab = usePharmacyStore((s) => s.activeTab);
  const setActiveTab = usePharmacyStore((s) => s.setActiveTab);
  const setLogoutModalOpen = usePharmacyStore((s) => s.setLogoutModalOpen);

  const items = useMemo(() => MENU_ITEMS, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          src="/logo.png"
          alt="Anika Pharmacy Logo"
          className="logo-icon-img"
          loading="eager"
          decoding="async"
        />
        <div className="brand-text">
          <h1>Anika Pharmacy</h1>
          <span>Medical Store Portal</span>
        </div>
      </div>

      <nav className="sidebar-menu" aria-label="Primary">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <a
              key={item.id}
              href={`#/${item.id}`}
              className={`menu-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (!isActive) setActiveTab(item.id);
              }}
            >
              <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">AP</div>
          <div className="user-info">
            <span className="user-name">Admin Portal</span>
            <span className="user-role">Store Manager</span>
          </div>
        </div>
        <button
          type="button"
          className="logout-link"
          onClick={() => setLogoutModalOpen(true)}
        >
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
          <span>Logout Portal</span>
        </button>
      </div>
    </aside>
  );
}
