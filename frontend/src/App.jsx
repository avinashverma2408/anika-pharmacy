import React, { useEffect } from "react";
import { usePharmacyStore } from "./store/usePharmacyStore";
import { AUTH_HASH_TO_SCREEN } from "./store/usePharmacyStore";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import DashboardTab from "./components/DashboardTab";
import InventoryTab from "./components/InventoryTab";
import CalendarTab from "./components/CalendarTab";
import SimulatorTab from "./components/SimulatorTab";
import AlertLogsTab from "./components/AlertLogsTab";
import SettingsTab from "./components/SettingsTab";
import BillingTab from "./components/BillingTab";
import ProductModals from "./components/ProductModals";
import LogoutModal from "./components/LogoutModal";
import AuthPage from "./components/AuthPage";

const DASHBOARD_TABS = [
  "dashboard",
  "inventory",
  "calendar",
  "billing",
  "simulator",
  "notifications-log",
  "settings",
];

export default function App() {
  const {
    activeTab,
    isAuthenticated,
    syncTabWithHash,
    fetchMedicines,
    fetchNotifications,
    fetchDashboardStats,
    fetchBillStats,
  } = usePharmacyStore();

  // ── On authenticated: fetch initial data ──────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    // Load all data from API
    fetchMedicines();
    fetchNotifications();
    fetchDashboardStats();
    fetchBillStats();

    // Poll notifications every 60 seconds
    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 60_000);

    return () => clearInterval(pollInterval);
  }, [isAuthenticated]);

  // ── Dashboard hash routing ─────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const hash = window.location.hash.replace("#/", "");

    // Redirect auth hashes to dashboard
    if (AUTH_HASH_TO_SCREEN["/" + hash]) {
      window.location.hash = "/dashboard";
    } else if (DASHBOARD_TABS.includes(hash)) {
      syncTabWithHash();
    } else {
      window.location.hash = "/dashboard";
    }

    const handleHashChange = () => syncTabWithHash();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [isAuthenticated, syncTabWithHash]);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content" style={{ maxWidth: "none", margin: "0" }}>
        <Header />

        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "calendar" && <CalendarTab />}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "simulator" && <SimulatorTab />}
        {activeTab === "notifications-log" && <AlertLogsTab />}
        {activeTab === "settings" && <SettingsTab />}
      </main>

      <ProductModals />
      <LogoutModal />

      <div className="toast-container" id="toast-container"></div>
    </div>
  );
}
