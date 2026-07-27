import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  const setField = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop show"
      id={editing ? "edit-supplier-modal" : "add-supplier-modal"}
      onClick={onClose}
    >
      <div className="modal-card supplier-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editing ? "Edit Supplier" : "Add New Supplier"}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label htmlFor="modal-supplier-name">
                Supplier / Stockist Name <span className="required">*</span>
              </label>
              <input
                id="modal-supplier-name"
                type="text"
                required
                value={form.name}
                placeholder="e.g., Cipla Ltd"
                onChange={setField("name")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-supplier-contact">Contact Person</label>
              <input
                id="modal-supplier-contact"
                type="text"
                value={form.contactPerson}
                placeholder="e.g., Rajesh Kumar"
                onChange={setField("contactPerson")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-supplier-phone">Phone</label>
              <input
                id="modal-supplier-phone"
                type="tel"
                value={form.phone}
                placeholder="e.g., 9876543210"
                onChange={setField("phone")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-supplier-email">Email</label>
              <input
                id="modal-supplier-email"
                type="email"
                value={form.email}
                placeholder="e.g., orders@supplier.com"
                onChange={setField("email")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-supplier-gstin">GSTIN</label>
              <input
                id="modal-supplier-gstin"
                type="text"
                value={form.gstin}
                placeholder="e.g., 22AAAAA0000A1Z5"
                onChange={setField("gstin")}
              />
            </div>

            <div className="form-group col-span-2">
              <label htmlFor="modal-supplier-address">Address</label>
              <textarea
                id="modal-supplier-address"
                rows={2}
                value={form.address}
                placeholder="Shop / warehouse address"
                onChange={setField("address")}
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-supplier-opening-dues">Opening Dues (₹)</label>
              <input
                id="modal-supplier-opening-dues"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.outstandingDues}
                onChange={setField("outstandingDues")}
                disabled={Boolean(editing)}
                title={
                  editing
                    ? "Use Purchase / Payment / Adjustment to change dues"
                    : undefined
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="modal-supplier-status">Status</label>
              <select
                id="modal-supplier-status"
                value={form.status}
                onChange={setField("status")}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="form-group col-span-2">
              <label htmlFor="modal-supplier-notes">Notes</label>
              <textarea
                id="modal-supplier-notes"
                rows={2}
                value={form.notes}
                placeholder="Optional notes about this supplier"
                onChange={setField("notes")}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline modal-cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />{" "}
                  {editing ? "Updating..." : "Adding..."}
                </>
              ) : editing ? (
                <>
                  <i className="fa-solid fa-floppy-disk" /> Update Supplier
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plus" /> Add Supplier
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function DeleteSupplierModal({ open, supplier, deleting, onClose, onConfirm }) {
  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop show"
      id="delete-supplier-modal"
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{ maxWidth: "400px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-header"
          style={{ borderBottom: "none", paddingBottom: "0" }}
        >
          <h3>Delete Supplier?</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <div className="modal-form" style={{ paddingTop: "10px" }}>
          <p
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "var(--text-secondary)",
            }}
          >
            Are you sure you want to delete{" "}
            <strong>{supplier?.name}</strong>? Purchase / payment history will
            also be removed. This action cannot be undone.
          </p>
          <div
            className="modal-footer"
            style={{ borderTop: "none", marginTop: "20px", paddingTop: "0" }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> Deleting...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-trash-can" /> Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TransactionModal({ open, form, onChange, onClose, onSubmit }) {
  const setField = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop show"
      id="supplier-transaction-modal"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{TXN_TITLES[form.type] || "Record Transaction"}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="txn-type">Type</label>
              <select id="txn-type" value={form.type} onChange={setField("type")}>
                <option value="purchase">Purchase (increase dues)</option>
                <option value="payment">Payment (reduce dues)</option>
                <option value="adjustment">Adjustment (set dues)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="txn-amount">
                Amount (₹) <span className="required">*</span>
              </label>
              <input
                id="txn-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g., 1500.00"
                value={form.amount}
                onChange={setField("amount")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="txn-invoice">Invoice No.</label>
              <input
                id="txn-invoice"
                type="text"
                value={form.invoiceNo}
                placeholder="Optional"
                onChange={setField("invoiceNo")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="txn-date">Date</label>
              <input
                id="txn-date"
                type="date"
                value={form.transactionDate}
                onChange={setField("transactionDate")}
              />
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="txn-notes">Notes</label>
              <textarea
                id="txn-notes"
                rows={2}
                value={form.notes}
                placeholder="Optional notes"
                onChange={setField("notes")}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline modal-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <i className="fa-solid fa-check" /> Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      outstandingDues:
        supplier.outstandingDues === 0 || supplier.outstandingDues
          ? String(supplier.outstandingDues)
          : "",
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

  const openDelete = (supplier) => {
    setDeletingSupplier(supplier);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    if (isDeleting) return;
    setDeleteOpen(false);
    setDeletingSupplier(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSupplier) return;
    const id = getId(deletingSupplier);
    setIsDeleting(true);
    try {
      const ok = await deleteSupplier(id);
      if (!ok) return;
      setDeleteOpen(false);
      setDeletingSupplier(null);
      if (String(selectedId) === String(id)) closeDetail();
      await fetchPage();
    } finally {
      setIsDeleting(false);
    }
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
                              onClick={() => openDelete(supplier)}
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

      <DeleteSupplierModal
        open={deleteOpen}
        supplier={deletingSupplier}
        deleting={isDeleting}
        onClose={closeDelete}
        onConfirm={handleConfirmDelete}
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
