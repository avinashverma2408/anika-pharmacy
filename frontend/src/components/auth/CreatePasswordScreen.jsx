import React, { useState } from 'react';
import { usePharmacyStore } from '../../store/usePharmacyStore';

export default function CreatePasswordScreen() {
    const { resetPassword, isLoadingAuth } = usePharmacyStore();

    const [password, setPassword]               = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword]           = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [localError, setLocalError]           = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');

        if (password.length < 6) {
            setLocalError('Password must be at least 6 characters.');
            return;
        }
        if (!/\d/.test(password)) {
            setLocalError('Password must contain at least one number.');
            return;
        }
        if (password !== confirmPassword) {
            setLocalError('Passwords do not match.');
            return;
        }

        await resetPassword(password, confirmPassword);
    };

    return (
        <div className="auth-card card-panel animate-scale-in">
            <h3>Create New Password</h3>
            <p className="auth-subtitle">Set a secure password for your portal account.</p>

            <form onSubmit={handleSubmit} className="auth-form">
                {localError && (
                    <div style={{
                        background: 'var(--danger-bg)',
                        border: '1px solid var(--danger)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: 'var(--danger)'
                    }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>
                        {localError}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="reset-new-password">New Password</label>
                    <div className="password-input-container">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="reset-new-password"
                            required
                            placeholder="Min 6 characters, include a number"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoadingAuth}
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide" : "Show"}
                        >
                            {showPassword
                                ? <i className="fa-solid fa-eye-slash"></i>
                                : <i className="fa-solid fa-eye"></i>}
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="reset-confirm-password">Confirm Password</label>
                    <div className="password-input-container">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            id="reset-confirm-password"
                            required
                            placeholder="Re-type your new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isLoadingAuth}
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            aria-label={showConfirmPassword ? "Hide" : "Show"}
                        >
                            {showConfirmPassword
                                ? <i className="fa-solid fa-eye-slash"></i>
                                : <i className="fa-solid fa-eye"></i>}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary w-full btn-auth"
                    disabled={isLoadingAuth}
                >
                    {isLoadingAuth
                        ? <><i className="fa-solid fa-spinner fa-spin"></i> Resetting...</>
                        : <><i className="fa-solid fa-lock-open"></i> Reset Password</>}
                </button>
            </form>
        </div>
    );
}
