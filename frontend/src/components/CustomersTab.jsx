import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { customerApi } from "../api/apiClient";
import { showSimpleToast } from "../store/usePharmacyStore";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  mobile: "",
  address: "",
  preferredDoctor: "",
  notes: "",
  status: "Active",
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

function PaginationBar({ page, total, totalPages, pageSize, onChange }) {
  if (total <= 0) return null;
  const safePage = Math.min(page, totalPages || 1);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing {start}–{end} of {total} customers
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === 1}
          onClick={() => onChange(1)}
        >
          <i className="fa-solid fa-angles-left" />
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === 1}
          onClick={() => onChange(Math.max(1, safePage - 1))}
        >
          <i className="fa-solid fa-chevron-left" />
        </button>
        <span className="pagination-info">
          Page {safePage} / {totalPages || 1}
        </span>
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === totalPages}
          onClick={() => onChange(Math.min(totalPages, safePage + 1))}
        >
          <i className="fa-solid fa-chevron-right" />
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={safePage === totalPages}
          onClick={() => onChange(totalPages)}
        >
          <i className="fa-solid fa-angles-right" />
        </button>
      </div>
    </div>
  );
}

function CustomerFormModal({ open, editing, form, saving, onChange, onClose, onSubmit }) {
  const setField = (key) => (e) => onChange({ ...form, [key]: e.target.value });
  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop show"
      id={editing ? "edit-customer-modal" : "add-customer-modal"}
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editing ? "Edit Customer" : "Add New Customer"}</h3>
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
              <label htmlFor="modal-customer-name">
                Name <span className="required">*</span>
              </label>
              <input
                id="modal-customer-name"
                type="text"
                required
                value={form.name}
                placeholder="e.g., Rahul Sharma"
                onChange={setField("name")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="modal-customer-mobile">
                Mobile <span className="required">*</span>
              </label>
              <input
                id="modal-customer-mobile"
                type="tel"
                required
                value={form.mobile}
                maxLength={15}
                placeholder="10-digit mobile"
                onChange={(e) =>
                  onChange({
                    ...form,
                    mobile: e.target.value.replace(/\D/g, ""),
                  })
                }
              />
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="modal-customer-address">Address</label>
              <textarea
                id="modal-customer-address"
                rows={2}
                value={form.address}
                placeholder="Patient address"
                onChange={setField("address")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="modal-customer-doctor">Preferred Doctor</label>
              <input
                id="modal-customer-doctor"
                type="text"
                value={form.preferredDoctor}
                placeholder="e.g., Dr. Mehta"
                onChange={setField("preferredDoctor")}
              />
            </div>
            <div className="form-group">
              <label htmlFor="modal-customer-status">Status</label>
              <select
                id="modal-customer-status"
                value={form.status}
                onChange={setField("status")}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="form-group col-span-2">
              <label htmlFor="modal-customer-notes">Notes</label>
              <textarea
                id="modal-customer-notes"
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
                  <i className="fa-solid fa-floppy-disk" /> Update Customer
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plus" /> Add Customer
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

function DeleteCustomerModal({ open, customer, deleting, onClose, onConfirm }) {
  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop show"
      id="delete-customer-modal"
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
          <h3>Delete Customer?</h3>
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
            <strong>{customer?.name}</strong>
            {customer?.mobile ? ` (${customer.mobile})` : ""}? Bills will remain;
            only the customer profile is removed. This action cannot be undone.
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

export default function CustomersTab() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageData, setPageData] = useState({
    customers: [],
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    activeCustomers: 0,
    totalSpent: 0,
    totalPurchases: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const { data } = await customerApi.getAll({
        search: search || undefined,
        status: statusFilter,
        page: currentPage,
        limit: PAGE_SIZE,
        sort: "lastVisitAt",
        order: "desc",
      });
      setPageData({
        customers: data.customers || [],
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      });
      if (data.summary) setSummary(data.summary);
    } catch {
      setPageData({ customers: [], total: 0, totalPages: 1 });
      showSimpleToast("Error", "Failed to load customers.", "danger");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, currentPage]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      const { data } = await customerApi.getById(id);
      setDetail(data.customer || null);
    } catch {
      setDetail(null);
      showSimpleToast("Error", "Failed to load customer details.", "danger");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const openDetail = (customer) => {
    const id = getId(customer);
    setSelectedId(id);
    setDetail(customer);
    loadDetail(id);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name || "",
      mobile: customer.mobile || "",
      address: customer.address || "",
      preferredDoctor: customer.preferredDoctor || "",
      notes: customer.notes || "",
      status: customer.status || "Active",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim(),
        preferredDoctor: form.preferredDoctor.trim(),
        notes: form.notes.trim(),
        status: form.status,
      };

      if (editing) {
        const { data } = await customerApi.update(getId(editing), payload);
        showSimpleToast("Updated", data.message, "success");
      } else {
        const { data } = await customerApi.add(payload);
        showSimpleToast("Added", data.message, "success");
      }

      setFormOpen(false);
      await fetchPage();
      if (editing && selectedId) await loadDetail(selectedId);
    } catch (err) {
      showSimpleToast(
        "Error",
        err.response?.data?.message || "Failed to save customer.",
        "danger",
      );
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (customer) => {
    setDeletingCustomer(customer);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    if (isDeleting) return;
    setDeleteOpen(false);
    setDeletingCustomer(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;
    const id = getId(deletingCustomer);
    setIsDeleting(true);
    try {
      const { data } = await customerApi.delete(id);
      showSimpleToast("Deleted", data.message, "success");
      setDeleteOpen(false);
      setDeletingCustomer(null);
      if (String(selectedId) === String(id)) closeDetail();
      await fetchPage();
    } catch (err) {
      showSimpleToast(
        "Error",
        err.response?.data?.message || "Failed to delete customer.",
        "danger",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data } = await customerApi.syncFromBills();
      showSimpleToast("Synced", data.message, "success");
      await fetchPage();
    } catch {
      showSimpleToast("Error", "Failed to sync customers from bills.", "danger");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const modals = (
    <>
      <CustomerFormModal
        open={formOpen}
        editing={editing}
        form={form}
        saving={saving}
        onChange={setForm}
        onClose={closeForm}
        onSubmit={handleSave}
      />
      <DeleteCustomerModal
        open={deleteOpen}
        customer={deletingCustomer}
        deleting={isDeleting}
        onClose={closeDelete}
        onConfirm={handleConfirmDelete}
      />
    </>
  );

  if (selectedId) {
    return (
      <section id="tab-customers" className="tab-pane active">
        <div className="page-header flex-header">
          <div>
            <button
              type="button"
              className="btn btn-outline btn-small suppliers-back-btn"
              onClick={closeDetail}
            >
              <i className="fa-solid fa-arrow-left" /> Back to Customers
            </button>
            <h2>{detail?.name || "Customer Details"}</h2>
            <p className="subtitle">Profile, visit stats, and purchase history.</p>
          </div>
          <div className="header-actions-row">
            <button
              type="button"
              className="btn btn-outline"
              disabled={!detail}
              onClick={() => openEdit(detail)}
            >
              <i className="fa-solid fa-pen-to-square" /> Edit
            </button>
          </div>
        </div>

        {loadingDetail && !detail ? (
          <div className="card-panel empty-state">
            <i className="fa-solid fa-spinner fa-spin" />
            <p>Loading customer…</p>
          </div>
        ) : !detail ? (
          <div className="card-panel empty-state">
            <p>Customer not found.</p>
            <button type="button" className="btn btn-outline" onClick={closeDetail}>
              Go Back
            </button>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card border-success">
                <div className="stat-icon bg-success">
                  <i className="fa-solid fa-receipt" />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Purchases</span>
                  <h3 className="stat-value">{detail.totalPurchases || 0}</h3>
                </div>
              </div>
              <div className="stat-card border-warning">
                <div className="stat-icon bg-warning text-dark">
                  <i className="fa-solid fa-wallet" />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Total Spent</span>
                  <h3 className="stat-value">{formatMoney(detail.totalSpent)}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-primary">
                  <i className="fa-solid fa-calendar-check" />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Last Visit</span>
                  <h3 className="stat-value" style={{ fontSize: 16 }}>
                    {formatDate(detail.lastVisitAt)}
                  </h3>
                </div>
              </div>
              <div className="stat-card border-inactive">
                <div className="stat-icon bg-inactive">
                  <i className="fa-solid fa-mobile-screen" />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Mobile</span>
                  <h3 className="stat-value" style={{ fontSize: 16 }}>
                    {detail.mobile}
                  </h3>
                </div>
              </div>
            </div>

            <div className="card-panel suppliers-profile-card">
              <div className="panel-header">
                <div className="panel-title-group">
                  <i className="fa-solid fa-id-card panel-icon text-primary" />
                  <h3>Customer Profile</h3>
                </div>
              </div>
              <div className="suppliers-profile-grid">
                <div>
                  <div className="stat-label">Name</div>
                  <div className="cell-strong">{detail.name}</div>
                </div>
                <div>
                  <div className="stat-label">Preferred Doctor</div>
                  <div className="cell-strong">{detail.preferredDoctor || "—"}</div>
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
                  <h3>Purchase History</h3>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Payment</th>
                    <th>Items</th>
                    <th>Net Total</th>
                  </tr>
                </thead>
                <tbody>
                  {!detail.bills?.length ? (
                    <tr>
                      <td colSpan="5" className="table-empty-cell">
                        No bills linked yet.
                      </td>
                    </tr>
                  ) : (
                    detail.bills.map((bill) => (
                      <tr key={getId(bill)}>
                        <td className="cell-strong">{bill.invoiceNo}</td>
                        <td>{formatDate(bill.billDate)}</td>
                        <td>{bill.paymentMode}</td>
                        <td>{bill.items?.length || 0}</td>
                        <td className="cell-strong">{formatMoney(bill.netTotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {modals}
      </section>
    );
  }

  return (
    <section id="tab-customers" className="tab-pane active">
      <div className="page-header flex-header">
        <div>
          <h2>Customer Management</h2>
          <p className="subtitle">
            Patient profiles, mobile lookup, and purchase history.
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
            {isSyncing ? " Syncing..." : " Sync from Bills"}
          </button>
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <i className="fa-solid fa-plus" /> Add Customer
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card border-success">
          <div className="stat-icon bg-success">
            <i className="fa-solid fa-user-group" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Active Customers</span>
            <h3 className="stat-value">{summary.activeCustomers}</h3>
          </div>
        </div>
        <div className="stat-card border-warning">
          <div className="stat-icon bg-warning text-dark">
            <i className="fa-solid fa-wallet" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Spent</span>
            <h3 className="stat-value">{formatMoney(summary.totalSpent)}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-primary">
            <i className="fa-solid fa-receipt" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Purchases</span>
            <h3 className="stat-value">{summary.totalPurchases}</h3>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon bg-primary">
            <i className="fa-solid fa-list" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Listed Customers</span>
            <h3 className="stat-value">{pageData.total}</h3>
          </div>
        </div>
      </div>

      <div className="filter-toolbar card-panel">
        <div className="filter-group filter-group-grow">
          <label htmlFor="customer-search">Search</label>
          <div className="filter-search-wrap">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              id="customer-search"
              type="search"
              placeholder="Name or mobile..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-group">
          <label htmlFor="customer-status">Status</label>
          <select
            id="customer-status"
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
              <th>Name</th>
              <th>Mobile</th>
              <th>Last Visit</th>
              <th>Purchases</th>
              <th>Total Spent</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan="7">
                    <div className="table-skeleton-row" />
                  </td>
                </tr>
              ))
            ) : pageData.customers.length === 0 ? null : (
              pageData.customers.map((customer) => (
                <tr key={getId(customer)}>
                  <td className="cell-strong">{customer.name}</td>
                  <td>{customer.mobile}</td>
                  <td>{formatDate(customer.lastVisitAt)}</td>
                  <td>{customer.totalPurchases || 0}</td>
                  <td className="cell-strong">{formatMoney(customer.totalSpent)}</td>
                  <td>
                    <span
                      className={`badge ${
                        customer.status === "Active"
                          ? "badge-active"
                          : "badge-inactive"
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="action-btn-group">
                      <button
                        type="button"
                        className="btn-icon-only view"
                        title="View Details"
                        onClick={() => openDetail(customer)}
                      >
                        <i className="fa-solid fa-eye" />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-only edit"
                        title="Edit Customer"
                        onClick={() => openEdit(customer)}
                      >
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-only delete"
                        title="Delete Customer"
                        onClick={() => openDelete(customer)}
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!isLoading && pageData.customers.length === 0 && (
          <div className="empty-state suppliers-empty">
            <i className="fa-solid fa-user-group" />
            <p>No customers yet.</p>
            <p className="empty-hint">
              Add manually, or sync from existing bills with mobile numbers.
            </p>
            <div className="header-actions-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleSync}
                disabled={isSyncing}
              >
                Sync from Bills
              </button>
              <button type="button" className="btn btn-primary" onClick={openAdd}>
                Add Customer
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

      {modals}
    </section>
  );
}
