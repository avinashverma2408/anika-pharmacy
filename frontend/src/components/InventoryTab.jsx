import React, { useState, useEffect, useCallback } from "react";
import {
  usePharmacyStore,
  calculateDaysDifference,
  formatDateDisplay,
  formatDateTimeDisplay,
  showSimpleToast,
} from "../store/usePharmacyStore";
import { medicineApi } from "../api/apiClient";
import ProductDetails from "./ProductDetails";
import BillUploadModal from "./BillUploadModal";

const PAGE_SIZE = 10;

export default function InventoryTab() {
  const {
    isLoadingMedicines,
    setAddModalOpen,
    setBillUploadOpen,
    setEditModalOpen,
    setDeleteModalOpen,
    updateMedicineStatus,
    globalSearchQuery,
    selectedMedicineForDetails,
    setSelectedMedicineForDetails,
    simulatedDate,
    medicines: storeMedicines,
    inventorySubTab: subTab,
    setInventorySubTab: setSubTab,
    inventoryCategoryFilter: categoryFilter,
    setInventoryCategoryFilter: setCategoryFilter,
  } = usePharmacyStore();

  // ── Local state ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // Server-fetched page data
  const [pageData, setPageData] = useState({
    medicines: [],
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Selected distributor for detailed return voucher view
  const [selectedDistributor, setSelectedDistributor] = useState(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isMarkingReturned, setIsMarkingReturned] = useState(false);
  const [isBillScanModalOpen, setIsBillScanModalOpen] = useState(false);

  // Group expired medicines by Distributor for the Vendor Returns view
  const getVendorGroupedReturns = () => {
    if (subTab !== "vendor-returns") return [];

    const groups = {}; // { distributorName: [medicines] }
    pageData.medicines.forEach((med) => {
      const stockist = med.stockistName?.trim() || "Unassigned Vendor";
      if (!groups[stockist]) {
        groups[stockist] = [];
      }
      groups[stockist].push(med);
    });

    return Object.entries(groups).map(([distributor, meds]) => {
      const totalItems = meds.length;
      const totalQuantity = meds.reduce((sum, m) => sum + (m.quantity || 0), 0);
      const totalValue = meds.reduce((sum, m) => sum + (m.ptr || 0) * (m.quantity || 0), 0);
      return {
        distributor,
        medicines: meds,
        totalItems,
        totalQuantity,
        totalValue,
      };
    }).sort((a, b) => b.totalValue - a.totalValue);
  };

  const vendorGroups = getVendorGroupedReturns();

  const handleDownloadVoucherCSV = (group) => {
    if (!group || !group.medicines || group.medicines.length === 0) {
      showSimpleToast("No Data", "There are no medicines to export.", "warning");
      return;
    }

    const headers = [
      "Medicine Name",
      "Batch No",
      "Expiry Date",
      "Quantity (Units)",
      "PTR (Rs)",
      "GST Rate (%)",
      "Total PTR Value (Rs)",
    ];

    const rows = group.medicines.map((m) => {
      const gstVal = m.gstRate || 5;
      const totalPtrVal = (m.ptr || 0) * (m.quantity || 0);
      return [
        m.name,
        m.batch,
        new Date(m.expiryDate).toLocaleDateString("en-GB"),
        m.quantity,
        (m.ptr || 0).toFixed(2),
        `${gstVal}%`,
        totalPtrVal.toFixed(2),
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        ["VENDOR RETURN VOUCHER"],
        ["Distributor/Stockist", group.distributor],
        ["Generated Date", new Date().toLocaleDateString("en-GB")],
        ["Total Expired Value", `Rs. ${group.totalValue.toFixed(2)}`],
        [],
        headers.join(","),
        ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Vendor_Return_${group.distributor.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSimpleToast("Export Success", "Voucher CSV report downloaded successfully!", "success");
  };

  const handleDownloadVoucherPDF = (group) => {
    const element = document.querySelector(".voucher-print-wrapper");
    if (!element) return;

    showSimpleToast("Generating PDF", "Compiling Return Voucher...", "success");

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
              pdf.save(`Vendor_Return_Voucher_${group.distributor.replace(/\s+/g, "_")}.pdf`);

              element.classList.remove("pdf-generation-in-progress");
              showSimpleToast("Success", "Return Voucher PDF downloaded successfully!", "success");
            })
            .catch((err) => {
              console.error("Canvas capture failed:", err);
              element.classList.remove("pdf-generation-in-progress");
              showSimpleToast("PDF Error", "Failed to capture voucher layout.", "danger");
            });
        })
        .catch((err) => {
          console.error("Failed to load PDF libraries:", err);
          element.classList.remove("pdf-generation-in-progress");
          showSimpleToast("Library Error", "Failed to load PDF libraries.", "danger");
        });
    }, 150);
  };

  const handleMarkAsReturned = async (group) => {
    if (!group || !group.medicines || group.medicines.length === 0) return;

    if (!window.confirm(`Are you sure you want to mark all expired items for "${group.distributor}" as Returned? This will set their quantity to 0 and update their status to Inactive.`)) {
      return;
    }

    setIsMarkingReturned(true);
    try {
      const updatePromises = group.medicines.map((m) => {
        const updatedMed = {
          name: m.name,
          category: m.category,
          batch: m.batch,
          price: m.price,
          quantity: 0,
          expiryDate: m.expiryDate,
          status: "Inactive",
          stockistName: m.stockistName,
          ptr: m.ptr,
          hsn: m.hsn,
          pack: m.pack,
          gstRate: m.gstRate,
          composition: m.composition,
        };
        return medicineApi.update(m._id || m.id, updatedMed);
      });

      await Promise.all(updatePromises);
      showSimpleToast("Success", `All items for "${group.distributor}" marked as returned!`, "success");
      
      setIsVoucherModalOpen(false);
      setSelectedDistributor(null);
      
      // Refresh inventory list and notifications
      fetchPage(currentPage, subTab, categoryFilter, globalSearchQuery);
      usePharmacyStore.getState().fetchMedicines();
      usePharmacyStore.getState().fetchNotifications();
    } catch (err) {
      console.error("Failed to mark items as returned:", err);
      showSimpleToast("Error", "Failed to update return statuses.", "danger");
    } finally {
      setIsMarkingReturned(false);
    }
  };

  // Sub-tab counts (fetched separately — all docs, no page limit)
  const [tabCounts, setTabCounts] = useState({
    active: 0,
    expiring: 0,
    expired: 0,
    "vendor-returns": 0,
    outofstock: 0,
    lowstock: 0,
    inactive: 0,
    all: 0,
  });

  const todayStr = simulatedDate;

  // ── Fetch page from server ─────────────────────────────────────────────────
  const fetchPage = useCallback(async (page, tab, category, search) => {
    setIsLoading(true);
    try {
      // Build expiry + status params from sub-tab
      const params = { page, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (category !== "all") params.category = category;

      if (tab === "active") {
        params.status = "Active";
        params.expiry = "safe";
      } else if (tab === "expiring") {
        params.status = "Active";
        params.expiry = "expires-20";
      } else if (tab === "expired" || tab === "vendor-returns") {
        params.status = "all";
        params.expiry = "expired";
        if (tab === "vendor-returns") {
          // Fetch up to 100 items to group them effectively on the client-side
          params.limit = 100;
        }
      } else if (tab === "outofstock") {
        params.status = "Out of Stock";
        params.expiry = "not-expired";
      } else if (tab === "lowstock") {
        params.stock = "low";
      } else if (tab === "inactive") {
        params.status = "Inactive";
      } else if (tab === "all") {
        params.status = "all";
      }
      // 'all' — no extra filter

      const { data } = await medicineApi.getAll(params);
      setPageData({
        medicines: data.medicines || [],
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      });
    } catch {
      setPageData({ medicines: [], total: 0, totalPages: 1 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Fetch tab counts — single efficient API call ────────────────────────────
  const fetchCounts = useCallback(async (search, category) => {
    try {
      const params = {};
      if (search) params.search = search;
      if (category !== "all") params.category = category;

      const { data } = await medicineApi.getCounts(params);
      if (data.success) {
        const counts = data.counts || {};
        counts["vendor-returns"] = counts.expired || 0;
        setTabCounts(counts);
      }
    } catch {
      // Silently ignore count fetch errors
    }
  }, []);

  // ── Re-fetch whenever filters / page / simulatedDate / medicines change ───────
  const [prevSearchQuery, setPrevSearchQuery] = useState(globalSearchQuery);
  if (globalSearchQuery !== prevSearchQuery) {
    setPrevSearchQuery(globalSearchQuery);
    setCurrentPage(1);
  }

  useEffect(() => {
    fetchPage(currentPage, subTab, categoryFilter, globalSearchQuery);
  }, [
    currentPage,
    subTab,
    categoryFilter,
    globalSearchQuery,
    simulatedDate,
    storeMedicines,
    fetchPage,
  ]);

  useEffect(() => {
    fetchCounts(globalSearchQuery, categoryFilter);
  }, [
    globalSearchQuery,
    categoryFilter,
    simulatedDate,
    storeMedicines,
    fetchCounts,
  ]);

  // ── Filter/tab change helpers ──────────────────────────────────────────────
  const handleSubTabChange = (tab) => {
    setSubTab(tab);
    setCurrentPage(1);
  };

  const handleCategoryChange = (val) => {
    setCategoryFilter(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setCategoryFilter("all");
    setCurrentPage(1);
  };

  // ── Pagination helper ──────────────────────────────────────────────────────
  const safePage = Math.min(currentPage, pageData.totalPages);
  const totalPages = pageData.totalPages;
  const startItem = pageData.total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, pageData.total);

  return (
    <section id="tab-inventory" className="tab-pane active">
      {selectedMedicineForDetails ? (
        <ProductDetails />
      ) : (
        <>
          <div className="page-header flex-header">
            <div>
              <h2>Medicine Inventory</h2>
              <p className="subtitle">
                Search, filter, edit, and keep track of your pharmaceutical
                stock.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                className="btn btn-primary"
                id="inventory-scan-bill-btn"
                onClick={() => setBillUploadOpen(true)}
                style={{ background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)", color: "#ffffff", fontWeight: 600, border: "none", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
              >
                <i className="fa-solid fa-file-invoice-dollar" style={{ marginRight: "6px" }}></i> Scan Purchase Bill
              </button>
              <button
                className="btn btn-outline"
                id="inventory-add-btn"
                onClick={() => setAddModalOpen(true)}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: "6px" }}></i> Add Product
              </button>
            </div>
          </div>

          {/* Sub Tab Navigation */}
          <div className="sub-tabs-container">
            {[
              {
                key: "active",
                label: "Active Stock",
                badgeClass: "badge-safe",
              },
              {
                key: "expiring",
                label: "Expiring Soon",
                badgeClass: "badge-warning",
              },
              {
                key: "expired",
                label: "Expired Stock",
                badgeClass: "badge-danger",
              },
              {
                key: "vendor-returns",
                label: "Vendor Returns",
                badgeClass: "badge-purple",
              },
              {
                key: "outofstock",
                label: "Out of Stock",
                badgeClass: "badge-orange",
              },
              {
                key: "lowstock",
                label: "Low Stock",
                badgeClass: "badge-warning",
              },
              {
                key: "inactive",
                label: "Inactive Stock",
                badgeClass: "badge-inactive",
              },
              { key: "all", label: "All Catalog", badgeClass: "badge-info" },
            ].map(({ key, label, badgeClass }) => (
              <button
                key={key}
                className={`sub-tab-btn ${subTab === key ? "active" : ""}`}
                onClick={() => handleSubTabChange(key)}
              >
                {label}{" "}
                <span className={`tab-badge ${badgeClass}`}>
                  {tabCounts[key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {subTab === "vendor-returns" ? (
            <div className="vendor-returns-container" style={{ marginTop: "24px" }}>
              {/* Summary Stats Cards */}
              <div className="stats-grid" style={{ marginBottom: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
                <div className="stat-card border-purple">
                  <div className="stat-icon" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
                    <i className="fa-solid fa-tags"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Total Expired Batches</span>
                    <h3 className="stat-value">{pageData.medicines.length}</h3>
                  </div>
                </div>

                <div className="stat-card border-success">
                  <div className="stat-icon bg-success">
                    <i className="fa-solid fa-wallet"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Total Claim Value</span>
                    <h3 className="stat-value" style={{ color: "#10b981" }}>
                      ₹{vendorGroups.reduce((sum, g) => sum + g.totalValue, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                </div>

                <div className="stat-card border-primary">
                  <div className="stat-icon bg-primary">
                    <i className="fa-solid fa-truck-field"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Affected Distributors</span>
                    <h3 className="stat-value">{vendorGroups.length}</h3>
                  </div>
                </div>
              </div>

              {/* Distributors Summary Table */}
              <div className="table-container card-panel">
                <div className="panel-header" style={{ borderBottom: "none", marginBottom: "16px", paddingBottom: 0 }}>
                  <div className="panel-title-group">
                    <i className="fa-solid fa-list-check panel-icon" style={{ color: "#8b5cf6" }}></i>
                    <h3 style={{ margin: 0 }}>Distributor Grouped Returns</h3>
                  </div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Distributor / Stockist Name</th>
                      <th>Expired Medicines</th>
                      <th>Total Quantity</th>
                      <th>Total Claim Value</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>Loading returns data...</td>
                      </tr>
                    ) : vendorGroups.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                          No expired stock found to return.
                        </td>
                      </tr>
                    ) : (
                      vendorGroups.map((group, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: "600" }}>{group.distributor}</td>
                          <td>{group.totalItems} distinct items</td>
                          <td>{group.totalQuantity} units</td>
                          <td style={{ fontWeight: "600", color: "var(--primary)" }}>
                            ₹{group.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right">
                            <div className="action-btn-group" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="btn btn-outline btn-small"
                                style={{ padding: "4px 8px", fontSize: "12px", marginRight: "6px" }}
                                onClick={() => {
                                  setSelectedDistributor(group);
                                  setIsVoucherModalOpen(true);
                                }}
                              >
                                <i className="fa-solid fa-eye" style={{ marginRight: "4px" }}></i> View Checklist
                              </button>
                              <button
                                className="btn btn-outline btn-small"
                                style={{ padding: "4px 8px", fontSize: "12px" }}
                                onClick={() => handleDownloadVoucherCSV(group)}
                              >
                                <i className="fa-solid fa-file-csv" style={{ marginRight: "4px" }}></i> CSV
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              {/* Filter Toolbar */}
              <div className="filter-toolbar card-panel inventory-filter-bar">
                <div className="filter-group inventory-category-group">
                  <label htmlFor="filter-category">Category</label>
                  <select
                    id="filter-category"
                    value={categoryFilter}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="Tablet">Tablets</option>
                    <option value="Capsule">Capsules</option>
                    <option value="Syrup">Syrups</option>
                    <option value="Injection">Injections</option>
                    <option value="Vaccine">Vaccines</option>
                    <option value="Ointment">Ointments</option>
                    <option value="Other">Others</option>
                  </select>
                </div>

                <button
                  id="reset-filters-btn"
                  className="btn btn-outline inventory-reset-btn"
                  onClick={handleResetFilters}
                >
                  <i className="fa-solid fa-rotate-left"></i> Reset
                </button>
              </div>

              {/* Products Table */}
              <div className="table-container card-panel">
                <table className="data-table" id="inventory-table">
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Category</th>
                      <th>Batch No.</th>
                      <th>Stockist</th>
                      <th>Expiry Date</th>
                      <th>Days Left</th>
                      <th>Added Date & Time</th>
                      <th>PTR</th>
                      <th>MRP / Price</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading || isLoadingMedicines
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 12 }).map((_, j) => (
                              <td key={j}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: "80%",
                                    height: 14,
                                    background: "var(--bg-input)",
                                    borderRadius: 4,
                                    animation: "pulse 1.5s infinite",
                                  }}
                                ></span>
                              </td>
                            ))}
                          </tr>
                        ))
                      : pageData.medicines.map((med) => {
                          const daysLeft = calculateDaysDifference(
                            todayStr,
                            med.expiryDate,
                          );

                          let daysBadgeClass = "badge-safe";
                          let daysText = `${daysLeft} days`;

                          if (daysLeft < 0) {
                            daysBadgeClass = "badge-critical";
                            daysText = `Expired (${Math.abs(daysLeft)}d ago)`;
                          } else if (daysLeft === 0) {
                            daysBadgeClass = "badge-danger";
                            daysText = "Expires Today";
                          } else if (daysLeft <= 7) {
                            daysBadgeClass = "badge-orange";
                            daysText = `${daysLeft} days left`;
                          } else if (daysLeft <= 20) {
                            daysBadgeClass = "badge-warning";
                            daysText = `${daysLeft} days left`;
                          }

                          return (
                            <tr key={med._id || med.id}>
                              <td>
                                <a
                                  href="#"
                                  className="medicine-name-link"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setSelectedMedicineForDetails(med);
                                  }}
                                >
                                  {med.name}
                                </a>
                              </td>
                              <td>{med.category}</td>
                              <td>
                                <code
                                  style={{
                                    background: "var(--bg-input)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "12px",
                                  }}
                                >
                                  {med.batch}
                                </code>
                              </td>
                              <td>
                                {med.stockistName || (
                                  <em style={{ color: "var(--text-muted)" }}>
                                    None
                                  </em>
                                )}
                              </td>
                              <td>{formatDateDisplay(med.expiryDate)}</td>
                              <td>
                                <span className={`badge ${daysBadgeClass}`}>
                                  {daysText}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  {formatDateTimeDisplay(med.createdAt)}
                                </span>
                              </td>
                              <td>₹{(med.ptr || 0).toFixed(2)}</td>
                              <td>₹{med.price.toFixed(2)}</td>
                              <td>{med.quantity}</td>
                              <td>
                                <select
                                  value={med.status}
                                  className="table-status-select"
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    background: "var(--bg-input)",
                                    color: "var(--text-primary)",
                                    border: "1px solid var(--border-color)",
                                    fontSize: "12px",
                                  }}
                                  onChange={(e) =>
                                    updateMedicineStatus(
                                      med._id || med.id,
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                  <option value="Out of Stock">Out of Stock</option>
                                </select>
                              </td>
                              <td className="text-right">
                                <div className="action-btn-group">
                                  <button
                                    className="btn-icon-only view"
                                    title="View Details"
                                    onClick={() =>
                                      setSelectedMedicineForDetails(med)
                                    }
                                  >
                                    <i className="fa-solid fa-eye"></i>
                                  </button>
                                  <button
                                    className="btn-icon-only edit"
                                    title="Edit Medicine"
                                    onClick={() => setEditModalOpen(true, med)}
                                  >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                  </button>
                                  <button
                                    className="btn-icon-only delete"
                                    title="Delete Medicine"
                                    onClick={() => setDeleteModalOpen(true, med)}
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>

                {!isLoading && pageData.medicines.length === 0 && (
                  <div className="empty-state" style={{ display: "flex" }}>
                    <i className="fa-solid fa-folder-open"></i>
                    <p>No products found matching the criteria.</p>
                  </div>
                )}

                {/* Pagination Controls */}
                {pageData.total > 0 && (
                  <div className="pagination-bar">
                    <span className="pagination-info">
                      {pageData.total === 0
                        ? "No items"
                        : `Showing ${startItem}–${endItem} of ${pageData.total} items`}
                    </span>
                    <div className="pagination-controls">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(1)}
                        disabled={safePage === 1}
                        title="First Page"
                      >
                        <i className="fa-solid fa-angles-left"></i>
                      </button>
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        title="Previous"
                      >
                        <i className="fa-solid fa-chevron-left"></i>
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - safePage) <= 1,
                        )
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1)
                            acc.push("ellipsis-" + idx);
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item) =>
                          typeof item === "string" ? (
                            <span key={item} className="pagination-ellipsis">
                              …
                            </span>
                          ) : (
                            <button
                              key={item}
                              className={`pagination-btn ${safePage === item ? "active" : ""}`}
                              onClick={() => setCurrentPage(item)}
                            >
                              {item}
                            </button>
                          ),
                        )}

                      <button
                        className="pagination-btn"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={safePage === totalPages}
                        title="Next"
                      >
                        <i className="fa-solid fa-chevron-right"></i>
                      </button>
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={safePage === totalPages}
                        title="Last Page"
                      >
                        <i className="fa-solid fa-angles-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── VENDOR RETURN VOUCHER MODAL ── */}
      {isVoucherModalOpen && selectedDistributor && (
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
              maxWidth: "850px",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              position: "relative",
            }}
          >
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>Vendor Return Checklist</h3>
              <button
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-primary)" }}
                onClick={() => {
                  setSelectedDistributor(null);
                  setIsVoucherModalOpen(false);
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px" }}>{selectedDistributor.distributor}</h4>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Return Voucher Checklist | Total Expired Batches: {selectedDistributor.totalItems}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }} className="no-print">
                <button className="btn btn-outline" onClick={() => handleDownloadVoucherCSV(selectedDistributor)}>
                  <i className="fa-solid fa-file-csv" style={{ marginRight: "6px" }}></i> Export CSV
                </button>
                <button className="btn btn-outline" onClick={() => handleDownloadVoucherPDF(selectedDistributor)}>
                  <i className="fa-solid fa-file-pdf" style={{ marginRight: "6px" }}></i> Download PDF
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: "var(--danger)", border: "1px solid var(--danger)" }}
                  onClick={() => handleMarkAsReturned(selectedDistributor)}
                  disabled={isMarkingReturned}
                >
                  {isMarkingReturned ? "Processing..." : "Mark as Returned"}
                </button>
              </div>
            </div>

            <div className="table-container" style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Batch</th>
                    <th>Expiry Date</th>
                    <th>Qty</th>
                    <th>PTR (₹)</th>
                    <th>GST</th>
                    <th style={{ textAlign: "right" }}>Total Value (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDistributor.medicines.map((m, idx) => {
                    const totalVal = (m.ptr || 0) * (m.quantity || 0);
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: "500" }}>{m.name}</td>
                        <td><code>{m.batch}</code></td>
                        <td>{formatDateDisplay(m.expiryDate)}</td>
                        <td>{m.quantity}</td>
                        <td>₹{(m.ptr || 0).toFixed(2)}</td>
                        <td>{m.gstRate || 5}%</td>
                        <td style={{ textAlign: "right", fontWeight: "600", color: "var(--primary)" }}>
                          ₹{totalVal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", fontSize: "15px", fontWeight: "700" }}>
              <span>Total Refund Claim: ₹{selectedDistributor.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT-ONLY VENDOR VOUCHER LAYOUT ── */}
      {selectedDistributor && (
        <div className="print-only voucher-print-wrapper">
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "12px", marginBottom: "20px" }}>
            <div>
              <h1 style={{ fontSize: "18px", fontWeight: "800", margin: 0, color: "#000000" }}>ANIKA PHARMACY</h1>
              <p style={{ margin: "2px 0 0", fontSize: "9px", color: "#555555" }}>Pandeybaba bazar, Kadipur Road | Sultanpur, UP - 228145</p>
              <p style={{ margin: "2px 0 0", fontSize: "9px", color: "#555555" }}>Phone : 9795358689, 6386470668</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <h2 style={{ fontSize: "14px", fontWeight: "700", margin: 0, color: "#000000" }}>EXPIRED STOCK RETURN VOUCHER</h2>
              <p style={{ margin: "2px 0 0", fontSize: "9px", color: "#555555" }}>Date: {new Date().toLocaleDateString("en-GB")}</p>
              <p style={{ margin: "2px 0 0", fontSize: "9px", color: "#555555" }}><strong>To: {selectedDistributor.distributor}</strong></p>
            </div>
          </div>

          <table className="reports-print-table" style={{ marginTop: "15px", marginBottom: "25px" }}>
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th>Batch No.</th>
                <th>Expiry Date</th>
                <th>Quantity</th>
                <th style={{ textAlign: "right" }}>PTR (₹)</th>
                <th style={{ textAlign: "right" }}>GST Rate</th>
                <th style={{ textAlign: "right" }}>Total Claim (₹)</th>
              </tr>
            </thead>
            <tbody>
              {selectedDistributor.medicines.map((m, idx) => {
                const totalVal = (m.ptr || 0) * (m.quantity || 0);
                return (
                  <tr key={idx}>
                    <td><strong>{m.name}</strong></td>
                    <td>{m.batch}</td>
                    <td>{new Date(m.expiryDate).toLocaleDateString("en-GB")}</td>
                    <td>{m.quantity} Units</td>
                    <td style={{ textAlign: "right" }}>₹{(m.ptr || 0).toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{m.gstRate || 5}%</td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>₹{totalVal.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #000000" }}>
                <td colSpan="6" style={{ textAlign: "right", fontWeight: "800", padding: "10px 8px", color: "#000000", background: "none" }}>Grand Total Claim Value:</td>
                <td style={{ textAlign: "right", fontWeight: "800", padding: "10px 8px", color: "#000000", background: "none" }}>₹{selectedDistributor.totalValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: "80px", display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <div style={{ width: "40%", borderTop: "1px solid #000", textAlign: "center", paddingTop: "6px", color: "#555555" }}>
              Store Signature (Anika Pharmacy)
            </div>
            <div style={{ width: "40%", borderTop: "1px solid #000", textAlign: "center", paddingTop: "6px", color: "#555555" }}>
              Received / Verified By (Distributor)
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
