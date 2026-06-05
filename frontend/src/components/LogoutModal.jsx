import React from 'react';
import { usePharmacyStore } from '../store/usePharmacyStore';

export default function LogoutModal() {
    const { isLogoutModalOpen, setLogoutModalOpen, logout } = usePharmacyStore();

    if (!isLogoutModalOpen) return null;

    return (
        <div className="modal-backdrop show" id="logout-confirm-modal">
            <div className="modal-card" style={{ maxWidth: '400px' }}>
                <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
                    <h3>Logout Portal</h3>
                    <button className="modal-close-btn" onClick={() => setLogoutModalOpen(false)} aria-label="Close modal">&times;</button>
                </div>
                <div className="modal-form" style={{ paddingTop: '10px' }}>
                    <p style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                        Are you sure you want to log out of the Anika Pharmacy management portal?
                    </p>
                    <div className="modal-footer" style={{ borderTop: 'none', marginTop: '20px', paddingTop: '0' }}>
                        <button type="button" className="btn btn-outline" onClick={() => setLogoutModalOpen(false)}>Cancel</button>
                        <button type="button" className="btn btn-danger" onClick={logout}>Confirm Logout</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
