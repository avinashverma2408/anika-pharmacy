import React, { useState, useEffect } from "react";
import {
  usePharmacyStore,
  formatDateTimeDisplay,
  showSimpleToast,
} from "../store/usePharmacyStore";
import { billApi } from "../api/apiClient";

export default function DayEndSettlement() {
  const { simulatedDate } = usePharmacyStore();

  const [settlementBills, setSettlementBills] = useState([]);
  const [isLoadingSettlement, setIsLoadingSettlement] = useState(false);
  const [openingFloat, setOpeningFloat] = useState(1000);
  const [countedCash, setCountedCash] = useState(1000);
  const [checklistSearch, setChecklistSearch] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchSettlementBills = async () => {
    setIsLoadingSettlement(true);
    try {
      const { data } = await billApi.getAll({ date: simulatedDate, limit: 100 });
      if (data.success) {
        setSettlementBills(data.bills || []);
      }
    } catch (err) {
      console.error("Failed to load settlement bills:", err);
      showSimpleToast("Error", "Failed to load settlement details.", "danger");
    } finally {
      setIsLoadingSettlement(false);
    }
  };

  useEffect(() => {
    fetchSettlementBills();
  }, [simulatedDate]);

  const generateSettlementPDF = () => {
    const element = document.querySelector(".settlement-print-wrapper");
    if (!element) return;

    showSimpleToast("Generating PDF", "Compiling settlement report...", "success");

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
              pdf.save(`Day_End_Settlement_${simulatedDate}.pdf`);

              element.classList.remove("pdf-generation-in-progress");
              showSimpleToast("Success", "Settlement PDF downloaded successfully!", "success");
            })
            .catch((err) => {
              console.error("Canvas capture failed:", err);
              element.classList.remove("pdf-generation-in-progress");
              showSimpleToast("PDF Error", "Failed to capture settlement report.", "danger");
            });
        })
        .catch((err) => {
          console.error("Failed to load PDF libraries:", err);
          element.classList.remove("pdf-generation-in-progress");
          showSimpleToast("Library Error", "Failed to load PDF libraries.", "danger");
        });
    }, 150);
  };

  const floatVal = parseFloat(openingFloat) || 0;
  const countVal = parseFloat(countedCash) || 0;
  const totalSales = settlementBills.reduce((sum, b) => sum + (b.netTotal || 0), 0);
  const cashCollected = settlementBills.reduce((sum, b) => (b.paymentMode || "Cash") === "Cash" ? sum + (b.netTotal || 0) : sum, 0);
  const cardCollected = settlementBills.reduce((sum, b) => b.paymentMode === "Card" ? sum + (b.netTotal || 0) : sum, 0);
  const upiCollected = settlementBills.reduce((sum, b) => b.paymentMode === "UPI" ? sum + (b.netTotal || 0) : sum, 0);
  const expectedCash = floatVal + cashCollected;
  const discrepancy = countVal - expectedCash;

  const filteredSettlementBills = settlementBills.filter((b) => {
    const term = checklistSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      (b.invoiceNo && b.invoiceNo.toLowerCase().includes(term)) ||
      (b.patientName && b.patientName.toLowerCase().includes(term)) ||
      (b.paymentMode && b.paymentMode.toLowerCase().includes(term)) ||
      (b.patientMobile && b.patientMobile.includes(term))
    );
  });

  return (
    <>
      <div className="settlement-panel">
        <div className="settlement-date-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>
              Shift Settlement for Simulated Date
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Reconcile cash drawer and payments for date: <strong>{new Date(simulatedDate).toLocaleDateString('en-GB')}</strong>
            </p>
          </div>
          <button className="btn btn-outline btn-icon" onClick={generateSettlementPDF}>
            <i className="fa-solid fa-file-pdf"></i> Download PDF Report
          </button>
        </div>

        <div className="settlement-grid">
          <div className="card-panel">
            <h3 className="analytics-section-title" style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-chart-pie"></i> Payment Mode Breakdown
            </h3>
            
            <div className="settlement-summary-metrics">
              <div className="financial-card card-month" style={{ padding: '10px 12px' }}>
                <span className="fin-label" style={{ fontSize: '8px' }}>Cash Sales</span>
                <h4 className="fin-value" style={{ fontSize: '13px', color: '#10b981' }}>₹{cashCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
              </div>
              <div className="financial-card card-month" style={{ padding: '10px 12px' }}>
                <span className="fin-label" style={{ fontSize: '8px' }}>Card Sales</span>
                <h4 className="fin-value" style={{ fontSize: '13px', color: 'var(--primary)' }}>₹{cardCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
              </div>
              <div className="financial-card card-month" style={{ padding: '10px 12px' }}>
                <span className="fin-label" style={{ fontSize: '8px' }}>UPI Sales</span>
                <h4 className="fin-value" style={{ fontSize: '13px', color: '#f59e0b' }}>₹{upiCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
              </div>
              <div className="financial-card card-month" style={{ padding: '10px 12px', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)' }}>
                <span className="fin-label" style={{ fontSize: '8px', color: 'var(--primary)', fontWeight: '600' }}>Total Shift Revenue</span>
                <h4 className="fin-value" style={{ fontSize: '13px', color: 'var(--primary)' }}>₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
              </div>
            </div>

            <h3 className="analytics-section-title" style={{ margin: '24px 0 16px' }}>
              <i className="fa-solid fa-calculator"></i> Cash Drawer Reconciliation
            </h3>
            
            <div className="modal-form" style={{ padding: 0 }}>
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label>Opening Float Cash (₹)</label>
                  <input
                    type="number"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="Enter Opening Float Amount"
                  />
                </div>
                <div className="form-group">
                  <label>Actual Counted Cash in Drawer (₹)</label>
                  <input
                    type="number"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    placeholder="Count cash in drawer..."
                  />
                </div>
              </div>
            </div>

            <div className="settlement-results" style={{ marginTop: '16px', background: 'var(--bg-card-hover)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span>Opening Cash Float:</span>
                <span>₹{floatVal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span>+ Cash Revenue Collected:</span>
                <span>₹{cashCollected.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
                <span>= Expected Cash in Drawer:</span>
                <span>₹{expectedCash.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span>Actual Counted Cash:</span>
                <span>₹{countVal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '800', borderTop: '1px double var(--text-primary)', paddingTop: '8px' }}>
                <span>Discrepancy:</span>
                <span style={{ color: discrepancy === 0 ? '#10b981' : discrepancy < 0 ? '#ef4444' : '#f59e0b' }}>
                  {discrepancy === 0 ? '₹0.00 (Balanced)' : discrepancy < 0 ? `-₹${Math.abs(discrepancy).toFixed(2)} (Shortage)` : `+₹${discrepancy.toFixed(2)} (Overage)`}
                </span>
              </div>
            </div>
          </div>

          <div className="card-panel">
            <div className="panel-header flex-header" style={{ borderBottom: 'none', marginBottom: '16px', paddingBottom: 0 }}>
              <div className="panel-title-group">
                <i className="fa-solid fa-list-check panel-icon text-primary-color" style={{ color: 'var(--primary)' }}></i>
                <h3>Shift Transactions ({filteredSettlementBills.length})</h3>
              </div>
            </div>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Search checklist (Invoice No, Patient name, payment Mode)..."
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              />
            </div>

            <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'center' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingSettlement ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>Loading transactions...</td>
                    </tr>
                  ) : filteredSettlementBills.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No transactions found for this query.</td>
                    </tr>
                  ) : (
                    filteredSettlementBills.map((b) => {
                      return (
                        <tr key={b._id}>
                          <td><code>{b.invoiceNo}</code></td>
                          <td>
                            <span className={`category-label ${b.paymentMode === 'Cash' ? 'green' : b.paymentMode === 'Card' ? 'blue' : 'orange'}`}>
                              {b.paymentMode || 'Cash'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="checklist-amount">₹{b.netTotal.toFixed(2)}</span>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="checklist-action-btn"
                              title="View Bill Details"
                              onClick={() => {
                                setSelectedBill(b);
                                setIsDetailsOpen(true);
                              }}
                            >
                              <i className="fa-solid fa-eye"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── BILL DETAILS MODAL ── */}
      {isDetailsOpen && selectedBill && (
        <div
          className="modal-backdrop show"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="modal-content card-panel"
            style={{
              width: "90%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
            }}
          >
            <div
              className="modal-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ fontSize: "18px", fontWeight: "bold" }}>Invoice Detail View</h3>
              <button
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "28px",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
                onClick={() => {
                  setIsDetailsOpen(false);
                  setSelectedBill(null);
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body: Styled Invoice Receipt */}
            <div
              style={{
                background: "#ffffff",
                color: "#000000",
                padding: "24px",
                borderRadius: "8px",
                border: "1px solid #cccccc",
                fontFamily: "monospace",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "2px solid #000000",
                  paddingBottom: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#000000", margin: 0 }}>ANIKA PHARMACY</h2>
                  <p style={{ fontSize: "12px", margin: "2px 0", color: "#333333" }}>
                    Pandeybaba bazar, Kadipur Road, Sultanpur, UP
                  </p>
                  <p style={{ fontSize: "12px", margin: "2px 0", color: "#333333" }}>
                    Phone : 9795358689, 6386470668
                  </p>
                  <p style={{ fontSize: "12px", margin: "2px 0", color: "#333333" }}>
                    D.L.No. : UP44200000460, UP44210000461
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000000" }}>GST INVOICE</div>
                  <div style={{ fontSize: "11px", color: "#555555" }}>Invoice: {selectedBill.invoiceNo}</div>
                  <div style={{ fontSize: "11px", color: "#555555" }}>
                    Date: {formatDateTimeDisplay(selectedBill.billDate)}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "12px", fontSize: "12px", color: "#000000" }}>
                <strong>Billed To:</strong> {selectedBill.patientName?.toUpperCase()}
                {selectedBill.patientAddress && (
                  <>
                    <br />
                    <strong>Address:</strong> {selectedBill.patientAddress}
                  </>
                )}
                {selectedBill.doctorName && (
                  <>
                    <br />
                    <strong>Dr. Ref:</strong> {selectedBill.doctorName.toUpperCase()}
                  </>
                )}
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "11px",
                  marginBottom: "12px",
                  color: "#000000",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #000000", background: "#f0f0f0" }}>
                    <th style={{ textAlign: "left", padding: "6px", color: "#000000" }}>Product</th>
                    <th style={{ textAlign: "center", padding: "6px", color: "#000000" }}>Batch</th>
                    <th style={{ textAlign: "center", padding: "6px", color: "#000000" }}>Pack</th>
                    <th style={{ textAlign: "center", padding: "6px", color: "#000000" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "6px", color: "#000000" }}>Rate</th>
                    <th style={{ textAlign: "center", padding: "6px", color: "#000000" }}>GST</th>
                    <th style={{ textAlign: "right", padding: "6px", color: "#000000" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #eeeeee" }}>
                      <td style={{ padding: "6px", color: "#000000" }}>
                        <strong>{item.name?.toUpperCase()}</strong>
                      </td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.batch}</td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.pack || "1*10"}</td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right", padding: "6px", color: "#000000" }}>₹{item.price?.toFixed(2)}</td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.gstRate || 5}%</td>
                      <td style={{ textAlign: "right", padding: "6px", color: "#000000" }}>
                        ₹{item.amount?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  paddingTop: "10px",
                  borderTop: "1px solid #000000",
                  color: "#000000",
                }}
              >
                <div>
                  <strong>Tax Breakdown:</strong>
                  <br />
                  Taxable Value: ₹{selectedBill.taxableValue?.toFixed(2)}
                  <br />
                  CGST: ₹{selectedBill.cgst?.toFixed(2)} | SGST: ₹{selectedBill.sgst?.toFixed(2)}
                </div>
                <div style={{ textAlign: "right", width: "220px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span>Subtotal:</span>
                    <span>₹{selectedBill.subTotal?.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                    <span>Discount ({selectedBill.discountPercent}%):</span>
                    <span>₹{selectedBill.discountAmount?.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      margin: "2px 0",
                      borderTop: "1px solid #000000",
                      paddingTop: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    <span>Grand Total:</span>
                    <span>₹{selectedBill.netTotal?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setIsDetailsOpen(false);
                  setSelectedBill(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT-ONLY SETTLEMENT REPORT LAYOUT ── */}
      <div className="print-only settlement-print-wrapper">
        <div className="settlement-print-header">
          <div>
            <h1 className="settlement-print-title" style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>ANIKA PHARMACY</h1>
            <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#555' }}>Pandeybaba bazar, Kadipur Road | Sultanpur, UP - 228145</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '700', margin: 0 }}>SHIFT CLOSING REPORT</h2>
            <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#555' }}>Date: {new Date(simulatedDate).toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <div className="settlement-print-grid">
          <div className="settlement-print-block">
            <h4>SHIFT SALES SUMMARY</h4>
            <div className="settlement-print-row">
              <strong>Total Bills Count:</strong>
              <span>{settlementBills.length} Invoices</span>
            </div>
            <div className="settlement-print-row">
              <strong>Cash Revenue Collected:</strong>
              <span>₹{cashCollected.toFixed(2)}</span>
            </div>
            <div className="settlement-print-row">
              <strong>Card Revenue Collected:</strong>
              <span>₹{cardCollected.toFixed(2)}</span>
            </div>
            <div className="settlement-print-row">
              <strong>UPI Revenue Collected:</strong>
              <span>₹{upiCollected.toFixed(2)}</span>
            </div>
            <div className="settlement-print-row" style={{ borderTop: '1px solid #ddd', paddingTop: '6px', marginTop: '6px', fontWeight: 'bold' }}>
              <span>Total Shift Revenue:</span>
              <span>₹{totalSales.toFixed(2)}</span>
            </div>
          </div>

          <div className="settlement-print-block">
            <h4>DRAWER RECONCILIATION</h4>
            <div className="settlement-print-row">
              <strong>Opening Float Cash:</strong>
              <span>₹{floatVal.toFixed(2)}</span>
            </div>
            <div className="settlement-print-row">
              <strong>+ Cash Sales Collected:</strong>
              <span>₹{cashCollected.toFixed(2)}</span>
            </div>
            <div className="settlement-print-row" style={{ borderTop: '1px solid #ddd', paddingTop: '6px', marginTop: '6px' }}>
              <strong>= Expected Cash in Drawer:</strong>
              <span>₹{expectedCash.toFixed(2)}</span>
            </div>
            <div className="settlement-print-row">
              <strong>Counted Cash in Drawer:</strong>
              <span>₹{countVal.toFixed(2)}</span>
            </div>
            <div className="settlement-print-row" style={{ borderTop: '1px double #000', paddingTop: '6px', marginTop: '6px', fontWeight: 'bold' }}>
              <span>Reconciliation Discrepancy:</span>
              <span style={{ color: discrepancy === 0 ? '#10b981' : discrepancy < 0 ? '#ef4444' : '#f59e0b' }}>
                {discrepancy === 0 ? '₹0.00 (Balanced)' : discrepancy < 0 ? `-₹${Math.abs(discrepancy).toFixed(2)} (Shortage)` : `+₹${discrepancy.toFixed(2)} (Overage)`}
              </span>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>SHIFT TRANSACTION LIST</h4>
          <table className="settlement-print-table">
            <thead>
              <tr>
                <th style={{ borderBottom: '1.5px solid #000' }}>Invoice No</th>
                <th style={{ borderBottom: '1.5px solid #000' }}>Date &amp; Time</th>
                <th style={{ borderBottom: '1.5px solid #000' }}>Patient Name</th>
                <th style={{ borderBottom: '1.5px solid #000' }}>Payment Mode</th>
                <th style={{ borderBottom: '1.5px solid #000', textAnchor: 'middle', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {settlementBills.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '10px' }}>No transactions recorded for this shift.</td>
                </tr>
              ) : (
                settlementBills.map((b) => (
                  <tr key={b._id}>
                    <td>{b.invoiceNo}</td>
                    <td>{formatDateTimeDisplay(b.billDate)}</td>
                    <td>{b.patientName}</td>
                    <td>{b.paymentMode || 'Cash'}</td>
                    <td style={{ textAlign: 'right' }}>₹{b.netTotal.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <div style={{ width: '40%', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
            Cashier Signature (Administrator)
          </div>
          <div style={{ width: '40%', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '6px' }}>
            Store Manager Audit Signature
          </div>
        </div>
      </div>
    </>
  );
}
