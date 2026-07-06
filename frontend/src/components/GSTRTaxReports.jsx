import React, { useState, useEffect } from "react";
import {
  formatDateTimeDisplay,
  showSimpleToast,
} from "../store/usePharmacyStore";
import { billApi } from "../api/apiClient";

export default function GSTRTaxReports() {
  const [reportStartDate, setReportStartDate] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().slice(0, 10);
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [reportBills, setReportBills] = useState([]);
  const [isLoadingReportBills, setIsLoadingReportBills] = useState(false);
  const [reportSearchQuery, setReportSearchQuery] = useState("");

  const fetchReportBills = async () => {
    setIsLoadingReportBills(true);
    try {
      const { data } = await billApi.getAll({
        startDate: reportStartDate,
        endDate: reportEndDate,
        noPagination: "true",
      });
      if (data.success) {
        setReportBills(data.bills || []);
      }
    } catch (err) {
      console.error("Failed to load report bills:", err);
      showSimpleToast("Error", "Failed to load tax report details.", "danger");
    } finally {
      setIsLoadingReportBills(false);
    }
  };

  useEffect(() => {
    fetchReportBills();
  }, [reportStartDate, reportEndDate]);

  const handleDownloadReportCSV = () => {
    if (!reportBills || reportBills.length === 0) {
      showSimpleToast("No Data", "There are no records to export.", "warning");
      return;
    }

    const headers = [
      "Invoice No",
      "Invoice Date",
      "Patient Name",
      "Patient Mobile",
      "Doctor Name",
      "Medicine Name",
      "Batch",
      "Qty",
      "Price",
      "GST Rate (%)",
      "Taxable Value (Rs)",
      "CGST (Rs)",
      "SGST (Rs)",
      "Total GST (Rs)",
      "Discount (Rs)",
      "Net Amount (Rs)",
      "Payment Mode",
    ];

    const rows = [];
    reportBills.forEach((bill) => {
      const discPct = bill.discountPercent || 0;
      bill.items.forEach((item) => {
        const itemGross = item.amount;
        const itemDisc = itemGross * (discPct / 100);
        const itemNet = itemGross - itemDisc;
        const rate = item.gstRate || 5;
        const taxable = itemNet / (1 + rate / 100);
        const cgst = taxable * (rate / 200);
        const sgst = taxable * (rate / 200);

        rows.push([
          bill.invoiceNo,
          new Date(bill.billDate).toLocaleDateString("en-GB"),
          bill.patientName || "CASH CUSTOMER",
          bill.patientMobile || "N/A",
          bill.doctorName || "N/A",
          item.name,
          item.batch,
          item.quantity,
          item.price.toFixed(2),
          `${rate}%`,
          taxable.toFixed(2),
          cgst.toFixed(2),
          sgst.toFixed(2),
          (cgst + sgst).toFixed(2),
          itemDisc.toFixed(2),
          itemNet.toFixed(2),
          bill.paymentMode || "Cash",
        ]);
      });
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `GSTR_Sales_Report_${reportStartDate}_to_${reportEndDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSimpleToast("Export Success", "GSTR CSV report downloaded successfully!", "success");
  };

  const generateReportPDF = () => {
    const element = document.querySelector(".reports-print-wrapper");
    if (!element) return;

    showSimpleToast("Generating PDF", "Compiling GST Tax Report...", "success");

    element.classList.add("pdf-generation-in-progress");

    setTimeout(() => {
      Promise.all([import("html2canvas"), import("jspdf")])
        .then(([html2canvasModule, jsPDFModule]) => {
          const html2canvas = html2canvasModule.default || html2canvasModule;
          const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule;

          html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
          })
            .then((canvas) => {
              const imgData = canvas.toDataURL("image/jpeg", 0.95);
              const imgWidth = 210;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              const pdf = new jsPDF("p", "mm", [210, Math.max(297, imgHeight)]);

              pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
              pdf.save(`GST_Tax_Report_${reportStartDate}_to_${reportEndDate}.pdf`);

              element.classList.remove("pdf-generation-in-progress");
              showSimpleToast("Success", "GST Tax PDF report downloaded successfully!", "success");
            })
            .catch((err) => {
              console.error("Canvas capture failed:", err);
              element.classList.remove("pdf-generation-in-progress");
              showSimpleToast("PDF Error", "Failed to capture report layout.", "danger");
            });
        })
        .catch((err) => {
          console.error("Failed to load PDF libraries:", err);
          element.classList.remove("pdf-generation-in-progress");
          showSimpleToast("Library Error", "Failed to load PDF libraries.", "danger");
        });
    }, 150);
  };

  // Filtered bills based on table search
  const filteredReportBills = reportBills.filter((bill) => {
    const term = reportSearchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      (bill.invoiceNo && bill.invoiceNo.toLowerCase().includes(term)) ||
      (bill.patientName && bill.patientName.toLowerCase().includes(term)) ||
      (bill.patientMobile && bill.patientMobile.includes(term))
    );
  });

  // Calculate Report Aggregates
  let reportGrossSales = 0;
  let reportTotalDiscount = 0;
  let reportTotalTaxable = 0;
  let reportTotalCGST = 0;
  let reportTotalSGST = 0;
  
  const slabBreakdown = {
    5: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, amount: 0 },
    12: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, amount: 0 },
    18: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, amount: 0 },
    28: { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, amount: 0 },
  };

  filteredReportBills.forEach((bill) => {
    const discPct = bill.discountPercent || 0;
    reportGrossSales += bill.netTotal;
    reportTotalDiscount += bill.discountAmount;

    bill.items.forEach((item) => {
      const itemGross = item.amount;
      const itemDisc = itemGross * (discPct / 100);
      const itemNet = itemGross - itemDisc;
      const rate = item.gstRate || 5;

      const taxable = itemNet / (1 + rate / 100);
      const cgst = taxable * (rate / 200);
      const sgst = taxable * (rate / 200);

      reportTotalTaxable += taxable;
      reportTotalCGST += cgst;
      reportTotalSGST += sgst;

      if (!slabBreakdown[rate]) {
        slabBreakdown[rate] = { taxable: 0, cgst: 0, sgst: 0, totalGst: 0, amount: 0 };
      }
      slabBreakdown[rate].taxable += taxable;
      slabBreakdown[rate].cgst += cgst;
      slabBreakdown[rate].sgst += sgst;
      slabBreakdown[rate].totalGst += cgst + sgst;
      slabBreakdown[rate].amount += itemNet;
    });
  });

  const reportTotalGST = reportTotalCGST + reportTotalSGST;

  return (
    <>
      <div className="settlement-panel">
        <div className="settlement-date-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
              <i className="fa-solid fa-file-invoice-dollar" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>
              GST &amp; Financial Reports (Tax Audit Ready)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              View tax logs, check GST slab performance, and download GSTR-1 ready CSV or PDF audits.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline" onClick={handleDownloadReportCSV}>
              <i className="fa-solid fa-file-excel" style={{ marginRight: '6px' }}></i> Export GSTR CSV
            </button>
            <button className="btn btn-outline btn-icon" onClick={generateReportPDF}>
              <i className="fa-solid fa-file-pdf"></i> Download PDF Report
            </button>
          </div>
        </div>

        {/* Date Range Selector Card */}
        <div className="card-panel" style={{ marginBottom: '20px', padding: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', marginBottom: '4px', fontWeight: '600' }}>Start Date</label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0, flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', marginBottom: '4px', fontWeight: '600' }}>End Date</label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              />
            </div>
            <div className="form-group" style={{ margin: 0, flex: '1 1 250px' }}>
              <label style={{ fontSize: '11px', marginBottom: '4px', fontWeight: '600' }}>Filter Transactions</label>
              <input
                type="text"
                placeholder="Search Invoice or Patient..."
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              />
            </div>
            <button className="btn btn-primary" onClick={fetchReportBills} style={{ height: '36px', padding: '0 16px' }}>
              <i className="fa-solid fa-sync"></i> Refresh
            </button>
          </div>
        </div>

        {/* Valuation Metrics Grid */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div className="stat-card border-primary" style={{ padding: '16px' }}>
            <div className="stat-info">
              <span className="stat-label">Net Sales Revenue</span>
              <h3 className="stat-value">₹{reportGrossSales.toFixed(2)}</h3>
            </div>
          </div>
          <div className="stat-card border-success" style={{ padding: '16px' }}>
            <div className="stat-info">
              <span className="stat-label">Taxable Value</span>
              <h3 className="stat-value">₹{reportTotalTaxable.toFixed(2)}</h3>
            </div>
          </div>
          <div className="stat-card border-warning" style={{ padding: '16px' }}>
            <div className="stat-info">
              <span className="stat-label">CGST Collected</span>
              <h3 className="stat-value">₹{reportTotalCGST.toFixed(2)}</h3>
            </div>
          </div>
          <div className="stat-card border-warning" style={{ padding: '16px' }}>
            <div className="stat-info">
              <span className="stat-label">SGST Collected</span>
              <h3 className="stat-value">₹{reportTotalSGST.toFixed(2)}</h3>
            </div>
          </div>
          <div className="stat-card border-success" style={{ padding: '16px', background: 'var(--bg-card-hover)' }}>
            <div className="stat-info">
              <span className="stat-label" style={{ color: 'var(--primary)', fontWeight: '600' }}>Total Tax Collected</span>
              <h3 className="stat-value" style={{ color: 'var(--primary)' }}>₹{reportTotalGST.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        {/* Breakdown of Slabs */}
        <div className="settlement-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="card-panel">
            <h3 className="analytics-section-title" style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-chart-bar"></i> Tax Performance by Slab
            </h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>GST Rate</th>
                    <th>Taxable (₹)</th>
                    <th>CGST (₹)</th>
                    <th>SGST (₹)</th>
                    <th>Total Tax (₹)</th>
                    <th className="text-right">Billed Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(slabBreakdown)
                    .filter(([_, stats]) => stats.amount > 0)
                    .map(([rate, stats]) => (
                      <tr key={rate}>
                        <td><strong>GST {rate}%</strong></td>
                        <td>₹{stats.taxable.toFixed(2)}</td>
                        <td>₹{stats.cgst.toFixed(2)}</td>
                        <td>₹{stats.sgst.toFixed(2)}</td>
                        <td style={{ fontWeight: '600' }}>₹{stats.totalGst.toFixed(2)}</td>
                        <td className="text-right" style={{ fontWeight: '700' }}>₹{stats.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  {Object.values(slabBreakdown).reduce((sum, s) => sum + s.amount, 0) === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No billing transactions in selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-panel">
            <h3 className="analytics-section-title" style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-credit-card"></i> Payment Mode Summary
            </h3>
            <div className="valuation-stats-list">
              <div className="val-stat-item" style={{ padding: '10px 0' }}>
                <span className="val-stat-label"><strong>Cash Payments</strong></span>
                <span className="val-stat-value" style={{ color: '#10b981' }}>
                  ₹{filteredReportBills.reduce((sum, b) => b.paymentMode === "Cash" ? sum + b.netTotal : sum, 0).toFixed(2)}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({filteredReportBills.filter(b => b.paymentMode === "Cash").length} bills)
                  </span>
                </span>
              </div>
              <div className="val-stat-item" style={{ padding: '10px 0' }}>
                <span className="val-stat-label"><strong>Card Payments</strong></span>
                <span className="val-stat-value" style={{ color: 'var(--primary)' }}>
                  ₹{filteredReportBills.reduce((sum, b) => b.paymentMode === "Card" ? sum + b.netTotal : sum, 0).toFixed(2)}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({filteredReportBills.filter(b => b.paymentMode === "Card").length} bills)
                  </span>
                </span>
              </div>
              <div className="val-stat-item" style={{ padding: '10px 0' }}>
                <span className="val-stat-label"><strong>UPI Payments</strong></span>
                <span className="val-stat-value" style={{ color: '#f59e0b' }}>
                  ₹{filteredReportBills.reduce((sum, b) => b.paymentMode === "UPI" ? sum + b.netTotal : sum, 0).toFixed(2)}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({filteredReportBills.filter(b => b.paymentMode === "UPI").length} bills)
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions log list */}
        <div className="card-panel">
          <h3 className="analytics-section-title" style={{ marginBottom: '16px' }}>
            <i className="fa-solid fa-list-check"></i> Audit Invoices List ({filteredReportBills.length})
          </h3>
          <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date &amp; Time</th>
                  <th>Patient Name</th>
                  <th>Discount (₹)</th>
                  <th>Tax (₹)</th>
                  <th className="text-right">Net Paid (₹)</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingReportBills ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                      <i className="fa-solid fa-spinner fa-spin"></i> Compiling report...
                    </td>
                  </tr>
                ) : filteredReportBills.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      No bills found in selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredReportBills.map((b) => (
                    <tr key={b._id || b.id}>
                      <td><code>{b.invoiceNo}</code></td>
                      <td>{formatDateTimeDisplay(b.billDate)}</td>
                      <td><strong>{b.patientName}</strong></td>
                      <td>₹{b.discountAmount.toFixed(2)}</td>
                      <td>₹{(b.cgst + b.sgst).toFixed(2)}</td>
                      <td className="text-right" style={{ fontWeight: '700' }}>₹{b.netTotal.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── PRINT-ONLY GST REPORT LAYOUT ── */}
      <div className="print-only reports-print-wrapper">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#000000' }}>ANIKA PHARMACY</h1>
            <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#555555' }}>Pandeybaba bazar, Kadipur Road | Sultanpur, UP - 228145</p>
            <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#555555' }}>Phone : 9795358689, 6386470668</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#000000' }}>GST TAX AUDIT REPORT</h2>
            <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#555555' }}>Period: {new Date(reportStartDate).toLocaleDateString('en-GB')} to {new Date(reportEndDate).toLocaleDateString('en-GB')}</p>
            <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#555555' }}>Generated: {new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <h4 style={{ fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px', color: '#000000' }}>FINANCIAL SUMMARY</h4>
        <table className="reports-print-table" style={{ marginTop: '5px', marginBottom: '15px' }}>
          <thead>
            <tr>
              <th>Metric Description</th>
              <th style={{ textAlign: 'right' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Gross Sales (Net Revenue Billed)</strong></td>
              <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{reportGrossSales.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total Taxable Value (Excluding GST)</td>
              <td style={{ textAlign: 'right' }}>₹{reportTotalTaxable.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total CGST Collected</td>
              <td style={{ textAlign: 'right' }}>₹{reportTotalCGST.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total SGST Collected</td>
              <td style={{ textAlign: 'right' }}>₹{reportTotalSGST.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Total Tax Collected (CGST + SGST)</strong></td>
              <td style={{ textAlign: 'right', fontWeight: '700', color: '#8b5cf6' }}>₹{reportTotalGST.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total Discounts Offered</td>
              <td style={{ textAlign: 'right' }}>₹{reportTotalDiscount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px', color: '#000000' }}>GST RATE SLAB BREAKDOWN</h4>
        <table className="reports-print-table" style={{ marginTop: '5px', marginBottom: '15px' }}>
          <thead>
            <tr>
              <th>GST Slab</th>
              <th style={{ textAlign: 'right' }}>Taxable Value (₹)</th>
              <th style={{ textAlign: 'right' }}>CGST (₹)</th>
              <th style={{ textAlign: 'right' }}>SGST (₹)</th>
              <th style={{ textAlign: 'right' }}>Total Tax (₹)</th>
              <th style={{ textAlign: 'right' }}>Total Billed (₹)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(slabBreakdown)
              .filter(([_, stats]) => stats.amount > 0)
              .map(([rate, stats]) => (
                <tr key={rate}>
                  <td><strong>GST {rate}%</strong></td>
                  <td style={{ textAlign: 'right' }}>₹{stats.taxable.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹{stats.cgst.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹{stats.sgst.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>₹{stats.totalGst.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{stats.amount.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <h4 style={{ fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px', color: '#000000' }}>PAYMENT METHOD SUMMARY</h4>
        <table className="reports-print-table" style={{ marginTop: '5px', marginBottom: '15px' }}>
          <thead>
            <tr>
              <th>Payment Mode</th>
              <th style={{ textAlign: 'right' }}>Invoices Count</th>
              <th style={{ textAlign: 'right' }}>Total Collected (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cash Payments</td>
              <td style={{ textAlign: 'right' }}>{filteredReportBills.filter(b => b.paymentMode === "Cash").length}</td>
              <td style={{ textAlign: 'right' }}>₹{filteredReportBills.reduce((sum, b) => b.paymentMode === "Cash" ? sum + b.netTotal : sum, 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Card Payments</td>
              <td style={{ textAlign: 'right' }}>{filteredReportBills.filter(b => b.paymentMode === "Card").length}</td>
              <td style={{ textAlign: 'right' }}>₹{filteredReportBills.reduce((sum, b) => b.paymentMode === "Card" ? sum + b.netTotal : sum, 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>UPI Payments</td>
              <td style={{ textAlign: 'right' }}>{filteredReportBills.filter(b => b.paymentMode === "UPI").length}</td>
              <td style={{ textAlign: 'right' }}>₹{filteredReportBills.reduce((sum, b) => b.paymentMode === "UPI" ? sum + b.netTotal : sum, 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <div style={{ width: '40%', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
            Prepared By (Administrator)
          </div>
          <div style={{ width: '40%', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
            Verified By (Authorized Auditor)
          </div>
        </div>
      </div>
    </>
  );
}
