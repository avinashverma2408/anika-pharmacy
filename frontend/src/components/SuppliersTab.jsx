import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePharmacyStore } from "../store/usePharmacyStore";
import { supplierApi } from "../api/apiClient";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  notes: "",
  status: "Active",
  outstandingDues: "",
};

const EMPTY_TXN = {
  type: "purchase",
  amount: "",
  invoiceNo: "",
  notes: "",
  transactionDate: new Date().toISOString().slice(0, 10),
};

const TXN_LABELS = {
  purchase: "Purchase",
  payment: "Payment",
  adjustment: "Adjustment",
};

const TXN_BADGE = {
  purchase: "badge-warning",
  payment: "badge-safe",
  adjustment: "badge-info",
};

const TXN_TITLES = {
  purchase: "Record Purchase",
  payment: "Record Payment",
  adjustment: "Adjust Outstanding Dues",
};

function getId(entity) {
  return entity?._id || entity?.id || null;
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildPageItems(current, total) {
  if (total <= 1) return total === 1 ? [1] : [];

  return Array.from({ length: total }, (_, i) => i + 1)
    .filter((page) => page === 1 || page === total || Math.abs(page - current) <= 1)
    .reduce((acc, page, index, arr) => {
      if (index > 0 && page - arr[index - 1] > 1) acc.push(`…${index}`);
      acc.push(page);
      return acc;
    }, []);
}

function PaginationBar({ page, total, totalPages, pageSize, onChange }) {
  if (total <= 0) return null;

  const safePage = Math.min(page, totalPages || 1);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const items = buildPageItems(safePage, totalPages);

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing {start}–{end} of {total} suppliers
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === 1}
          title="First Page"
          onClick={() => onChange(1)}
        >
          <i className="fa-solid fa-angles-left" />
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === 1}
          title="Previous"
          onClick={() => onChange(Math.max(1, safePage - 1))}
        >
          <i className="fa-solid fa-chevron-left" />
        </button>

        {items.map((item) =>
          typeof item === "string" ? (
            <span key={item} className="pagination-ellipsis">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`pagination-btn ${safePage === item ? "active" : ""}`}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === totalPages}
          title="Next"
          onClick={() => onChange(Math.min(totalPages, safePage + 1))}
        >
          <i className="fa-solid fa-chevron-right" />
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === totalPages}
          title="Last Page"
          onClick={() => onChange(totalPages)}
        >
          <i className="fa-solid fa-angles-right" />
        </button>
      </div>
    </div>
  );
}

