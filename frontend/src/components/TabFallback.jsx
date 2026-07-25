import React from "react";

export default function TabFallback({ label = "Loading workspace…" }) {
  return (
    <div className="tab-fallback" role="status" aria-live="polite">
      <div className="tab-fallback-card">
        <div className="tab-fallback-spinner" aria-hidden="true" />
        <p className="tab-fallback-title">{label}</p>
        <p className="tab-fallback-subtitle">
          Pulling the latest pharmacy data…
        </p>
        <div className="tab-fallback-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
