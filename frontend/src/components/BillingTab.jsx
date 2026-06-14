import React, { useState, useEffect } from "react";
import {
  usePharmacyStore,
  formatDateDisplay,
  showSimpleToast,
} from "../store/usePharmacyStore";

export default function BillingTab() {
  const {
    medicines,
    checkoutBill,
    isSavingMedicine,
    bills,
    billStats,
    isLoadingBills,
    fetchBills,
    fetchBillStats,
    saveBillRecord,
    deleteBillRecord
  } = usePharmacyStore();

  // Tab State
  const [billingSubTab, setBillingSubTab] = useState("new"); // "new" or "history"

  // Patient Information
  const [patientName, setPatientName] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [discountPercent, setDiscountPercent] = useState(5);

  // Bill Items state
  const [billItems, setBillItems] = useState([]);

  // Auto-generated Bill Info
  const [invoiceNo, setInvoiceNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [billTime, setBillTime] = useState("");

  // Active Item Search/Add state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMed, setSelectedMed] = useState(null);
  const [billQty, setBillQty] = useState(1);
  const [billRate, setBillRate] = useState("");

  // History filters & pagination state
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [selectedBill, setSelectedBill] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Generate random invoice number on mount
  useEffect(() => {
    const randNo = "AP/" + String(Math.floor(100000 + Math.random() * 900000));
    setInvoiceNo(randNo);

    const now = new Date();
    setBillDate(now.toISOString().slice(0, 10)); // YYYY-MM-DD
    setBillTime(
      now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, []);

  // Fetch bills list and stats when tab changes or filters update
  useEffect(() => {
    if (billingSubTab === "history") {
      fetchBills({
        page: historyPage,
        limit: 10,
        search: historySearch,
        month: filterMonth,
        year: filterYear
      });
      fetchBillStats();
    }
  }, [billingSubTab, historyPage, historySearch, filterMonth, filterYear, fetchBills, fetchBillStats]);

  // Filter active & in-stock medicines on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = medicines.filter(
      (m) =>
        m.status === "Active" &&
        m.quantity > 0 &&
        (m.name.toLowerCase().includes(query) ||
          m.batch.toLowerCase().includes(query)),
    );
    setSearchResults(filtered);
  }, [searchQuery, medicines]);

  // Handle medicine selection
  const handleSelectMedicine = (med) => {
    setSelectedMed(med);
    setBillRate(med.price);
    setBillQty(1);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Add selected item to the bill list
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!selectedMed) return;

    if (billQty <= 0) {
      showSimpleToast(
        "Invalid Quantity",
        "Quantity must be at least 1.",
        "danger",
      );
      return;
    }

    if (billQty > selectedMed.quantity) {
      showSimpleToast(
        "Stock Insufficient",
        `Only ${selectedMed.quantity} units of "${selectedMed.name}" are available in stock.`,
        "danger",
      );
      return;
    }

    // Check if item already added
    const existsIndex = billItems.findIndex(
      (item) =>
        item.medicine._id === selectedMed._id ||
        item.medicine.id === selectedMed.id,
    );
    if (existsIndex > -1) {
      showSimpleToast(
        "Already Added",
        "This medicine is already added to the bill. Edit or delete the existing row.",
        "warning",
      );
      return;
    }

    const itemAmount = billQty * parseFloat(billRate);

    setBillItems([
      ...billItems,
      {
        medicine: selectedMed,
        quantityBilled: parseInt(billQty),
        rateBilled: parseFloat(billRate),
        amount: itemAmount,
      },
    ]);

    // Reset search states
    setSelectedMed(null);
    setBillRate("");
    setBillQty(1);
    setSearchQuery("");
  };

  // Remove item from bill
  const handleRemoveItem = (index) => {
    const updated = [...billItems];
    updated.splice(index, 1);
    setBillItems(updated);
  };

  // Calculations
  const subTotal = billItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = subTotal * (discountPercent / 100);
  const netTotal = subTotal - discountAmount;

  // Calculate tax summaries (inclusive GST)
  let totalTaxableValue = 0;
  let totalCGST = 0;
  let totalSGST = 0;

  billItems.forEach((item) => {
    const itemDiscount = item.amount * (discountPercent / 100);
    const itemNet = item.amount - itemDiscount;
    const rate = item.medicine.gstRate || 5; // default 5%

    const taxable = itemNet / (1 + rate / 100);
    const cgst = taxable * (rate / 200);
    const sgst = taxable * (rate / 200);

    totalTaxableValue += taxable;
    totalCGST += cgst;
    totalSGST += sgst;
  });

  // Helper to reset bill form state after print/download
  const resetBillForm = () => {
    setBillItems([]);
    const randNo = "AP/" + String(Math.floor(100000 + Math.random() * 900000));
    setInvoiceNo(randNo);
    const now = new Date();
    setBillDate(now.toISOString().slice(0, 10));
    setBillTime(
      now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
    );

    // Clear patient states
    setPatientName("");
    setPatientAddress("");
  };

  // Helper to generate PDF using html2canvas and jspdf directly
  const generatePDFDownload = (isPastInvoice = false) => {
    const element = document.querySelector(".invoice-print-wrapper");
    if (!element) return;

    // Temporarily activate the screen layout overrides on the element for pdf capture
    element.classList.add("pdf-generation-in-progress");

    // Allow 150ms for browser layout and font rendering
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
              const imgWidth = 210; // A4 width in mm
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              // Dynamically adjust PDF page height to match content height (minimum A4 size 297mm)
              const pdf = new jsPDF("p", "mm", [210, Math.max(297, imgHeight)]);

              pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
              pdf.save(`Invoice-${activePrint.invoiceNo}.pdf`);

              // Cleanup and reset
              element.classList.remove("pdf-generation-in-progress");
              
              if (isPastInvoice) {
                setSelectedBill(null);
              } else {
                resetBillForm();
              }
              
              showSimpleToast(
                "Success",
                "Invoice downloaded successfully!",
                "success",
              );
            })
            .catch((err) => {
              console.error("Canvas capture failed:", err);
              element.classList.remove("pdf-generation-in-progress");
              showSimpleToast(
                "PDF Error",
                "Failed to capture invoice canvas.",
                "danger",
              );
            });
        })
        .catch((err) => {
          console.error("Failed to load libraries:", err);
          element.classList.remove("pdf-generation-in-progress");
          showSimpleToast(
            "Library Error",
            "Failed to load PDF libraries.",
            "danger",
          );
        });
    }, 150);
  };

  // Handle checkout and print/download
  const handleGenerateInvoice = async (mode = "print") => {
    if (billItems.length === 0) {
      showSimpleToast(
        "Empty Bill",
        "Please add at least one medicine to the bill.",
        "danger",
      );
      return;
    }

    // Call checkout action to deduct stock
    const success = await checkoutBill(billItems);
    if (success) {
      const invoiceData = {
        invoiceNo,
        patientName: patientName || 'CASH CUSTOMER',
        patientAddress,
        billDate: new Date(`${billDate}T${billTime}`),
        items: billItems.map(item => ({
          medicineId: item.medicine._id || item.medicine.id,
          name: item.medicine.name,
          category: item.medicine.category,
          batch: item.medicine.batch,
          quantity: item.quantityBilled,
          price: item.rateBilled,
          ptr: item.medicine.ptr || 0,
          gstRate: item.medicine.gstRate || 5,
          amount: item.amount
        })),
        subTotal,
        discountPercent,
        discountAmount,
        taxableValue: totalTaxableValue,
        cgst: totalCGST,
        sgst: totalSGST,
        netTotal
      };

      const dbRes = await saveBillRecord(invoiceData);
      if (dbRes.success) {
        if (mode === "print") {
          // Trigger browser print
          setTimeout(() => {
            window.print();
            resetBillForm();
          }, 300);
        } else if (mode === "download") {
          // Trigger download
          generatePDFDownload();
        }
      }
    }
  };

  // Helper to normalize items for details display/receipt rendering
  const getNormalizedItems = (invoice) => {
    if (!invoice) return [];
    
    // Check if it is a saved DB invoice (flat schema) or draft billItems array
    return invoice.items ? invoice.items.map(item => ({
      name: item.name,
      pack: item.pack || '1*10',
      hsn: item.hsn || 'N/A',
      batch: item.batch,
      expiryDate: item.expiryDate || '',
      quantity: item.quantity,
      price: item.price,
      gstRate: item.gstRate || 5,
      amount: item.amount
    })) : invoice.billItems.map(item => ({
      name: item.medicine.name,
      pack: item.medicine.pack || '1*10',
      hsn: item.medicine.hsn || 'N/A',
      batch: item.medicine.batch,
      expiryDate: item.medicine.expiryDate || '',
      quantity: item.quantityBilled,
      price: item.rateBilled,
      gstRate: item.medicine.gstRate || 5,
      amount: item.amount
    }));
  };

  // Unified Print Receipt Object
  const activePrint = selectedBill ? {
    invoiceNo: selectedBill.invoiceNo,
    patientName: selectedBill.patientName,
    patientAddress: selectedBill.patientAddress,
    billDate: new Date(selectedBill.billDate).toISOString().slice(0, 10),
    billTime: new Date(selectedBill.billDate).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    items: getNormalizedItems({ items: selectedBill.items }),
    subTotal: selectedBill.subTotal,
    discountPercent: selectedBill.discountPercent,
    discountAmount: selectedBill.discountAmount,
    taxableValue: selectedBill.taxableValue,
    cgst: selectedBill.cgst,
    sgst: selectedBill.sgst,
    netTotal: selectedBill.netTotal
  } : {
    invoiceNo,
    patientName: patientName || 'CASH CUSTOMER',
    patientAddress,
    billDate,
    billTime: billTime || '',
    items: getNormalizedItems({ billItems }),
    subTotal,
    discountPercent,
    discountAmount,
    taxableValue: totalTaxableValue,
    cgst: totalCGST,
    sgst: totalSGST,
    netTotal
  };

  // Handler to print historical bill
  const handlePrintPastInvoice = (bill) => {
    setSelectedBill(bill);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Handler to download historical bill PDF
  const handleDownloadPastInvoice = (bill) => {
    setSelectedBill(bill);
    setTimeout(() => {
      generatePDFDownload(true);
    }, 200);
  };

  // CSV Exporter for Past Invoices
  const handleDownloadCSV = () => {
    if (!bills || bills.length === 0) {
      showSimpleToast("No Data", "There are no bills to download.", "warning");
      return;
    }

    const headers = [
      "Invoice No",
      "Date",
      "Patient Name",
      "Patient Address",
      "Subtotal (Rs)",
      "Discount (%)",
      "Discount Amt (Rs)",
      "CGST (Rs)",
      "SGST (Rs)",
      "Grand Total (Rs)"
    ];

    const rows = bills.map(bill => [
      bill.invoiceNo,
      new Date(bill.billDate).toLocaleDateString('en-GB'),
      bill.patientName,
      bill.patientAddress || 'N/A',
      bill.subTotal.toFixed(2),
      bill.discountPercent,
      bill.discountAmount.toFixed(2),
      bill.cgst.toFixed(2),
      bill.sgst.toFixed(2),
      bill.netTotal.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Revenue_Report_${filterMonth ? 'Month_' + filterMonth : 'All'}_${filterYear || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSimpleToast("Export Success", "CSV report downloaded successfully!", "success");
  };

  return (
    <section id="tab-billing" className="tab-pane active">
      {/* Screen View */}
      <div className="no-print">
        <div className="page-header flex-header">
          <div>
            <h2>GST Billing &amp; Invoicing</h2>
            <p className="subtitle">
              Search medicines, compile invoices, check monthly revenue, and print receipts.
            </p>
          </div>
        </div>

        {/* Sub Tab Navigation */}
        <div className="sub-tabs-container">
          <button
            className={`sub-tab-btn ${billingSubTab === "new" ? "active" : ""}`}
            onClick={() => setBillingSubTab("new")}
          >
            <i className="fa-solid fa-calculator"></i> New Bill Calculator
          </button>
          <button
            className={`sub-tab-btn ${billingSubTab === "history" ? "active" : ""}`}
            onClick={() => {
              setBillingSubTab("history");
              setHistoryPage(1);
            }}
          >
            <i className="fa-solid fa-clock-rotate-left"></i> Billing History &amp; Revenue Reports
          </button>
        </div>

        {/* ── SUB-TAB: NEW CALCULATOR ────────────────────────────────────────── */}
        {billingSubTab === "new" && (
          <div className="details-grid">
            {/* Left Panel: Invoice metadata */}
            <div className="details-card card-panel">
              <h3 className="analytics-section-title">
                <i className="fa-solid fa-file-invoice"></i> Invoice Details
              </h3>
              <div className="modal-form" style={{ padding: 0 }}>
                <div className="form-grid" style={{ marginBottom: "16px" }}>
                  <div className="form-group">
                    <label>Invoice Number</label>
                    <input
                      type="text"
                      value={invoiceNo}
                      disabled
                      style={{ opacity: 0.7 }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Bill Issue Date &amp; Time</label>
                    <input
                      type="text"
                      value={`${billDate} ${billTime}`}
                      disabled
                      style={{ opacity: 0.7 }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Patient Name</label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Enter Patient Name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Patient Address</label>
                    <input
                      type="text"
                      value={patientAddress}
                      onChange={(e) => setPatientAddress(e.target.value)}
                      placeholder="Enter Address"
                    />
                  </div>
                </div>
              </div>

              <hr className="details-divider" />

              {/* Search & Add Items form */}
              <h3
                className="analytics-section-title"
                style={{ marginTop: "20px" }}
              >
                <i className="fa-solid fa-cart-plus"></i> Search &amp; Add Medicines
              </h3>
              <div
                className="form-group"
                style={{ position: "relative", marginBottom: "16px" }}
              >
                <label>Search Medicine (Name / Batch)</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search medicine..."
                />
                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <ul className="billing-search-results">
                    {searchResults.map((med) => (
                      <li
                        key={med._id || med.id}
                        onClick={() => handleSelectMedicine(med)}
                      >
                        <div style={{ fontWeight: "600" }}>{med.name}</div>
                        <div
                          style={{ fontSize: "11px", color: "var(--text-muted)" }}
                        >
                          Batch: {med.batch} | Exp:{" "}
                          {formatDateDisplay(med.expiryDate)} | Price: ₹
                          {med.price.toFixed(2)} | Avail: {med.quantity}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedMed && (
                <form
                  onSubmit={handleAddItem}
                  className="modal-form"
                  style={{ padding: 0 }}
                >
                  <div className="billing-selected-item-info">
                    <strong>Selected:</strong> {selectedMed.name}{" "}
                    <span className="category-label">{selectedMed.category}</span>
                    <div
                      className="timeline-desc-text"
                      style={{ marginTop: "4px" }}
                    >
                      Batch: {selectedMed.batch} | Expiry:{" "}
                      {formatDateDisplay(selectedMed.expiryDate)} | Available
                      Stock: {selectedMed.quantity} units
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginTop: "12px" }}>
                    <div className="form-group">
                      <label>Billing Qty (Units)</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedMed.quantity}
                        required
                        value={billQty}
                        onChange={(e) => setBillQty(parseInt(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Unit Rate / MRP (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={billRate}
                        onChange={(e) => setBillRate(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    style={{ marginTop: "12px" }}
                  >
                    <i className="fa-solid fa-plus"></i> Add Item to Bill
                  </button>
                </form>
              )}
            </div>

            {/* Right Panel: Bill Summary & Actions */}
            <div className="details-analytics">
              <div className="details-card card-panel">
                <h3 className="analytics-section-title">
                  <i className="fa-solid fa-receipt"></i> Current Invoice Items
                </h3>
                <div
                  className="table-container"
                  style={{ maxHeight: "300px", overflowY: "auto", overflowX: "auto" }}
                >
                  <table className="data-table" style={{ minWidth: "650px" }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Batch</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Amount</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan="6"
                            style={{
                              textAlign: "center",
                              color: "var(--text-muted)",
                            }}
                          >
                            No items added yet.
                          </td>
                        </tr>
                      ) : (
                        billItems.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>{item.medicine.name}</strong>
                            </td>
                            <td>
                              <code>{item.medicine.batch}</code>
                            </td>
                            <td>{item.quantityBilled}</td>
                            <td>₹{item.rateBilled.toFixed(2)}</td>
                            <td>₹{item.amount.toFixed(2)}</td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn-icon-only delete"
                                title="Remove Item"
                                onClick={() => handleRemoveItem(idx)}
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill calculations summary card */}
              <div className="details-card card-panel">
                <h3 className="analytics-section-title">
                  <i className="fa-solid fa-chart-simple"></i> Bill Calculation
                </h3>

                <div className="valuation-stats-list">
                  <div className="val-stat-item">
                    <span className="val-stat-label">Subtotal</span>
                    <span className="val-stat-value">₹{subTotal.toFixed(2)}</span>
                  </div>
                  <div className="val-stat-item" style={{ alignItems: "center" }}>
                    <span className="val-stat-label">Discount (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercent}
                      onChange={(e) =>
                        setDiscountPercent(parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: "80px",
                        padding: "4px 8px",
                        background: "var(--bg-input)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        textAlign: "right",
                      }}
                    />
                  </div>
                  <div className="val-stat-item">
                    <span className="val-stat-label">Discount Amount</span>
                    <span className="val-stat-value">
                      ₹{discountAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="val-stat-item">
                    <span className="val-stat-label">
                      Calculated Taxable Value
                    </span>
                    <span className="val-stat-value">
                      ₹{totalTaxableValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="val-stat-item">
                    <span className="val-stat-label">CGST (Tax breakdown)</span>
                    <span className="val-stat-value">
                      ₹{totalCGST.toFixed(2)}
                    </span>
                  </div>
                  <div className="val-stat-item">
                    <span className="val-stat-label">SGST (Tax breakdown)</span>
                    <span className="val-stat-value">
                      ₹{totalSGST.toFixed(2)}
                    </span>
                  </div>
                  <div className="val-stat-item total-profit-item">
                    <span className="val-stat-label">Grand Total (Net)</span>
                    <span className="val-stat-value text-primary-color font-large">
                      ₹{netTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div
                  className="billing-actions-group"
                  style={{ display: "flex", gap: "12px", marginTop: "20px" }}
                >
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "12px", flex: 1 }}
                    disabled={billItems.length === 0 || isSavingMedicine}
                    onClick={() => handleGenerateInvoice("print")}
                  >
                    {isSavingMedicine ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Saving...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-print"></i> Print Bill
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "12px", flex: 1 }}
                    disabled={billItems.length === 0 || isSavingMedicine}
                    onClick={() => handleGenerateInvoice("download")}
                  >
                    {isSavingMedicine ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Saving...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-file-pdf"></i> Download PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-TAB: LOGS & REVENUE HISTORY ────────────────────────────────── */}
        {billingSubTab === "history" && (
          <div className="billing-history-container">
            {/* Revenue Analytics Cards */}
            <div className="stats-grid" style={{ marginBottom: "24px" }}>
              <div className="stat-card border-success">
                <div className="stat-icon bg-success"><i className="fa-solid fa-indian-rupee-sign"></i></div>
                <div className="stat-info">
                  <span className="stat-label">Lifetime Revenue</span>
                  <h3 className="stat-value">₹{(billStats?.lifetimeRevenue || 0).toFixed(2)}</h3>
                </div>
              </div>
              <div className="stat-card border-success">
                <div className="stat-icon bg-primary"><i className="fa-solid fa-chart-line"></i></div>
                <div className="stat-info">
                  <span className="stat-label">Current Month Revenue</span>
                  <h3 className="stat-value">₹{(billStats?.currentMonthRevenue || 0).toFixed(2)}</h3>
                </div>
              </div>
              <div className="stat-card border-warning">
                <div className="stat-icon bg-warning text-dark"><i className="fa-solid fa-file-invoice-dollar"></i></div>
                <div className="stat-info">
                  <span className="stat-label">Total Bills Generated</span>
                  <h3 className="stat-value">{billStats?.lifetimeBills || 0}</h3>
                </div>
              </div>
            </div>

            {/* Split Dashboard */}
            <div className="dashboard-split" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "24px" }}>
              {/* Left Column: Bills Log */}
              <div className="split-left card-panel">
                <div className="panel-header flex-header" style={{ borderBottom: "none", marginBottom: "16px", paddingBottom: 0 }}>
                  <div className="panel-title-group">
                    <i className="fa-solid fa-receipt panel-icon text-primary-color" style={{ color: "var(--primary)" }}></i>
                    <h3>Past Invoices</h3>
                  </div>
                  <button className="btn btn-secondary btn-icon" onClick={handleDownloadCSV}>
                    <i className="fa-solid fa-file-csv"></i> Download CSV
                  </button>
                </div>

                {/* Filter Toolbar */}
                <div className="filter-toolbar card-panel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", background: "var(--bg-card-hover)", padding: "16px", marginBottom: "20px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", marginBottom: "4px", fontWeight: "600" }}>Search Invoice / Patient</label>
                    <input 
                      type="text" 
                      value={historySearch} 
                      onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }} 
                      placeholder="Type query..." 
                      style={{ padding: "8px 12px", fontSize: "13px" }}
                    />
                  </div>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", marginBottom: "4px", fontWeight: "600" }}>Month</label>
                    <select 
                      value={filterMonth} 
                      onChange={(e) => { setFilterMonth(e.target.value); setHistoryPage(1); }}
                      style={{ padding: "8px 12px", fontSize: "13px", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "6px" }}
                    >
                      <option value="">All Months</option>
                      <option value="1">January</option>
                      <option value="2">February</option>
                      <option value="3">March</option>
                      <option value="4">April</option>
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                      <option value="8">August</option>
                      <option value="9">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", marginBottom: "4px", fontWeight: "600" }}>Year</label>
                    <select 
                      value={filterYear} 
                      onChange={(e) => { setFilterYear(e.target.value); setHistoryPage(1); }}
                      style={{ padding: "8px 12px", fontSize: "13px", background: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "6px" }}
                    >
                      <option value="">All Years</option>
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                    </select>
                  </div>
                </div>

                {/* Log Table */}
                <div className="table-container" style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Invoice No</th>
                        <th>Patient Name</th>
                        <th>Items</th>
                        <th>Net Total</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingBills ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 6 }).map((_, j) => (
                              <td key={j}>
                                <span style={{ display: 'inline-block', width: '80%', height: 14, background: 'var(--bg-input)', borderRadius: 4, animation: 'pulse 1.5s infinite' }}></span>
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : !bills || bills.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                            No invoices matched criteria.
                          </td>
                        </tr>
                      ) : (
                        bills.map(bill => (
                          <tr key={bill._id || bill.id}>
                            <td>{new Date(bill.billDate).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                            <td><code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{bill.invoiceNo}</code></td>
                            <td><strong>{bill.patientName}</strong></td>
                            <td>{bill.items?.length || 0} meds</td>
                            <td><strong>₹{bill.netTotal.toFixed(2)}</strong></td>
                            <td className="text-right">
                              <div className="action-btn-group">
                                <button className="btn-icon-only view" title="View Details" onClick={() => { setSelectedBill(bill); setIsDetailsOpen(true); }}>
                                  <i className="fa-solid fa-eye"></i>
                                </button>
                                <button className="btn-icon-only view" style={{ color: "var(--primary)", marginLeft: "4px" }} title="Download Invoice" onClick={() => handleDownloadPastInvoice(bill)}>
                                  <i className="fa-solid fa-file-pdf"></i>
                                </button>
                                <button className="btn-icon-only edit" style={{ color: "var(--success)", marginLeft: "4px" }} title="Print Receipt" onClick={() => handlePrintPastInvoice(bill)}>
                                  <i className="fa-solid fa-print"></i>
                                </button>
                                <button className="btn-icon-only delete" style={{ marginLeft: "4px" }} title="Delete Invoice" onClick={() => { if (confirm("Are you sure you want to delete this invoice?")) deleteBillRecord(bill._id || bill.id); }}>
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {bills && bills.length > 0 && (
                  <div className="pagination-bar" style={{ marginTop: "16px" }}>
                    <span className="pagination-info">
                      Page {historyPage}
                    </span>
                    <div className="pagination-controls">
                      <button className="pagination-btn" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}>
                        <i className="fa-solid fa-chevron-left"></i> Prev
                      </button>
                      <button className="pagination-btn" onClick={() => setHistoryPage(p => p + 1)} disabled={bills.length < 10}>
                        Next <i className="fa-solid fa-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Month-wise Revenue Summary */}
              <div className="split-right card-panel">
                <div className="panel-header" style={{ borderBottom: "none", marginBottom: "12px", paddingBottom: 0 }}>
                  <div className="panel-title-group">
                    <i className="fa-solid fa-calendar-days panel-icon text-primary-color" style={{ color: "var(--primary)" }}></i>
                    <h3>Month-wise Revenue</h3>
                  </div>
                </div>
                <p className="subtitle" style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>Monthly sales summaries and bill counts.</p>

                <div className="valuation-stats-list" style={{ maxHeight: "350px", overflowY: "auto" }}>
                  {!billStats?.monthlyBreakdown || billStats.monthlyBreakdown.length === 0 ? (
                    <div className="empty-state" style={{ padding: "10px" }}>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>No billing logs recorded yet.</p>
                    </div>
                  ) : (
                    billStats.monthlyBreakdown.map(item => (
                      <div key={item.label} className="val-stat-item" style={{ padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
                        <span className="val-stat-label" style={{ fontWeight: "600" }}>{item.label}</span>
                        <div style={{ textAlign: "right" }}>
                          <div className="val-stat-value text-primary-color" style={{ fontWeight: "700" }}>₹{item.revenue.toFixed(2)}</div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.count} bills</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BILL DETAILS MODAL ────────────────────────────────────────────── */}
      {isDetailsOpen && selectedBill && (
        <div className="modal-backdrop show" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-content card-panel" style={{ width: "90%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold" }}>Invoice Detail View</h3>
              <button 
                style={{ background: "none", border: "none", fontSize: "28px", cursor: "pointer", color: "var(--text-secondary)" }} 
                onClick={() => { setIsDetailsOpen(false); setSelectedBill(null); }}
              >
                &times;
              </button>
            </div>
            
            {/* Modal Body: Styled Invoice Receipt */}
            <div style={{ background: "#ffffff", color: "#000000", padding: "24px", borderRadius: "8px", border: "1px solid #cccccc", fontFamily: "monospace" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000000", paddingBottom: "12px", marginBottom: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#000000", margin: 0 }}>ANIKA PHARMACY</h2>
                  <p style={{ fontSize: "12px", margin: "2px 0", color: "#333333" }}>Pandeybaba bazar, Kadipur Road, Sultanpur, UP</p>
                  <p style={{ fontSize: "12px", margin: "2px 0", color: "#333333" }}>Phone : 9795358689, 6386470668</p>
                  <p style={{ fontSize: "12px", margin: "2px 0", color: "#333333" }}>D.L.No. : UP44200000460, UP44210000461</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#000000" }}>GST INVOICE</div>
                  <div style={{ fontSize: "11px", color: "#555555" }}>Invoice: {selectedBill.invoiceNo}</div>
                  <div style={{ fontSize: "11px", color: "#555555" }}>Date: {new Date(selectedBill.billDate).toLocaleString("en-GB")}</div>
                </div>
              </div>

              <div style={{ marginBottom: "12px", fontSize: "12px", color: "#000000" }}>
                <strong>Billed To:</strong> {selectedBill.patientName?.toUpperCase()}<br />
                {selectedBill.patientAddress && <><strong>Address:</strong> {selectedBill.patientAddress}</>}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "12px", color: "#000000" }}>
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
                      <td style={{ padding: "6px", color: "#000000" }}><strong>{item.name?.toUpperCase()}</strong></td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.batch}</td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.pack || "1*10"}</td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right", padding: "6px", color: "#000000" }}>₹{item.price?.toFixed(2)}</td>
                      <td style={{ textAlign: "center", padding: "6px", color: "#000000" }}>{item.gstRate || 5}%</td>
                      <td style={{ textAlign: "right", padding: "6px", color: "#000000" }}>₹{item.amount?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", paddingTop: "10px", borderTop: "1px solid #000000", color: "#000000" }}>
                <div>
                  <strong>Tax Breakdown:</strong><br />
                  Taxable Value: ₹{selectedBill.taxableValue?.toFixed(2)}<br />
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
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0", borderTop: "1px solid #000000", paddingTop: "4px", fontWeight: "bold" }}>
                    <span>Grand Total:</span>
                    <span>₹{selectedBill.netTotal?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button className="btn btn-secondary" onClick={() => { setIsDetailsOpen(false); setSelectedBill(null); }}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => handlePrintPastInvoice(selectedBill)}>
                <i className="fa-solid fa-print"></i> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT-ONLY RECEIPT LAYOUT ──────────────────────────────────────── */}
      <div className="print-only invoice-print-wrapper">
        <div className="print-header">
          <div className="print-header-left">
            <img
              src="/logo.png"
              alt="Anika Pharmacy Logo"
              className="print-logo"
            />
            <div className="print-brand-details">
              <h1 className="print-brand">ANIKA PHARMACY</h1>
              <p className="print-brand-address">Pandeybaba bazar, Kadipur Road</p>
              <p className="print-brand-address">Sultanpur, UP - 228145</p>
              <p className="print-brand-contact">Phone : 9795358689, 6386470668</p>
              <p className="print-brand-contact">E-Mail : vikaskr.verma27@gmail.com</p>
              <p className="print-brand-gstin">GST No. : N/A</p>
              <p className="print-brand-dl">D.L.No. : UP44200000460, UP44210000461</p>
            </div>
          </div>
          <div className="print-header-right">
            <div className="print-invoice-title">GST INVOICE</div>
            <div className="print-invoice-copy">Original for Buyer</div>
          </div>
        </div>

        <div className="print-meta-grid">
          <div className="meta-col">
            <div
              style={{
                fontSize: "9px",
                color: "#555",
                fontWeight: "bold",
                textTransform: "uppercase",
                marginBottom: "2px",
              }}
            >
              Billed To:
            </div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#000" }}>
              {activePrint.patientName ? activePrint.patientName.toUpperCase() : "CASH CUSTOMER"}
            </div>
            {activePrint.patientAddress && (
              <div style={{ fontSize: "11px", color: "#333", marginTop: "2px" }}>
                {activePrint.patientAddress}
              </div>
            )}
          </div>
          <div
            className="meta-col text-right"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div>
              <strong>Invoice No. :</strong>{" "}
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {activePrint.invoiceNo}
              </span>
            </div>
            <div>
              <strong>Date :</strong> {activePrint.billDate.split("-").reverse().join("-")}
            </div>
            <div>
              <strong>Bill Issue Time :</strong> {activePrint.billTime}
            </div>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: "3%" }}>SN</th>
              <th style={{ width: "30%" }}>PRODUCT NAME</th>
              <th style={{ width: "6%" }}>PACK</th>
              <th style={{ width: "8%" }}>HSN</th>
              <th style={{ width: "10%" }}>BATCH</th>
              <th style={{ width: "8%" }}>EXP</th>
              <th style={{ width: "5%" }}>QTY</th>
              <th style={{ width: "7%" }}>MRP</th>
              <th style={{ width: "7%" }}>RATE</th>
              <th style={{ width: "4%" }}>SGST</th>
              <th style={{ width: "4%" }}>CGST</th>
              <th style={{ width: "8%" }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {activePrint.items.map((item, idx) => {
              const rate = item.gstRate;
              const itemDiscount = item.amount * (activePrint.discountPercent / 100);
              const itemNet = item.amount - itemDiscount;
              const taxable = itemNet / (1 + rate / 100);
              const gstBreakdownPercent = rate / 2;

              return (
                <tr key={idx}>
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                  <td>
                    <strong>{item.name.toUpperCase()}</strong>
                  </td>
                  <td style={{ textAlign: "center" }}>{item.pack}</td>
                  <td style={{ textAlign: "center" }}>{item.hsn}</td>
                  <td style={{ textAlign: "center" }}>{item.batch}</td>
                  <td style={{ textAlign: "center" }}>
                    {item.expiryDate
                      ? new Date(item.expiryDate)
                          .toLocaleDateString("en-US", {
                            month: "2-digit",
                            year: "2-digit",
                          })
                          .replace("/", "/")
                      : ""}
                  </td>
                  <td style={{ textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>{item.price.toFixed(2)}</td>
                  <td style={{ textAlign: "right" }}>{item.price.toFixed(2)}</td>
                  <td style={{ textAlign: "center" }}>{gstBreakdownPercent.toFixed(2)}%</td>
                  <td style={{ textAlign: "center" }}>{gstBreakdownPercent.toFixed(2)}%</td>
                  <td style={{ textAlign: "right" }}>{item.amount.toFixed(2)}</td>
                </tr>
              );
            })}
            {/* Empty padding rows to match receipt size */}
            {Array.from({ length: Math.max(0, 10 - activePrint.items.length) }).map(
              (_, i) => (
                <tr key={i} className="empty-row">
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
              ),
            )}
          </tbody>
        </table>

        <div className="print-footer-grid">
          <div className="print-footer-left">
            <div className="tax-summary-clause">
              GST {activePrint.taxableValue.toFixed(2)} * {activePrint.discountPercent.toFixed(0)}%
              = {activePrint.discountAmount.toFixed(2)} Discount
            </div>
            <div
              className="tax-summary-clause"
              style={{ marginTop: "4px", textTransform: "uppercase" }}
            >
              GST INCLUSIVE BREAKDOWN: Taxable Value: ₹
              {activePrint.taxableValue.toFixed(2)} | SGST: ₹{activePrint.sgst.toFixed(2)} |
              CGST: ₹{activePrint.cgst.toFixed(2)}
            </div>
            <div className="print-tc">
              <h4>Terms &amp; Conditions</h4>
              <p>Goods once sold will not be taken back or exchanged.</p>
              <p className="print-salutation">** GET WELL SOON **</p>
            </div>
          </div>

          <div className="print-footer-right">
            <div className="summary-row">
              <span>SUB TOTAL</span>
              <span>{activePrint.subTotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Discount {activePrint.discountPercent}%</span>
              <span>{activePrint.discountAmount.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>SGST</span>
              <span>{activePrint.sgst.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>CGST</span>
              <span>{activePrint.cgst.toFixed(2)}</span>
            </div>
            <div className="summary-row grand-total">
              <span>GRAND TOTAL</span>
              <span>₹{activePrint.netTotal.toFixed(2)}</span>
            </div>
            <div className="signature-box">
              <div className="signature-line">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
