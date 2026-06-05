import React, { useState } from "react";
import { usePharmacyStore } from "../../store/usePharmacyStore";

export default function LoginScreen() {
    const { login, setAuthScreen, isLoadingAuth } = usePharmacyStore();

    const [email, setEmail]       = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await login(email, password);
    };



    return (
        <div className="auth-card card-panel animate-scale-in">
            <h3>Welcome Back</h3>
            <p className="auth-subtitle">Login to access your store inventory dashboard.</p>

            <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                    <label htmlFor="login-email">Email Address</label>
                    <input
                        type="email"
                        id="login-email"
                        required
                        placeholder="admin@anika.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoadingAuth}
                    />
                </div>

                <div className="form-group">
                    <div className="form-label-row">
                        <label htmlFor="login-password">Password</label>
                        <a
                            href="#"
                            className="form-link"
                            onClick={(e) => { e.preventDefault(); setAuthScreen("forgot"); }}
                        >
                            Forgot Password?
                        </a>
                    </div>

                    <div className="password-input-container">
                        <input
                            type={showPassword ? "text" : "password"}
                            id="login-password"
                            required
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoadingAuth}
                        />
                        <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword
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
                        ? <><i className="fa-solid fa-spinner fa-spin"></i> Logging in...</>
                        : <><i className="fa-solid fa-right-to-bracket"></i> Login to Portal</>}
                </button>
            </form>


        </div>
    );
}
