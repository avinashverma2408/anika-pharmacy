import React, { useState } from "react";
import { usePharmacyStore } from "../../store/usePharmacyStore";

export default function VerifyOtpScreen() {
  const { authEmail, verifyOtp, setAuthScreen, setLastOtp, isLoadingAuth } =
    usePharmacyStore();
  const [otp, setOtp] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Store OTP so reset-password step can send it
    setLastOtp(otp);
    await verifyOtp(otp);
  };

  return (
    <div className="auth-card card-panel animate-scale-in">
      <h3>Verify OTP</h3>
      <p className="auth-subtitle">
        We sent a 4-digit code to <strong>{authEmail || "your email"}</strong>
      </p>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="otp-code">Enter 4-Digit OTP</label>
          <input
            type="text"
            id="otp-code"
            required
            maxLength={4}
            pattern="\d{4}"
            placeholder="1234"
            className="otp-input-field"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            disabled={isLoadingAuth}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full btn-auth"
          disabled={isLoadingAuth || otp.length !== 4}
        >
          {isLoadingAuth ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i> Verifying...
            </>
          ) : (
            <>
              <i className="fa-solid fa-shield-halved"></i> Verify &amp; Proceed
            </>
          )}
        </button>

        <a
          href="#"
          className="auth-back-link"
          onClick={(e) => {
            e.preventDefault();
            setAuthScreen("forgot");
          }}
        >
          <i className="fa-solid fa-arrow-left"></i> Change Email
        </a>
      </form>
    </div>
  );
}
