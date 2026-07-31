import React, { useState, useEffect } from "react";
import {
  usePharmacyStore,
  formatDateDisplay,
  formatDateTimeDisplay,
  showSimpleToast,
} from "../store/usePharmacyStore";
import { billApi, medicineApi, customerApi } from "../api/apiClient";
import SubstituteFinderModal from "./SubstituteFinderModal";

export default function NewBillCalculator() {
  const {
    medicines,
    checkoutBill,
    isSavingMedicine,
    saveBillRecord,
    fetchMedicines,
  } = usePharmacyStore();

  // Patient Information
  const [patientName, setPatientName] = useState("");
  const [isSubstituteModalOpen, setIsSubstituteModalOpen] = useState(false);
  const [substituteInitialQuery, setSubstituteInitialQuery] = useState("");
  const [patientMobile, setPatientMobile] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [discountPercent, setDiscountPercent] = useState(5);

  // Patient History States
  const [patientHistoryModalOpen, setPatientHistoryModalOpen] = useState(false);
  const [patientHistoryBills, setPatientHistoryBills] = useState([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [autoHistoryFound, setAutoHistoryFound] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState(null);

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

  // Smart Substitute states
  const [substituteQuery, setSubstituteQuery] = useState("");
  const [substituteResults, setSubstituteResults] = useState([]);
  const [isSearchingSubstitutes, setIsSearchingSubstitutes] = useState(false);

  // Generate random invoice number and set date/time on mount
  useEffect(() => {
    // Also refresh medicines to make sure stock is fresh
    fetchMedicines();

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
  }, [fetchMedicines]);

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

  // Auto-lookup customer + purchase history when mobile reaches 10 digits
  useEffect(() => {
    const fetchPatientHistory = async () => {
      const trimmedMobile = patientMobile.trim();
      if (trimmedMobile.length === 10) {
        setIsFetchingHistory(true);
        try {
          const [{ data: lookup }, { data: billsData }] = await Promise.all([
            customerApi.lookupByMobile(trimmedMobile),
            billApi.getAll({ search: trimmedMobile, limit: 50 }),
          ]);

          if (lookup?.success && lookup.found && lookup.customer) {
            const c = lookup.customer;
            setMatchedCustomer(c);
            setPatientName((prev) =>
              !prev || prev === "CASH CUSTOMER" ? c.name || prev : prev,
            );
            setPatientAddress((prev) => prev || c.address || "");
            setDoctorName((prev) => prev || c.preferredDoctor || "");
          } else {
            setMatchedCustomer(null);
          }

          if (billsData?.success) {
            const filteredBills = billsData.bills || [];
            setPatientHistoryBills(filteredBills);
            setAutoHistoryFound(filteredBills.length > 0);
          }
        } catch (err) {
          console.error("Failed to fetch patient history:", err);
          setMatchedCustomer(null);
        } finally {
          setIsFetchingHistory(false);
        }
      } else {
        setAutoHistoryFound(false);
        setPatientHistoryBills([]);
        setMatchedCustomer(null);
      }
    };
    fetchPatientHistory();
  }, [patientMobile]);

  // Handle medicine selection
  const handleSelectMedicine = (med) => {
    setSelectedMed(med);
    setBillRate(med.price);
    setBillQty(1);
    setSearchQuery("");
    setSearchResults([]);
  };

  // Handle Smart Substitute search
  const handleFindSubstitutes = async (e) => {
    if (e) e.preventDefault();
    if (!substituteQuery.trim()) {
      setSubstituteResults([]);
      return;
    }
    setIsSearchingSubstitutes(true);
    try {
      const { data } = await medicineApi.getAll({
        composition: substituteQuery.trim(),
        status: "Active",
        limit: 20,
      });
      if (data.success) {
        const inStockSubstitutes = (data.medicines || []).filter(
          (m) => m.status === "Active" && m.quantity > 0,
        );
        setSubstituteResults(inStockSubstitutes);
        if (inStockSubstitutes.length === 0) {
          showSimpleToast(
            "No Substitutes",
            "No active in-stock substitutes found for this salt composition.",
            "warning",
          );
        }
      }
    } catch (err) {
      console.error("Error fetching substitutes:", err);
      showSimpleToast("Error", "Failed to search for substitutes.", "danger");
    } finally {
      setIsSearchingSubstitutes(false);
    }
  };

  // Handle Repeat Bill loading
  const handleRepeatBill = (pastBill) => {
    if (!pastBill || !pastBill.items || pastBill.items.length === 0) return;

    if (billItems.length > 0) {
      if (
        !window.confirm(
          "This will overwrite your current billing calculator draft. Do you want to continue?",
        )
      ) {
        return;
      }
    }

    const repeatedItems = [];
    const missingMeds = [];
    const stockShortages = [];

    pastBill.items.forEach((pastItem) => {
      const currentMed = medicines.find(
        (m) =>
          (m._id && m._id === pastItem.medicineId) ||
          (m.id && m.id === pastItem.medicineId) ||
          (m.name === pastItem.name && m.batch === pastItem.batch),
      );

      if (
        !currentMed ||
        currentMed.status !== "Active" ||
        currentMed.quantity === 0
      ) {
        missingMeds.push(pastItem.name);
      } else {
        const qtyToBill = Math.min(pastItem.quantity, currentMed.quantity);
        if (qtyToBill < pastItem.quantity) {
          stockShortages.push(
            `${pastItem.name} (Billed ${qtyToBill}/${pastItem.quantity} due to stock limits)`,
          );
        }

        repeatedItems.push({
          medicine: currentMed,
          quantityBilled: qtyToBill,
          rateBilled: currentMed.price,
          amount: qtyToBill * currentMed.price,
        });
      }
    });

    if (repeatedItems.length > 0) {
      setBillItems(repeatedItems);
      setPatientHistoryModalOpen(false);

      if (!patientName || patientName === "CASH CUSTOMER")
        setPatientName(pastBill.patientName);
      if (!patientAddress) setPatientAddress(pastBill.patientAddress || "");

      showSimpleToast(
        "Repeat Bill Loaded",
        `Successfully loaded ${repeatedItems.length} items from past invoice.`,
        "success",
      );

      if (missingMeds.length > 0 || stockShortages.length > 0) {
        const warnings = [];
        if (missingMeds.length > 0) {
          warnings.push(`Unavailable: ${missingMeds.join(", ")}`);
        }
        if (stockShortages.length > 0) {
          warnings.push(`Stock limited: ${stockShortages.join(", ")}`);
        }
        showSimpleToast("Stock Warning", warnings.join(" | "), "warning");
      }
    } else {
      showSimpleToast(
        "Cannot Repeat Bill",
        "All medications from this past bill are currently out of stock or inactive.",
        "danger",
      );
    }
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
    const rate = item.medicine.gstRate || 5;

    const taxable = itemNet / (1 + rate / 100);
    const cgst = taxable * (rate / 200);
    const sgst = taxable * (rate / 200);

    totalTaxableValue += taxable;
    totalCGST += cgst;
    totalSGST += sgst;
  });

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

    setPatientName("");
    setPatientMobile("");
    setPatientAddress("");
    setDoctorName("");
    setPaymentMode("Cash");
    setAutoHistoryFound(false);
  };

  const handleGenerateInvoice = async (mode = "print") => {
    if (billItems.length === 0) {
      showSimpleToast(
        "Empty Bill",
        "Please add at least one medicine to the bill.",
        "danger",
      );
      return;
    }

    const success = await checkoutBill(billItems);
    if (success) {
      const invoiceData = {
        invoiceNo,
        patientName: patientName || "CASH CUSTOMER",
        patientMobile: patientMobile || "",
        patientAddress,
        doctorName,
        paymentMode,
        billDate: new Date(`${billDate}T${billTime}`),
        items: billItems.map((item) => ({
          medicineId: item.medicine._id || item.medicine.id,
          name: item.medicine.name,
          category: item.medicine.category,
          batch: item.medicine.batch,
          quantity: item.quantityBilled,
          price: item.rateBilled,
          ptr: item.medicine.ptr || 0,
          gstRate: item.medicine.gstRate || 5,
          amount: item.amount,
        })),
        subTotal,
        discountPercent,
        discountAmount,
        taxableValue: totalTaxableValue,
        cgst: totalCGST,
        sgst: totalSGST,
        netTotal,
      };

      const dbRes = await saveBillRecord(invoiceData);
      if (dbRes.success) {
        if (mode === "print") {
          setTimeout(() => {
            window.print();
            resetBillForm();
          }, 300);
        } else if (mode === "download") {
          generatePDFDownload();
        }
      }
    }
  };

  const generatePDFDownload = () => {
    const element = document.querySelector(".invoice-print-wrapper");
    if (!element) return;

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
              pdf.save(`Invoice-${invoiceNo}.pdf`);

              element.classList.remove("pdf-generation-in-progress");
              resetBillForm();
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

  const getNormalizedItems = () => {
    return billItems.map((item) => ({
      name: item.medicine.name,
      pack: item.medicine.pack || "1*10",
      hsn: item.medicine.hsn || "N/A",
      batch: item.medicine.batch,
      expiryDate: item.medicine.expiryDate || "",
      quantity: item.quantityBilled,
      price: item.rateBilled,
      gstRate: item.medicine.gstRate || 5,
      amount: item.amount,
    }));
  };

  const activePrint = {
    invoiceNo,
    patientName: patientName || "CASH CUSTOMER",
    patientAddress,
    doctorName,
    billDate,
    billTime: billTime || "",
    items: getNormalizedItems(),
    subTotal,
    discountPercent,
    discountAmount,
    taxableValue: totalTaxableValue,
    cgst: totalCGST,
    sgst: totalSGST,
    netTotal,
  };

  return (
    <>
      <div className="details-grid">
        {/* Left Panel: Invoice metadata */}
        <div className="details-card card-panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3 className="analytics-section-title" style={{ margin: 0 }}>
              <i className="fa-solid fa-file-invoice"></i> Invoice Details
            </h3>
            <button
              type="button"
              className="btn btn-outline btn-small"
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
              }}
              onClick={async () => {
                setIsFetchingHistory(true);
                setPatientHistoryModalOpen(true);
                try {
                  const { data } = await billApi.getAll({
                    search: patientMobile || patientName || "",
                    limit: 50,
                  });
                  if (data.success) {
                    setPatientHistoryBills(data.bills || []);
                  }
                } catch (err) {
                  console.error("Failed to query patient history:", err);
                } finally {
                  setIsFetchingHistory(false);
                }
              }}
            >
              <i className="fa-solid fa-history"></i>
              Patient History
            </button>
          </div>

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
                <label>Doctor Name (Dr. Name)</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Enter Doctor's Name"
                />
              </div>
              <div className="form-group" style={{ position: "relative" }}>
                <label>Patient Mobile Number</label>
                <input
                  type="text"
                  value={patientMobile}
                  onChange={(e) =>
                    setPatientMobile(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Enter 10-digit Mobile"
                  maxLength="10"
                />
                {matchedCustomer && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--success)",
                      marginTop: "4px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600",
                    }}
                  >
                    <i className="fa-solid fa-user-check"></i>
                    Customer matched: {matchedCustomer.name}
                    {matchedCustomer.totalPurchases
                      ? ` · ${matchedCustomer.totalPurchases} visits`
                      : ""}
                  </span>
                )}
                {autoHistoryFound && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--primary)",
                      marginTop: "4px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600",
                    }}
                    onClick={() => setPatientHistoryModalOpen(true)}
                    title="Click to view purchase logs"
                  >
                    <i className="fa-solid fa-circle-info"></i>
                    {patientHistoryBills.length} past purchases found. View
                    History
                  </span>
                )}
                {isFetchingHistory && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginTop: "4px",
                    }}
                  >
                    <i className="fa-solid fa-spinner fa-spin"></i> Looking up
                    customer…
                  </span>
                )}
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
              <div className="form-group">
                <label>Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  style={{
                    backgroundColor: "var(--bg-input)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    width: "100%",
                    cursor: "pointer",
                  }}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="details-divider" />

          {/* Search & Add Items form */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            <h3 className="analytics-section-title" style={{ margin: 0 }}>
              <i className="fa-solid fa-cart-plus"></i> Search &amp; Add
              Medicines
            </h3>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSubstituteInitialQuery(searchQuery || "");
                setIsSubstituteModalOpen(true);
              }}
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                borderColor: "rgba(16, 185, 129, 0.3)",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <i
                className="fa-solid fa-flask"
                style={{ marginRight: "4px" }}
              ></i>{" "}
              🧪 Find Salt Substitute
            </button>
          </div>
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
                  {formatDateDisplay(selectedMed.expiryDate)} | Available Stock:{" "}
                  {selectedMed.quantity} units
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

          <hr className="details-divider" />

          {/* Smart Substitute Finder */}
          <h3 className="analytics-section-title" style={{ marginTop: "20px" }}>
            <i
              className="fa-solid fa-wand-magic-sparkles text-primary-color"
              style={{ color: "var(--primary)" }}
            ></i>{" "}
            Smart Substitute Finder
          </h3>
          <p
            className="subtitle"
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginBottom: "12px",
            }}
          >
            Find equivalent in-stock medicines by chemical composition (salt)
            when a drug is out of stock.
          </p>

          <div
            className="form-group"
            style={{ position: "relative", marginBottom: "16px" }}
          >
            <label>Search by Salt / Composition</label>
            <form
              onSubmit={handleFindSubstitutes}
              style={{
                position: "flex",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={substituteQuery}
                onChange={(e) => setSubstituteQuery(e.target.value)}
                placeholder="Enter composition salt (e.g., Paracetamol)..."
                style={{ paddingRight: substituteQuery ? "65px" : "35px" }}
              />
              {substituteQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSubstituteQuery("");
                    setSubstituteResults([]);
                  }}
                  style={{
                    position: "absolute",
                    right: "35px",
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "16px",
                    padding: "4px",
                    zIndex: 5,
                  }}
                  title="Clear search"
                >
                  &times;
                </button>
              )}
              <button
                type="submit"
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  cursor: "pointer",
                  padding: "6px",
                  zIndex: 5,
                  display: "flex",
                  alignItems: "center",
                }}
                disabled={isSearchingSubstitutes}
                title="Search equivalents"
              >
                {isSearchingSubstitutes ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-magnifying-glass"></i>
                )}
              </button>
            </form>
          </div>

          {substituteResults.length > 0 && (
            <div
              className="perf-list"
              style={{
                maxHeight: "250px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {substituteResults.map((med) => (
                <div
                  key={med._id || med.id}
                  className="perf-item"
                  style={{ cursor: "pointer", marginBottom: "8px" }}
                  onClick={() => handleSelectMedicine(med)}
                  title={`Click to select ${med.name} for billing`}
                >
                  <div className="perf-details">
                    <div
                      className="perf-name"
                      style={{
                        fontWeight: "600",
                        color: "var(--text-primary)",
                      }}
                    >
                      {med.name}
                    </div>
                    <div
                      className="perf-category"
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginTop: "2px",
                      }}
                    >
                      Salt: {med.composition} | Batch: {med.batch}
                    </div>
                  </div>
                  <div className="perf-stats" style={{ textAlign: "right" }}>
                    <div
                      className="perf-value"
                      style={{
                        fontWeight: "600",
                        color: "var(--text-primary)",
                      }}
                    >
                      ₹{med.price.toFixed(2)}
                    </div>
                    <div
                      className="perf-subtext"
                      style={{
                        fontSize: "11px",
                        color: "#10b981",
                        fontWeight: "600",
                        marginTop: "2px",
                      }}
                    >
                      {med.quantity} in stock
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                overflowX: "auto",
              }}
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
                <span className="val-stat-label">Calculated Taxable Value</span>
                <span className="val-stat-value">
                  ₹{totalTaxableValue.toFixed(2)}
                </span>
              </div>
              <div className="val-stat-item">
                <span className="val-stat-label">CGST (Tax breakdown)</span>
                <span className="val-stat-value">₹{totalCGST.toFixed(2)}</span>
              </div>
              <div className="val-stat-item">
                <span className="val-stat-label">SGST (Tax breakdown)</span>
                <span className="val-stat-value">₹{totalSGST.toFixed(2)}</span>
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

      {/* ── PATIENT HISTORY LOOKUP MODAL ── */}
      {patientHistoryModalOpen && (
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
            className="modal-card"
            style={{ width: "90%", maxWidth: "700px", maxHeight: "85vh" }}
          >
            <div className="modal-header">
              <h3>Patient Purchase History</h3>
              <button
                className="modal-close-btn"
                onClick={() => setPatientHistoryModalOpen(false)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <div
              className="modal-form"
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div className="form-group" style={{ marginBottom: "10px" }}>
                <label>Lookup Phone Number / Patient Name</label>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <i
                    className="fa-solid fa-magnifying-glass"
                    style={{
                      position: "absolute",
                      left: "12px",
                      color: "var(--text-muted)",
                      zIndex: 1,
                    }}
                  ></i>
                  <input
                    type="text"
                    placeholder="Enter patient name or phone number..."
                    value={patientMobile}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setPatientMobile(val);
                      if (val.trim()) {
                        setIsFetchingHistory(true);
                        try {
                          const { data } = await billApi.getAll({
                            search: val.trim(),
                            limit: 50,
                          });
                          if (data.success) {
                            setPatientHistoryBills(data.bills || []);
                          }
                        } catch (err) {
                          console.error("Search history failed:", err);
                        } finally {
                          setIsFetchingHistory(false);
                        }
                      }
                    }}
                    style={{ paddingLeft: "36px" }}
                  />
                </div>
              </div>

              {isFetchingHistory ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <i
                    className="fa-solid fa-spinner fa-spin"
                    style={{ fontSize: "28px", color: "var(--primary)" }}
                  ></i>
                  <p
                    style={{
                      marginTop: "12px",
                      color: "var(--text-muted)",
                      fontSize: "13px",
                    }}
                  >
                    Retrieving past purchase logs...
                  </p>
                </div>
              ) : patientHistoryBills.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "var(--text-muted)",
                  }}
                >
                  <i
                    className="fa-solid fa-folder-open"
                    style={{
                      fontSize: "36px",
                      opacity: 0.5,
                      marginBottom: "12px",
                    }}
                  ></i>
                  <p style={{ fontSize: "13px" }}>
                    No purchase logs found for this query.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    overflowY: "auto",
                    maxHeight: "400px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {patientHistoryBills.map((bill) => (
                    <div
                      key={bill._id || bill.id}
                      style={{
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "10px",
                        padding: "16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "10px",
                        }}
                      >
                        <div>
                          <strong
                            style={{
                              fontSize: "14px",
                              color: "var(--text-primary)",
                            }}
                          >
                            Invoice: {bill.invoiceNo}
                          </strong>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              marginTop: "2px",
                            }}
                          >
                            Patient: {bill.patientName} | Mobile:{" "}
                            {bill.patientMobile || "N/A"}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              marginTop: "2px",
                            }}
                          >
                            Date: {formatDateTimeDisplay(bill.billDate)} | Mode:{" "}
                            {bill.paymentMode}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontWeight: "700",
                              fontSize: "14px",
                              color: "var(--primary)",
                            }}
                          >
                            ₹{bill.netTotal.toFixed(2)}
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              marginTop: "6px",
                              padding: "4px 10px",
                              fontSize: "11px",
                              height: "26px",
                              cursor: "pointer",
                            }}
                            onClick={() => handleRepeatBill(bill)}
                          >
                            <i className="fa-solid fa-copy"></i> Repeat Bill
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          borderTop: "1px dashed var(--border-color)",
                          paddingTop: "8px",
                          marginTop: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                          }}
                        >
                          Items Purchased:
                        </span>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: "6px 20px",
                            marginTop: "6px",
                          }}
                        >
                          {bill.items.map((item, idx) => (
                            <React.Fragment key={idx}>
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {item.name}{" "}
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: "10px",
                                  }}
                                >
                                  (Batch: {item.batch})
                                </span>
                              </span>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  color: "var(--text-primary)",
                                }}
                              >
                                {item.quantity} x ₹{item.price.toFixed(2)}
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="modal-footer"
              style={{
                borderTop: "1px solid var(--border-color)",
                padding: "16px 24px",
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setPatientHistoryModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT-ONLY RECEIPT LAYOUT ── */}
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
              <p className="print-brand-address">
                Pandeybaba bazar, Kadipur Road
              </p>
              <p className="print-brand-address">Sultanpur, UP - 228145</p>
              <p className="print-brand-contact">
                Phone : 9795358689, 6386470668
              </p>
              <p className="print-brand-contact">
                E-Mail : vikaskr.verma27@gmail.com
              </p>
              <p className="print-brand-gstin">GST No. : N/A</p>
              <p className="print-brand-dl">
                D.L.No. : UP44200000460, UP44210000461
              </p>
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
            <div
              style={{ fontSize: "13px", fontWeight: "bold", color: "#000" }}
            >
              {activePrint.patientName
                ? activePrint.patientName.toUpperCase()
                : "CASH CUSTOMER"}
            </div>
            {activePrint.patientAddress && (
              <div
                style={{ fontSize: "11px", color: "#333", marginTop: "2px" }}
              >
                {activePrint.patientAddress}
              </div>
            )}
            {activePrint.doctorName && (
              <div
                style={{
                  fontSize: "11px",
                  color: "#000",
                  marginTop: "4px",
                  fontWeight: "bold",
                }}
              >
                Dr. Ref: {activePrint.doctorName.toUpperCase()}
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
              <strong>Date :</strong>{" "}
              {activePrint.billDate.split("-").reverse().join("-")}
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
              const itemDiscount =
                item.amount * (activePrint.discountPercent / 100);
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
                  <td style={{ textAlign: "right" }}>
                    {item.price.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {item.price.toFixed(2)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {gstBreakdownPercent.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {gstBreakdownPercent.toFixed(2)}%
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {item.amount.toFixed(2)}
                  </td>
                </tr>
              );
            })}
            {Array.from({
              length: Math.max(0, 10 - activePrint.items.length),
            }).map((_, i) => (
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
            ))}
          </tbody>
        </table>

        <div className="print-footer-grid">
          <div className="print-footer-left">
            <div className="tax-summary-clause">
              GST {activePrint.taxableValue.toFixed(2)} *{" "}
              {activePrint.discountPercent.toFixed(0)}% ={" "}
              {activePrint.discountAmount.toFixed(2)} Discount
            </div>
            <div
              className="tax-summary-clause"
              style={{ marginTop: "4px", textTransform: "uppercase" }}
            >
              GST INCLUSIVE BREAKDOWN: Taxable Value: ₹
              {activePrint.taxableValue.toFixed(2)} | SGST: ₹
              {activePrint.sgst.toFixed(2)} | CGST: ₹
              {activePrint.cgst.toFixed(2)}
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

      <SubstituteFinderModal
        isOpen={isSubstituteModalOpen}
        onClose={() => setIsSubstituteModalOpen(false)}
        initialQuery={substituteInitialQuery}
        onSelectSubstitute={(sub) => handleSelectMedicine(sub)}
      />
    </>
  );
}
