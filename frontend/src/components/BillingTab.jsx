import React, { useState } from "react";
import NewBillCalculator from "./NewBillCalculator";
import BillingHistory from "./BillingHistory";
import GSTRTaxReports from "./GSTRTaxReports";
import DayEndSettlement from "./DayEndSettlement";

export default function BillingTab() {
  const [billingSubTab, setBillingSubTab] = useState("new");

  return (
    <section id="tab-billing" className="tab-pane active">
      {/* Screen View */}
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

        {/* Sub Tab Navigation */}
        <div className="sub-tabs-container" style={{ marginBottom: "20px" }}>
          <button
            className={`sub-tab-btn ${billingSubTab === "new" ? "active" : ""}`}
            onClick={() => setBillingSubTab("new")}
          >
            <i className="fa-solid fa-calculator"></i> New Bill Calculator
          </button>
          <button
            className={`sub-tab-btn ${billingSubTab === "history" ? "active" : ""}`}
            onClick={() => setBillingSubTab("history")}
          >
            <i className="fa-solid fa-clock-rotate-left"></i> Billing History
            &amp; Revenue Reports
          </button>
          <button
            className={`sub-tab-btn ${billingSubTab === "reports" ? "active" : ""}`}
            onClick={() => setBillingSubTab("reports")}
          >
            <i className="fa-solid fa-file-invoice-dollar"></i> GST &amp; Tax Reports
          </button>
          <button
            className={`sub-tab-btn ${billingSubTab === "settlement" ? "active" : ""}`}
            onClick={() => setBillingSubTab("settlement")}
          >
            <i className="fa-solid fa-cash-register"></i> Day-End Settlement
          </button>
        </div>

        {/* Conditional rendering of sub-tab components */}
        {billingSubTab === "new" && <NewBillCalculator />}
        {billingSubTab === "history" && <BillingHistory />}
        {billingSubTab === "reports" && <GSTRTaxReports />}
        {billingSubTab === "settlement" && <DayEndSettlement />}
      </div>
    </section>
  );
}
