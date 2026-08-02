import React from "react";
import { usePharmacyStore } from "../store/usePharmacyStore";

export default function MobileBottomNav() {
  const activeTab = usePharmacyStore((s) => s.activeTab);
  const setActiveTab = usePharmacyStore((s) => s.setActiveTab);
  const toggleMobileSidebar = usePharmacyStore((s) => s.toggleMobileSidebar);
  const closeMobileSidebar = usePharmacyStore((s) => s.closeMobileSidebar);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    closeMobileSidebar();
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation Bar">
      <button
        type="button"
        className={`mobile-bottom-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
        onClick={() => handleTabClick("dashboard")}
      >
        <i className="fa-solid fa-chart-pie"></i>
        <span>Dashboard</span>
      </button>

      <button
        type="button"
        className={`mobile-bottom-nav-item ${activeTab === "inventory" ? "active" : ""}`}
        onClick={() => handleTabClick("inventory")}
      >
        <i className="fa-solid fa-boxes-stacked"></i>
        <span>Inventory</span>
      </button>

      <button
        type="button"
        className={`mobile-bottom-nav-item ${activeTab === "billing" ? "active" : ""}`}
        onClick={() => handleTabClick("billing")}
      >
        <i className="fa-solid fa-file-invoice-dollar"></i>
        <span>Billing</span>
      </button>

      <button
        type="button"
        className={`mobile-bottom-nav-item ${activeTab === "analytics" ? "active" : ""}`}
        onClick={() => handleTabClick("analytics")}
      >
        <i className="fa-solid fa-chart-line"></i>
        <span>Analytics</span>
      </button>

      <button
        type="button"
        className="mobile-bottom-nav-item"
        onClick={toggleMobileSidebar}
      >
        <i className="fa-solid fa-bars"></i>
        <span>Menu</span>
      </button>
    </nav>
  );
}
