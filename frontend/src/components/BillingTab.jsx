import React, { Suspense, lazy, useState } from "react";
import TabFallback from "./TabFallback";

const NewBillCalculator = lazy(() => import("./NewBillCalculator"));
const BillingHistory = lazy(() => import("./BillingHistory"));
const GSTRTaxReports = lazy(() => import("./GSTRTaxReports"));
const DayEndSettlement = lazy(() => import("./DayEndSettlement"));

const SUB_TABS = [
  {
    id: "new",
    label: "New Bill Calculator",
    icon: "fa-calculator",
    Component: NewBillCalculator,
  },
  {
    id: "history",
    label: "Billing History & Revenue Reports",
    icon: "fa-clock-rotate-left",
    Component: BillingHistory,
  },
  {
    id: "reports",
    label: "GST & Tax Reports",
    icon: "fa-file-invoice-dollar",
    Component: GSTRTaxReports,
  },
  {
    id: "settlement",
    label: "Day-End Settlement",
    icon: "fa-cash-register",
    Component: DayEndSettlement,
  },
];

export default function BillingTab() {
  const [billingSubTab, setBillingSubTab] = useState("new");
  const active = SUB_TABS.find((tab) => tab.id === billingSubTab) || SUB_TABS[0];
  const ActivePanel = active.Component;

  return (
    <section id="tab-billing" className="tab-pane active">
      <div className="no-print">
        <div className="page-header flex-header">
          <div>
            <h2>GST Billing &amp; Invoicing</h2>
            <p className="subtitle">
              Search medicines, compile invoices, check monthly revenue, and
              print receipts.
            </p>
          </div>
        </div>

        <div className="sub-tabs-container billing-subtabs">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`sub-tab-btn ${billingSubTab === tab.id ? "active" : ""}`}
              onClick={() => setBillingSubTab(tab.id)}
            >
              <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
            </button>
          ))}
        </div>

        <Suspense fallback={<TabFallback label="Loading billing panel…" />}>
          <ActivePanel />
        </Suspense>
      </div>
    </section>
  );
}
