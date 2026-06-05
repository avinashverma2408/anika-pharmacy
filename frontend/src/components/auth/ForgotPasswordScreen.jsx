import React, { useState } from 'react';
import { usePharmacyStore } from '../../store/usePharmacyStore';

export default function ForgotPasswordScreen() {
    const { sendOtp, setAuthScreen } = usePharmacyStore();
    const [email, setEmail] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        sendOtp(email);
    };

    return (
        <div className="auth-card card-panel animate-scale-in">
            <h3>Forgot Password?</h3>
            <p className="auth-subtitle">Enter your email and we'll send you a simulated OTP code.</p>

            <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                    <label htmlFor="forgot-email">Email Address</label>
                    <input 
                        type="email" 
                        id="forgot-email" 
                        required 
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <button type="submit" className="btn btn-primary w-full btn-auth">
                    <i className="fa-solid fa-paper-plane"></i> Send OTP Code
                </button>

                <a 
                    href="#" 
                    className="auth-back-link"
                    onClick={(e) => { e.preventDefault(); setAuthScreen('login'); }}
                >
                    <i className="fa-solid fa-arrow-left"></i> Back to Login
                </a>
            </form>
        </div>
    );
}
