import React, { useState } from 'react';
import { usePharmacyStore } from '../store/usePharmacyStore';

export default function SettingsTab() {
    const { updatePasswordInSettings, isLoadingAuth } = usePharmacyStore();

    // Local form states
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');

    // Eye button visibility states
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPass !== confirmPass) {
            showSimpleError('New passwords do not match.');
            return;
        }
        if (newPass.length < 6) {
            showSimpleError('Password must be at least 6 characters long.');
            return;
        }
        if (!/\d/.test(newPass)) {
            showSimpleError('Password must contain at least one number.');
            return;
        }

        const success = await updatePasswordInSettings(currentPass, newPass, confirmPass);
        if (success) {
            setCurrentPass('');
            setNewPass('');
            setConfirmPass('');
        }
    };

    const showSimpleError = (msg) => {
        import('../store/usePharmacyStore').then(m => m.showSimpleToast('Validation Error', msg, 'danger'));
    };

    return (
        <section id="tab-settings" className="tab-pane active">
            <div className="page-header">
                <h2>System Settings</h2>
                <p className="subtitle">Manage store portal configurations, security, and administrative options.</p>
            </div>

            <div className="simulator-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="card-panel" style={{ maxWidth: '600px' }}>
                    <div className="panel-header">
                        <div className="panel-title-group">
                            <i className="fa-solid fa-shield-halved panel-icon text-primary"></i>
                            <h3>Update Administrative Password</h3>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '16px' }}>
                        <div className="form-group">
                            <label htmlFor="settings-current-pass">Current Password <span className="required">*</span></label>
                            <div className="password-input-container">
                                <input 
                                    type={showCurrent ? 'text' : 'password'} 
                                    id="settings-current-pass" 
                                    required 
                                    placeholder="Enter current password"
                                    value={currentPass}
                                    onChange={(e) => setCurrentPass(e.target.value)}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                    aria-label={showCurrent ? "Hide password" : "Show password"}
                                >
                                    {showCurrent ? (
                                        <i className="fa-solid fa-eye-slash"></i>
                                    ) : (
                                        <i className="fa-solid fa-eye"></i>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="settings-new-pass">New Password <span className="required">*</span></label>
                            <div className="password-input-container">
                                <input 
                                    type={showNew ? 'text' : 'password'} 
                                    id="settings-new-pass" 
                                    required 
                                    placeholder="Minimum 6 characters"
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn"
                                    onClick={() => setShowNew(!showNew)}
                                    aria-label={showNew ? "Hide password" : "Show password"}
                                >
                                    {showNew ? (
                                        <i className="fa-solid fa-eye-slash"></i>
                                    ) : (
                                        <i className="fa-solid fa-eye"></i>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="settings-confirm-pass">Confirm New Password <span className="required">*</span></label>
                            <div className="password-input-container">
                                <input 
                                    type={showConfirm ? 'text' : 'password'} 
                                    id="settings-confirm-pass" 
                                    required 
                                    placeholder="Re-type new password"
                                    value={confirmPass}
                                    onChange={(e) => setConfirmPass(e.target.value)}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle-btn"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    aria-label={showConfirm ? "Hide password" : "Show password"}
                                >
                                    {showConfirm ? (
                                        <i className="fa-solid fa-eye-slash"></i>
                                    ) : (
                                        <i className="fa-solid fa-eye"></i>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '12px' }} disabled={isLoadingAuth}>
                            {isLoadingAuth
                                ? <><i className="fa-solid fa-spinner fa-spin"></i> Updating...</>
                                : <><i className="fa-solid fa-key"></i> Update Password</>}
                        </button>
                    </form>
                </div>
            </div>
        </section>
    );
}
