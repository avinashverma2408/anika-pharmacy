import React, { useState, useEffect } from "react";
import { usePharmacyStore, getLocalDateString } from "../store/usePharmacyStore";

export default function ProductModals() {
  const {
    isAddModalOpen,
    setAddModalOpen,
    addMedicine,
    isEditModalOpen,
    setEditModalOpen,
    editingProduct,
    updateMedicine,
    isDeleteModalOpen,
    setDeleteModalOpen,
    deletingProduct,
    confirmDeleteMedicine,
    isSavingMedicine,
    isDeletingMedicine,
  } = usePharmacyStore();

  // Add Form Local States
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addBatch, setAddBatch] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addExpiry, setAddExpiry] = useState("");
  const [addStatus, setAddStatus] = useState("Active");
  const [addStockistName, setAddStockistName] = useState("");
  const [addPtr, setAddPtr] = useState("");
  const [addHsn, setAddHsn] = useState("");
  const [addPack, setAddPack] = useState("");
  const [addGstRate, setAddGstRate] = useState("5");

  // Edit Form Local States
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editBatch, setEditBatch] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [editStockistName, setEditStockistName] = useState("");
  const [editPtr, setEditPtr] = useState("");
  const [editHsn, setEditHsn] = useState("");
  const [editPack, setEditPack] = useState("");
  const [editGstRate, setEditGstRate] = useState("5");

  // Populate edit form when product loads
  useEffect(() => {
    if (editingProduct) {
      setEditName(editingProduct.name || "");
      setEditCategory(editingProduct.category || "");
      setEditBatch(editingProduct.batch || "");
      setEditPrice(editingProduct.price || "");
      setEditQuantity(editingProduct.quantity || "");
      setEditExpiry(
        editingProduct.expiryDate
          ? getLocalDateString(editingProduct.expiryDate)
          : "",
      );
      setEditStatus(editingProduct.status || "Active");
      setEditStockistName(editingProduct.stockistName || "");
      setEditPtr(editingProduct.ptr || "");
      setEditHsn(editingProduct.hsn || "");
      setEditPack(editingProduct.pack || "1*10");
      setEditGstRate(
        editingProduct.gstRate !== undefined
          ? String(editingProduct.gstRate)
          : "5",
      );
    }
  }, [editingProduct]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const success = await addMedicine({
      name: addName,
      category: addCategory,
      batch: addBatch,
      price: addPrice,
      quantity: addQuantity,
      expiryDate: addExpiry,
      status: addStatus,
      stockistName: addStockistName,
      ptr: addPtr,
      hsn: addHsn,
      pack: addPack,
      gstRate: addGstRate,
    });
    if (success) {
      setAddName("");
      setAddCategory("");
      setAddBatch("");
      setAddPrice("");
      setAddQuantity("");
      setAddExpiry("");
      setAddStatus("Active");
      setAddStockistName("");
      setAddPtr("");
      setAddHsn("");
      setAddPack("");
      setAddGstRate("5");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    await updateMedicine(editingProduct._id || editingProduct.id, {
      name: editName,
      category: editCategory,
      batch: editBatch,
      price: editPrice,
      quantity: editQuantity,
      expiryDate: editExpiry,
      status: editStatus,
      stockistName: editStockistName,
      ptr: editPtr,
      hsn: editHsn,
      pack: editPack,
      gstRate: editGstRate,
    });
  };

  return (
    <>
      {/* ADD PRODUCT MODAL */}
      <div
        className={`modal-backdrop ${isAddModalOpen ? "show" : ""}`}
        id="add-product-modal"
      >
        <div className="modal-card">
          <div className="modal-header">
            <h3>Add New Medicine</h3>
            <button
              className="modal-close-btn"
              onClick={() => setAddModalOpen(false)}
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
          <form onSubmit={handleAddSubmit} className="modal-form">
            <div className="form-grid">
              <div className="form-group col-span-2">
                <label htmlFor="add-name">
                  Medicine Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="add-name"
                  required
                  placeholder="e.g., Crocin Pain Relief"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-category">
                  Category <span className="required">*</span>
                </label>
                <select
                  id="add-category"
                  required
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                >
                  <option value="" disabled>
                    Select Category
                  </option>
                  <option value="Tablet">Tablet</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Injection">Injection</option>
                  <option value="Vaccine">Vaccine</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="add-batch">
                  Batch Number <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="add-batch"
                  required
                  placeholder="e.g., B-CR990"
                  value={addBatch}
                  onChange={(e) => setAddBatch(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-price">
                  Price (₹) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="e.g., 45.00"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-quantity">
                  Quantity <span className="required">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g., 150"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-expiry">
                  Expiry Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  id="add-expiry"
                  required
                  value={addExpiry}
                  onChange={(e) => setAddExpiry(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-status">Status</label>
                <select
                  id="add-status"
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="add-stockist">Stockist Name</label>
                <input
                  type="text"
                  id="add-stockist"
                  placeholder="e.g., Cipla Ltd"
                  value={addStockistName}
                  onChange={(e) => setAddStockistName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-ptr">PTR (₹)</label>
                <input
                  type="number"
                  id="add-ptr"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 38.50"
                  value={addPtr}
                  onChange={(e) => setAddPtr(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-hsn">HSN Code</label>
                <input
                  type="text"
                  id="add-hsn"
                  placeholder="e.g., 30045033"
                  value={addHsn}
                  onChange={(e) => setAddHsn(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-pack">Pack Size</label>
                <input
                  type="text"
                  id="add-pack"
                  placeholder="e.g., 1*10"
                  value={addPack}
                  onChange={(e) => setAddPack(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="add-gst">GST Rate (%)</label>
                <select
                  id="add-gst"
                  value={addGstRate}
                  onChange={(e) => setAddGstRate(e.target.value)}
                >
                  <option value="0">0% GST</option>
                  <option value="5">5% GST (2.5% CGST + 2.5% SGST)</option>
                  <option value="12">12% GST (6% CGST + 6% SGST)</option>
                  <option value="18">18% GST (9% CGST + 9% SGST)</option>
                  <option value="28">28% GST (14% CGST + 14% SGST)</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline modal-cancel-btn"
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingMedicine}
              >
                {isSavingMedicine ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Adding...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i> Add Medicine
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* EDIT PRODUCT MODAL */}
      <div
        className={`modal-backdrop ${isEditModalOpen ? "show" : ""}`}
        id="edit-product-modal"
      >
        <div className="modal-card">
          <div className="modal-header">
            <h3>Edit Product</h3>
            <button
              className="modal-close-btn"
              onClick={() => setEditModalOpen(false)}
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>
          <form onSubmit={handleEditSubmit} className="modal-form">
            <div className="form-grid">
              <div className="form-group col-span-2">
                <label htmlFor="edit-name">
                  Medicine Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="edit-name"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-category">
                  Category <span className="required">*</span>
                </label>
                <select
                  id="edit-category"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  <option value="Tablet">Tablet</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Injection">Injection</option>
                  <option value="Vaccine">Vaccine</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-batch">
                  Batch Number <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="edit-batch"
                  required
                  value={editBatch}
                  onChange={(e) => setEditBatch(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-price">
                  Price (₹) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-quantity">
                  Quantity <span className="required">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-expiry">
                  Expiry Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  id="edit-expiry"
                  required
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-stockist">Stockist Name</label>
                <input
                  type="text"
                  id="edit-stockist"
                  placeholder="e.g., Cipla Ltd"
                  value={editStockistName}
                  onChange={(e) => setEditStockistName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-ptr">PTR (₹)</label>
                <input
                  type="number"
                  id="edit-ptr"
                  min="0"
                  step="0.01"
                  placeholder="e.g., 38.50"
                  value={editPtr}
                  onChange={(e) => setEditPtr(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-hsn">HSN Code</label>
                <input
                  type="text"
                  id="edit-hsn"
                  placeholder="e.g., 30045033"
                  value={editHsn}
                  onChange={(e) => setEditHsn(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-pack">Pack Size</label>
                <input
                  type="text"
                  id="edit-pack"
                  placeholder="e.g., 1*10"
                  value={editPack}
                  onChange={(e) => setEditPack(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-gst">GST Rate (%)</label>
                <select
                  id="edit-gst"
                  value={editGstRate}
                  onChange={(e) => setEditGstRate(e.target.value)}
                >
                  <option value="0">0% GST</option>
                  <option value="5">5% GST (2.5% CGST + 2.5% SGST)</option>
                  <option value="12">12% GST (6% CGST + 6% SGST)</option>
                  <option value="18">18% GST (9% CGST + 9% SGST)</option>
                  <option value="28">28% GST (14% CGST + 14% SGST)</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline modal-cancel-btn"
                onClick={() => setEditModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingMedicine}
              >
                {isSavingMedicine ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-save"></i> Update Product
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      <div
        className={`modal-backdrop ${isDeleteModalOpen ? "show" : ""}`}
        id="delete-product-modal"
      >
        <div className="modal-card" style={{ maxWidth: "400px" }}>
          <div
            className="modal-header"
            style={{ borderBottom: "none", paddingBottom: "0" }}
          >
            <h3>Delete Medicine?</h3>
            <button
              className="modal-close-btn"
              onClick={() => setDeleteModalOpen(false)}
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
              <strong>{deletingProduct?.name}</strong> (Batch:{" "}
              {deletingProduct?.batch})? This action cannot be undone.
            </p>
            <div
              className="modal-footer"
              style={{ borderTop: "none", marginTop: "20px", paddingTop: "0" }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                id="confirm-delete-btn"
                onClick={confirmDeleteMedicine}
                disabled={isDeletingMedicine}
              >
                {isDeletingMedicine ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Deleting...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can"></i> Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
