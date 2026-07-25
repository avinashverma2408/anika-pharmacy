import React, { Suspense, lazy, useEffect } from "react";
import { usePharmacyStore, AUTH_HASH_TO_SCREEN } from "../store/usePharmacyStore";
import TabFallback from "./TabFallback";

const LoginScreen = lazy(() => import("./auth/LoginScreen"));
const ForgotPasswordScreen = lazy(() => import("./auth/ForgotPasswordScreen"));
const VerifyOtpScreen = lazy(() => import("./auth/VerifyOtpScreen"));
const CreatePasswordScreen = lazy(() => import("./auth/CreatePasswordScreen"));
const SuccessScreen = lazy(() => import("./auth/SuccessScreen"));

const AUTH_SCREENS = {
  login: LoginScreen,
  forgot: ForgotPasswordScreen,
  otp: VerifyOtpScreen,
  reset: CreatePasswordScreen,
  success: SuccessScreen,
};

export default function AuthPage() {
  const authScreen = usePharmacyStore((s) => s.authScreen);
  const syncAuthWithHash = usePharmacyStore((s) => s.syncAuthWithHash);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const screen = AUTH_HASH_TO_SCREEN[hash];

    if (screen) {
      if (screen !== usePharmacyStore.getState().authScreen) {
        usePharmacyStore.setState({ authScreen: screen });
      }
    } else {
      window.location.hash = "/";
    }

    const handleHashChange = () => syncAuthWithHash();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [syncAuthWithHash]);

  const ActiveScreen = AUTH_SCREENS[authScreen] || LoginScreen;

  return (
    <div className="auth-wrapper">
      <div className="auth-bg-overlay" />

      <div className="auth-container">
        <div className="auth-brand">
          <img
            src="/logo.png"
            alt="Anika Pharmacy Logo"
            className="auth-logo-img"
            decoding="async"
          />
          <h2>Anika Pharmacy</h2>
          <span>Store Portal Authentication</span>
        </div>

        <Suspense fallback={<TabFallback label="Preparing secure login…" />}>
          <ActiveScreen />
        </Suspense>
      </div>
    </div>
  );
}
