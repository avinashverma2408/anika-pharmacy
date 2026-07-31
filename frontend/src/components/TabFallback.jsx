import React from "react";

export default function TabFallback({ label = "Loading Pharmacy Workspace…" }) {
  return (
    <div className="tab-fallback" role="status" aria-live="polite">
      <div className="tab-fallback-card">
        {/* Medical Rx & Pill Pulsing Loader Centerpiece */}
        <div className="medical-fallback-loader-icon">
          <div className="medical-loader-pulse-ring">
            <i className="fa-solid fa-capsules medical-capsule-spin"></i>
          </div>
          <div className="medical-loader-plus-badge">
            <i className="fa-solid fa-plus"></i>
          </div>
        </div>

        <h4 className="tab-fallback-title">
          <i className="fa-solid fa-heart-pulse ecg-pulse-icon"></i>
          {label}
        </h4>

        <p className="tab-fallback-subtitle">
          Syncing live inventory, medicines, batches & billing records…
        </p>

        {/* Medical Tags */}
        <div className="medical-loader-tags">
          <span>💊 Rx Inventory</span>
          <span>🧪 Batches & Expiry</span>
          <span>⚡ Live Sync</span>
        </div>

        {/* Shimmer Skeleton Progress */}
        <div className="tab-fallback-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
