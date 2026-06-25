import React, { useEffect } from 'react';
import { usePharmacyStore } from '../store/usePharmacyStore';
import { AUTH_HASH_TO_SCREEN } from '../store/usePharmacyStore';
import LoginScreen from './auth/LoginScreen';
import ForgotPasswordScreen from './auth/ForgotPasswordScreen';
import VerifyOtpScreen from './auth/VerifyOtpScreen';
import CreatePasswordScreen from './auth/CreatePasswordScreen';
import SuccessScreen from './auth/SuccessScreen';

export default function AuthPage() {
    const { authScreen, syncAuthWithHash, setAuthScreen } = usePharmacyStore();

    useEffect(() => {
        // On first load: read hash and sync screen
        const hash = window.location.hash.replace('#', '');
        const screen = AUTH_HASH_TO_SCREEN[hash];

        if (screen) {
            // Hash matches a known auth route — sync state
            if (screen !== authScreen) {
                // Only update state; don't re-push hash (would loop)
                usePharmacyStore.setState({ authScreen: screen });
            }
        } else {
            // No valid auth hash — default to /
            window.location.hash = '/';
        }

        // Listen for browser back/forward
        const handleHashChange = () => syncAuthWithHash();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []); // Run once on mount

    return (
        <div className="auth-wrapper">
            <div className="auth-bg-overlay"></div>
            
            <div className="auth-container">
                <div className="auth-brand">
                    <img src="/logo.png" alt="Anika Pharmacy Logo" className="auth-logo-img" />
                    <h2>Anika Pharmacy</h2>
                    <span>Store Portal Authentication</span>
                </div>

                {/* Sub-screens Switched by hash route */}
                {authScreen === 'login'   && <LoginScreen />}
                {authScreen === 'forgot'  && <ForgotPasswordScreen />}
                {authScreen === 'otp'     && <VerifyOtpScreen />}
                {authScreen === 'reset'   && <CreatePasswordScreen />}
                {authScreen === 'success' && <SuccessScreen />}
            </div>
            
            {/* Custom Toast Drawer for Auth notifications */}
            <div className="toast-container" id="toast-container"></div>
        </div>
    );
}