function SupplierFormModal({ open, editing, form, saving, onChange, onClose, onSubmit }) {
  return (
    <div className={`modal-backdrop ${open ? "show" : ""}`}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>{editing ? "Edit Supplier" : "Add Supplier"}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label>
                Supplier / Stockist Name <span className="required">*</span>
              </label>
              <input
                required
                value={form.name}
                placeholder="e.g., Cipla Ltd"
                onChange={(e) => onChange({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={(e) => onChange({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => onChange({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => onChange({ ...form, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>GSTIN</label>
              <input
                value={form.gstin}
                onChange={(e) => onChange({ ...form, gstin: e.target.value })}
              />
            </div>
            <div className="form-group col-span-2">
              <label>Address</label>
              <input
                value={form.address}
                onChange={(e) => onChange({ ...form, address: e.target.value })}
              />
            </div>
            {!editing && (
              <div className="form-group">
                <label>Opening Dues (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.outstandingDues}
                  onChange={(e) => onChange({ ...form, outstandingDues: e.target.value })}
                />
              </div>
            )}
            <div className="form-group">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => onChange({ ...form, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="form-group col-span-2">
              <label>Notes</label>
              <input
                value={form.notes}
                onChange={(e) => onChange({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TransactionModal({ open, form, onChange, onClose, onSubmit }) {
  return (
    <div className={`modal-backdrop ${open ? "show" : ""}`}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>{TXN_TITLES[form.type] || "Record Transaction"}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) => onChange({ ...form, type: e.target.value })}
              >
                <option value="purchase">Purchase (increase dues)</option>
                <option value="payment">Payment (reduce dues)</option>
                <option value="adjustment">Adjustment (set dues)</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                Amount (₹) <span className="required">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => onChange({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Invoice No.</label>
              <input
                value={form.invoiceNo}
                placeholder="Optional"
                onChange={(e) => onChange({ ...form, invoiceNo: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={form.transactionDate}
                onChange={(e) =>
                  onChange({ ...form, transactionDate: e.target.value })
                }
              />
            </div>
            <div className="form-group col-span-2">
              <label>Notes</label>
              <input
                value={form.notes}
                onChange={(e) => onChange({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SuppliersTab() {
  const {
    supplierSummary,
    isSavingSupplier,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addSupplierTransaction,
    syncSuppliersFromStockists,
    setSupplierSummary,
  } = usePharmacyStore();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [duesFilter, setDuesFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [pageData, setPageData] = useState({
    suppliers: [],
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [txnOpen, setTxnOpen] = useState(false);
  const [txnForm, setTxnForm] = useState(EMPTY_TXN);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPage = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supplierApi.getAll({
        search: search || undefined,
        status: statusFilter,
        dues: duesFilter,
        page: currentPage,
        limit: PAGE_SIZE,
        sort: "name",
        order: "asc",
      });

      setPageData({
        suppliers: data.suppliers || [],
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      });

      if (data.summary) {
        setSupplierSummary(data.summary);
      }
    } catch {
      setPageData({ suppliers: [], total: 0, totalPages: 1 });
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, duesFilter, currentPage, setSupplierSummary]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      const { data } = await supplierApi.getById(id);
      setDetail(data.supplier || null);
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const openDetail = (supplier) => {
    const id = getId(supplier);
    setSelectedId(id);
    setDetail(supplier);
    loadDetail(id);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setDuesFilter("all");
    setCurrentPage(1);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      gstin: supplier.gstin || "",
      notes: supplier.notes || "",
      status: supplier.status || "Active",
      outstandingDues: "",
    });
    setFormOpen(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();

    const payload = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      gstin: form.gstin.trim(),
      notes: form.notes.trim(),
      status: form.status,
    };

    if (!editing && form.outstandingDues !== "") {
      payload.outstandingDues = form.outstandingDues;
    }

    const ok = editing
      ? await updateSupplier(getId(editing), payload)
      : await addSupplier(payload);

    if (!ok) return;

    setFormOpen(false);
    await fetchPage();
    if (editing && selectedId) await loadDetail(selectedId);
  };

  const handleDelete = async (supplier) => {
    const confirmed = window.confirm(
      `Delete supplier "${supplier.name}"? Purchase history will also be removed.`,
    );
    if (!confirmed) return;

    const id = getId(supplier);
    const ok = await deleteSupplier(id);
    if (!ok) return;

    if (String(selectedId) === String(id)) closeDetail();
    await fetchPage();
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncSuppliersFromStockists();
      await fetchPage();
    } finally {
      setIsSyncing(false);
    }
  };

  const openTxn = (type = "purchase") => {
    setTxnForm({ ...EMPTY_TXN, type });
    setTxnOpen(true);
  };

  const handleSaveTxn = async (e) => {
    e.preventDefault();
    if (!selectedId) return;

    const result = await addSupplierTransaction(selectedId, {
      type: txnForm.type,
      amount: parseFloat(txnForm.amount),
      invoiceNo: txnForm.invoiceNo.trim(),
      notes: txnForm.notes.trim(),
      transactionDate: txnForm.transactionDate,
    });

    if (!result) return;

    setTxnOpen(false);
    await Promise.all([loadDetail(selectedId), fetchPage()]);
  };

  const summary = useMemo(
    () => ({
      active: supplierSummary?.activeSuppliers ?? 0,
      dues: supplierSummary?.totalOutstandingDues ?? 0,
      withDues: supplierSummary?.withDues ?? 0,
      listed: pageData.total,
    }),
    [supplierSummary, pageData.total],
  );

  const showList = !selectedId;
  // Only block the table on list fetch — sync spinner stays on the button
  const busy = isLoading;

  return (
    <section id="tab-suppliers" className="tab-pane active">
      {showList ? (
        <>
          <div className="page-header flex-header">
            <div>
              <h2>Supplier Management</h2>
              <p className="subtitle">
                Stockist directory, outstanding dues, and purchase / payment history.
              </p>
            </div>
            <div className="header-actions-row">
              <button
                type="button"
                className="btn btn-outline"
                disabled={isSyncing}
                onClick={handleSync}
              >
                <i
                  className={`fa-solid ${isSyncing ? "fa-spinner fa-spin" : "fa-arrows-rotate"}`}
                />
                {isSyncing ? " Syncing..." : " Sync from Stockists"}
              </button>
              <button type="button" className="btn btn-primary" onClick={openAdd}>
                <i className="fa-solid fa-plus" /> Add Supplier
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card border-success">
              <div className="stat-icon bg-success">
                <i className="fa-solid fa-truck-field" />
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Suppliers</span>
                <h3 className="stat-value">{summary.active}</h3>
              </div>
            </div>
            <div className="stat-card border-warning">
              <div className="stat-icon bg-warning text-dark">
                <i className="fa-solid fa-hand-holding-dollar" />
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Outstanding Dues</span>
                <h3 className="stat-value">{formatMoney(summary.dues)}</h3>
              </div>
            </div>
            <div className="stat-card border-orange">
              <div className="stat-icon bg-orange">
                <i className="fa-solid fa-file-invoice-dollar" />
              </div>
              <div className="stat-info">
                <span className="stat-label">Suppliers With Dues</span>
                <h3 className="stat-value">{summary.withDues}</h3>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon bg-primary">
                <i className="fa-solid fa-list" />
              </div>
              <div className="stat-info">
                <span className="stat-label">Listed Suppliers</span>
                <h3 className="stat-value">{summary.listed}</h3>
              </div>
            </div>
          </div>

          <div className="filter-toolbar card-panel">
            <div className="filter-group filter-group-grow">
              <label htmlFor="supplier-search">Search</label>
              <div className="filter-search-wrap">
                <i className="fa-solid fa-magnifying-glass" />
                <input
                  id="supplier-search"
                  type="search"
                  placeholder="Name, phone, email, GSTIN..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
            <div className="filter-group">
              <label htmlFor="supplier-status">Status</label>
              <select
                id="supplier-status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="supplier-dues">Dues</label>
              <select
                id="supplier-dues"
                value={duesFilter}
                onChange={(e) => {
                  setDuesFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Dues</option>
                <option value="due">Has Outstanding</option>
                <option value="clear">No Dues</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-small filter-reset-btn"
              onClick={handleResetFilters}
            >
              Reset
            </button>
          </div>

          <div className="table-container card-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier / Stockist</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>GSTIN</th>
                  <th>Medicines</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {busy ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan="8">
                        <div className="table-skeleton-row" />
                      </td>
                    </tr>
                  ))
                ) : pageData.suppliers.length === 0 ? null : (
                  pageData.suppliers.map((supplier) => {
                    const id = getId(supplier);
                    const hasDue = Number(supplier.outstandingDues) > 0;

                    return (
                      <tr key={id}>
                        <td className="cell-strong">{supplier.name}</td>
                        <td>{supplier.contactPerson || "—"}</td>
                        <td>{supplier.phone || "—"}</td>
                        <td>
                          <code className="cell-code">{supplier.gstin || "—"}</code>
                        </td>
                        <td>{supplier.medicineCount ?? 0}</td>
                        <td className={hasDue ? "cell-dues" : "cell-clear"}>
                          {formatMoney(supplier.outstandingDues)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              supplier.status === "Active"
                                ? "badge-active"
                                : "badge-inactive"
                            }`}
                          >
                            {supplier.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="action-btn-group">
                            <button
                              type="button"
                              className="btn-icon-only view"
                              title="View Details"
                              onClick={() => openDetail(supplier)}
                            >
                              <i className="fa-solid fa-eye" />
                            </button>
                            <button
                              type="button"
                              className="btn-icon-only edit"
                              title="Edit Supplier"
                              onClick={() => openEdit(supplier)}
                            >
                              <i className="fa-solid fa-pen-to-square" />
                            </button>
                            <button
                              type="button"
                              className="btn-icon-only delete"
                              title="Delete Supplier"
                              onClick={() => handleDelete(supplier)}
                            >
                              <i className="fa-solid fa-trash-can" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {!busy && pageData.suppliers.length === 0 && (
              <div className="empty-state suppliers-empty">
                <i className="fa-solid fa-truck-field" />
                <p>No suppliers found.</p>
                <p className="empty-hint">
                  Add a supplier manually, or sync from medicine stockist names.
                </p>
                <div className="header-actions-row">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isSyncing}
                    onClick={handleSync}
                  >
                    <i className="fa-solid fa-arrows-rotate" /> Sync Stockists
                  </button>
                  <button type="button" className="btn btn-primary" onClick={openAdd}>
                    <i className="fa-solid fa-plus" /> Add Supplier
                  </button>
                </div>
              </div>
            )}

            <PaginationBar
              page={currentPage}
              total={pageData.total}
              totalPages={pageData.totalPages}
              pageSize={PAGE_SIZE}
              onChange={setCurrentPage}
            />
          </div>
        </>
      ) : (
        <>
          <div className="page-header flex-header">
            <div>
              <button
                type="button"
                className="btn btn-outline btn-small suppliers-back-btn"
                onClick={closeDetail}
              >
                <i className="fa-solid fa-arrow-left" /> Back to Suppliers
              </button>
              <h2>{detail?.name || "Supplier Details"}</h2>
              <p className="subtitle">
                Contact, outstanding dues, and purchase / payment ledger.
              </p>
            </div>
            <div className="header-actions-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => openEdit(detail)}
                disabled={!detail}
              >
                <i className="fa-solid fa-pen-to-square" /> Edit
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openTxn("purchase")}
                disabled={!detail}
              >
                <i className="fa-solid fa-cart-plus" /> Record Purchase
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => openTxn("payment")}
                disabled={!detail}
              >
                <i className="fa-solid fa-money-bill-transfer" /> Payment
              </button>
            </div>
          </div>

          {loadingDetail && !detail ? (
            <div className="card-panel empty-state">
              <i className="fa-solid fa-spinner fa-spin" />
              <p>Loading supplier details...</p>
            </div>
          ) : !detail ? (
            <div className="card-panel empty-state">
              <i className="fa-solid fa-circle-exclamation" />
              <p>Could not load supplier details.</p>
              <button type="button" className="btn btn-outline" onClick={closeDetail}>
                Go Back
              </button>
            </div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card border-warning">
                  <div className="stat-icon bg-warning text-dark">
                    <i className="fa-solid fa-hand-holding-dollar" />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Outstanding Dues</span>
                    <h3 className="stat-value">
                      {formatMoney(detail.outstandingDues)}
                    </h3>
                  </div>
                </div>
                <div className="stat-card border-success">
                  <div className="stat-icon bg-success">
                    <i className="fa-solid fa-pills" />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Linked Medicines</span>
                    <h3 className="stat-value">{detail.medicineCount || 0}</h3>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon bg-primary">
                    <i className="fa-solid fa-receipt" />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Ledger Entries</span>
                    <h3 className="stat-value">
                      {detail.transactions?.length || 0}
                    </h3>
                  </div>
                </div>
                <div className="stat-card border-inactive">
                  <div className="stat-icon bg-inactive">
                    <i className="fa-solid fa-toggle-on" />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Status</span>
                    <h3 className="stat-value suppliers-status-value">
                      <span
                        className={`badge ${
                          detail.status === "Active"
                            ? "badge-active"
                            : "badge-inactive"
                        }`}
                      >
                        {detail.status}
                      </span>
                    </h3>
                  </div>
                </div>
              </div>

              <div className="card-panel suppliers-profile-card">
                <div className="panel-header">
                  <div className="panel-title-group">
                    <i className="fa-solid fa-id-card panel-icon text-primary" />
                    <h3>Contact Profile</h3>
                  </div>
                </div>
                <div className="suppliers-profile-grid">
                  <div>
                    <div className="stat-label">Contact Person</div>
                    <div className="cell-strong">{detail.contactPerson || "—"}</div>
                  </div>
                  <div>
                    <div className="stat-label">Phone</div>
                    <div className="cell-strong">{detail.phone || "—"}</div>
                  </div>
                  <div>
                    <div className="stat-label">Email</div>
                    <div className="cell-strong">{detail.email || "—"}</div>
                  </div>
                  <div>
                    <div className="stat-label">GSTIN</div>
                    <div className="cell-strong">{detail.gstin || "—"}</div>
                  </div>
                  <div className="suppliers-profile-span">
                    <div className="stat-label">Address</div>
                    <div className="cell-strong">{detail.address || "—"}</div>
                  </div>
                  {detail.notes ? (
                    <div className="suppliers-profile-span">
                      <div className="stat-label">Notes</div>
                      <div>{detail.notes}</div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="table-container card-panel">
                <div className="panel-header suppliers-ledger-header">
                  <div className="panel-title-group">
                    <i className="fa-solid fa-clock-rotate-left panel-icon" />
                    <h3>Purchase &amp; Payment History</h3>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    onClick={() => openTxn("adjustment")}
                  >
                    <i className="fa-solid fa-sliders" /> Adjust Dues
                  </button>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Invoice</th>
                      <th>Amount</th>
                      <th>Balance After</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!detail.transactions?.length ? (
                      <tr>
                        <td colSpan="6" className="table-empty-cell">
                          No ledger entries yet. Record a purchase or payment to
                          begin.
                        </td>
                      </tr>
                    ) : (
                      detail.transactions.map((txn) => (
                        <tr key={getId(txn)}>
                          <td>
                            {formatDate(txn.transactionDate || txn.createdAt)}
                          </td>
                          <td>
                            <span
                              className={`badge ${TXN_BADGE[txn.type] || "badge-info"}`}
                            >
                              {TXN_LABELS[txn.type] || txn.type}
                            </span>
                          </td>
                          <td>{txn.invoiceNo || "—"}</td>
                          <td className="cell-strong">{formatMoney(txn.amount)}</td>
                          <td>{formatMoney(txn.balanceAfter)}</td>
                          <td>{txn.notes || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <SupplierFormModal
        open={formOpen}
        editing={editing}
        form={form}
        saving={isSavingSupplier}
        onChange={setForm}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSaveSupplier}
      />

      <TransactionModal
        open={txnOpen}
        form={txnForm}
        onChange={setTxnForm}
        onClose={() => setTxnOpen(false)}
        onSubmit={handleSaveTxn}
      />
    </section>
  );
}
