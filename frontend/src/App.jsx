import React, { Suspense, lazy, useEffect, useMemo } from "react";
import { usePharmacyStore } from "./store/usePharmacyStore";
import { AUTH_HASH_TO_SCREEN } from "./store/usePharmacyStore";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ProductModals from "./components/ProductModals";
import LogoutModal from "./components/LogoutModal";
import BillUploadModal from "./components/BillUploadModal";
import AuthPage from "./components/AuthPage";
import TabFallback from "./components/TabFallback";

/* Route-level code splitting — only the active workspace ships to the browser */
const DashboardTab = lazy(() => import("./components/DashboardTab"));
const InventoryTab = lazy(() => import("./components/InventoryTab"));
const CalendarTab = lazy(() => import("./components/CalendarTab"));
const BillingTab = lazy(() => import("./components/BillingTab"));
const AnalyticsTab = lazy(() => import("./components/AnalyticsTab"));
const SuppliersTab = lazy(() => import("./components/SuppliersTab"));
const CustomersTab = lazy(() => import("./components/CustomersTab"));
const SimulatorTab = lazy(() => import("./components/SimulatorTab"));
const AlertLogsTab = lazy(() => import("./components/AlertLogsTab"));
const SettingsTab = lazy(() => import("./components/SettingsTab"));

const DASHBOARD_TABS = [
  "dashboard",
  "inventory",
  "calendar",
  "billing",
  "analytics",
  "suppliers",
  "customers",
  "simulator",
  "notifications-log",
  "settings",
];

const TAB_LOADERS = {
  dashboard: DashboardTab,
  inventory: InventoryTab,
  calendar: CalendarTab,
  billing: BillingTab,
  analytics: AnalyticsTab,
  suppliers: SuppliersTab,
  customers: CustomersTab,
  simulator: SimulatorTab,
  "notifications-log": AlertLogsTab,
  settings: SettingsTab,
};

const TAB_LABELS = {
  dashboard: "Opening dashboard…",
  inventory: "Loading inventory…",
  calendar: "Opening expiry calendar…",
  billing: "Loading GST billing…",
  analytics: "Loading analytics…",
  suppliers: "Loading suppliers…",
  customers: "Loading customers…",
  simulator: "Opening simulator…",
  "notifications-log": "Loading alert logs…",
  settings: "Opening settings…",
};

export default function App() {
  const isAuthenticated = usePharmacyStore((s) => s.isAuthenticated);
  const activeTab = usePharmacyStore((s) => s.activeTab);
  const syncTabWithHash = usePharmacyStore((s) => s.syncTabWithHash);
  const fetchMedicines = usePharmacyStore((s) => s.fetchMedicines);
  const fetchNotifications = usePharmacyStore((s) => s.fetchNotifications);
  const fetchDashboardStats = usePharmacyStore((s) => s.fetchDashboardStats);
  const fetchBillStats = usePharmacyStore((s) => s.fetchBillStats);
  const fetchSuppliers = usePharmacyStore((s) => s.fetchSuppliers);

  // Critical bootstrap first, then warm secondary caches
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const warmSecondary = window.setTimeout(() => {
      if (cancelled) return;
      fetchBillStats();
      fetchSuppliers({ limit: 100, sort: "name", order: "asc" });
    }, 350);

    fetchDashboardStats();
    fetchNotifications();
    fetchMedicines({ limit: 50, sort: "expiryDate", order: "asc" });

    const pollInterval = window.setInterval(() => {
      fetchNotifications();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearTimeout(warmSecondary);
      window.clearInterval(pollInterval);
    };
  }, [
    isAuthenticated,
    fetchMedicines,
    fetchNotifications,
    fetchDashboardStats,
    fetchBillStats,
    fetchSuppliers,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const hash = window.location.hash.replace("#/", "");

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

  const ActiveTab = useMemo(
    () => TAB_LOADERS[activeTab] || DashboardTab,
    [activeTab],
  );

  return (
    <>
      {!isAuthenticated ? (
        <AuthPage />
      ) : (
        <div className="app-container">
          <Sidebar />

          <main className="main-content app-main">
            <Header />

            <div className="workspace-stage" key={activeTab}>
              <Suspense
                fallback={
                  <TabFallback label={TAB_LABELS[activeTab] || "Loading…"} />
                }
              >
                <ActiveTab />
              </Suspense>
            </div>
          </main>

          <ProductModals />
          <LogoutModal />
          <BillUploadModal />
        </div>
      )}
      <div className="toast-container" id="toast-container" />
    </>
  );
}
