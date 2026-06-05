import React, { useState, useEffect } from 'react';
import { usePharmacyStore } from '../store/usePharmacyStore';

export default function ProductModals() {
    const {
        isAddModalOpen, setAddModalOpen, addMedicine,
        isEditModalOpen, setEditModalOpen, editingProduct, updateMedicine,
        isDeleteModalOpen, setDeleteModalOpen, deletingProduct, confirmDeleteMedicine,
        isSavingMedicine, isDeletingMedicine
    } = usePharmacyStore();

    // Add Form Local States
    const [addName, setAddName] = useState('');
    const [addCategory, setAddCategory] = useState('');
    const [addBatch, setAddBatch] = useState('');
    const [addPrice, setAddPrice] = useState('');
    const [addQuantity, setAddQuantity] = useState('');
    const [addExpiry, setAddExpiry] = useState('');
    const [addStatus, setAddStatus] = useState('Active');

    // Edit Form Local States
    const [editName, setEditName] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editBatch, setEditBatch] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editQuantity, setEditQuantity] = useState('');
    const [editExpiry, setEditExpiry] = useState('');
    const [editStatus, setEditStatus] = useState('Active');

    // Populate edit form when product loads
    useEffect(() => {
        if (editingProduct) {
            setEditName(editingProduct.name || '');
            setEditCategory(editingProduct.category || '');
            setEditBatch(editingProduct.batch || '');
            setEditPrice(editingProduct.price || '');
            setEditQuantity(editingProduct.quantity || '');
            setEditExpiry(editingProduct.expiryDate || '');
            setEditStatus(editingProduct.status || 'Active');
        }
    }, [editingProduct]);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        const success = await addMedicine({
            name: addName, category: addCategory, batch: addBatch,
            price: addPrice, quantity: addQuantity, expiryDate: addExpiry, status: addStatus
        });
        if (success) {
            setAddName(''); setAddCategory(''); setAddBatch('');
            setAddPrice(''); setAddQuantity(''); setAddExpiry(''); setAddStatus('Active');
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingProduct) return;
        await updateMedicine(editingProduct._id || editingProduct.id, {
            name: editName, category: editCategory, batch: editBatch,
            price: editPrice, quantity: editQuantity, expiryDate: editExpiry, status: editStatus
        });
    };

    return (
        <>
            {/* ADD PRODUCT MODAL */}
            <div className={`modal-backdrop ${isAddModalOpen ? 'show' : ''}`} id="add-product-modal">
                <div className="modal-card">
                    <div className="modal-header">
                        <h3>Add New Medicine</h3>
                        <button className="modal-close-btn" onClick={() => setAddModalOpen(false)} aria-label="Close modal">&times;</button>
                    </div>
                    <form onSubmit={handleAddSubmit} className="modal-form">
                        <div className="form-grid">
                            <div className="form-group col-span-2">
                                <label htmlFor="add-name">Medicine Name <span className="required">*</span></label>
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
                                <label htmlFor="add-category">Category <span className="required">*</span></label>
                                <select 
                                    id="add-category" 
                                    required
                                    value={addCategory}
                                    onChange={(e) => setAddCategory(e.target.value)}
                                >
                                    <option value="" disabled>Select Category</option>
                                    <option value="Tablet">Tablet</option>
                                    <option value="Syrup">Syrup</option>
                                    <option value="Injection">Injection</option>
                                    <option value="Vaccine">Vaccine</option>
                                    <option value="Ointment">Ointment</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="add-batch">Batch Number <span className="required">*</span></label>
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
                                <label htmlFor="add-price">Price (₹) <span className="required">*</span></label>
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
                                <label htmlFor="add-quantity">Quantity <span className="required">*</span></label>
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
                                <label htmlFor="add-expiry">Expiry Date <span className="required">*</span></label>
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
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline modal-cancel-btn" onClick={() => setAddModalOpen(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={isSavingMedicine}>
                                {isSavingMedicine
                                    ? <><i className="fa-solid fa-spinner fa-spin"></i> Adding...</>
                                    : <><i className="fa-solid fa-plus"></i> Add Medicine</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* EDIT PRODUCT MODAL */}
            <div className={`modal-backdrop ${isEditModalOpen ? 'show' : ''}`} id="edit-product-modal">
                <div className="modal-card">
                    <div className="modal-header">
                        <h3>Edit Product</h3>
                        <button className="modal-close-btn" onClick={() => setEditModalOpen(false)} aria-label="Close modal">&times;</button>
                    </div>
                    <form onSubmit={handleEditSubmit} className="modal-form">
                        <div className="form-grid">
                            <div className="form-group col-span-2">
                                <label htmlFor="edit-name">Medicine Name <span className="required">*</span></label>
                                <input 
                                    type="text" 
                                    id="edit-name" 
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-category">Category <span className="required">*</span></label>
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
                                <label htmlFor="edit-batch">Batch Number <span className="required">*</span></label>
                                <input 
                                    type="text" 
                                    id="edit-batch" 
                                    required
                                    value={editBatch}
                                    onChange={(e) => setEditBatch(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-price">Price (₹) <span className="required">*</span></label>
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
                                <label htmlFor="edit-quantity">Quantity <span className="required">*</span></label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    required
                                    value={editQuantity}
                                    onChange={(e) => setEditQuantity(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-expiry">Expiry Date <span className="required">*</span></label>
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
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline modal-cancel-btn" onClick={() => setEditModalOpen(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={isSavingMedicine}>
                                {isSavingMedicine
                                    ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
                                    : <><i className="fa-solid fa-save"></i> Update Product</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            <div className={`modal-backdrop ${isDeleteModalOpen ? 'show' : ''}`} id="delete-product-modal">
                <div className="modal-card" style={{ maxWidth: '400px' }}>
                    <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                        <h3>Delete Medicine?</h3>
                        <button className="modal-close-btn" onClick={() => setDeleteModalOpen(false)} aria-label="Close modal">&times;</button>
                    </div>
                    <div className="modal-form" style={{ paddingTop: '10px' }}>
                        <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                            Are you sure you want to delete <strong>{deletingProduct?.name}</strong> (Batch: {deletingProduct?.batch})? This action cannot be undone.
                        </p>
                        <div className="modal-footer" style={{ borderTop: 'none', marginTop: '20px', paddingTop: '0' }}>
                            <button type="button" className="btn btn-outline" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
                            <button type="button" className="btn btn-danger" id="confirm-delete-btn" onClick={confirmDeleteMedicine} disabled={isDeletingMedicine}>
                                {isDeletingMedicine
                                    ? <><i className="fa-solid fa-spinner fa-spin"></i> Deleting...</>
                                    : <><i className="fa-solid fa-trash-can"></i> Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
