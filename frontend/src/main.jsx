import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const root = document.getElementById("root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Warm the most common workspace chunk after first paint
if (typeof window !== "undefined") {
  window.requestIdleCallback?.(
    () => {
      import("./components/DashboardTab");
      import("./components/InventoryTab");
    },
    { timeout: 2500 },
  );
}
