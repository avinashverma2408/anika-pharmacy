import React from 'react';
import { usePharmacyStore } from '../../store/usePharmacyStore';

export default function SuccessScreen() {
    const { setAuthScreen } = usePharmacyStore();

    return (
        <div className="auth-card card-panel success-panel-card animate-scale-in">
            <div className="success-checkmark-circle">
                <i className="fa-solid fa-check check-anim"></i>
            </div>
            <h3>Success!</h3>
            <p className="auth-subtitle">Your password has been changed and updated successfully.</p>

            <button 
                type="button" 
                className="btn btn-primary w-full btn-auth"
                onClick={() => setAuthScreen('login')}
            >
                <i className="fa-solid fa-right-to-bracket"></i> Proceed to Login
            </button>
        </div>
    );
}
