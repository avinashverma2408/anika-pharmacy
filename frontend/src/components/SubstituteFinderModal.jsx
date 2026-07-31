import React, { useState, useEffect } from "react";
import { medicineApi } from "../api/apiClient";
import { showSimpleToast } from "../store/usePharmacyStore";

const POPULAR_SALTS = [
  { name: "Paracetamol 650mg", query: "Paracetamol" },
  { name: "Amoxicillin 500mg", query: "Amoxicillin" },
  { name: "Pantoprazole 40mg", query: "Pantoprazole" },
  { name: "Azithromycin 500mg", query: "Azithromycin" },
  { name: "Cetirizine 10mg", query: "Cetirizine" },
  { name: "Dolo 650mg", query: "Dolo" },
];

export default function SubstituteFinderModal({ isOpen, onClose, initialQuery = "", onSelectSubstitute }) {
  const [query, setQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [originalMed, setOriginalMed] = useState(null);
  const [substitutes, setSubstitutes] = useState([]);
  const [targetSalt, setTargetSalt] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery);
        handleSearch(initialQuery);
      } else {
        setQuery("");
        setOriginalMed(null);
        setSubstitutes([]);
        setTargetSalt("");
        setSearched(false);
      }
    }
  }, [isOpen, initialQuery]);

  const handleSearch = async (searchTerm = query) => {
    if (!searchTerm || !searchTerm.trim()) {
      showSimpleToast("Search Empty", "Please enter a medicine brand or salt composition.", "warning");
      return;
    }

    setIsLoading(true);
    setSearched(true);
    try {
      const res = await medicineApi.getSubstitutes(searchTerm);
      if (res.data && res.data.success) {
        setOriginalMed(res.data.original);
        setSubstitutes(res.data.substitutes || []);
        setTargetSalt(res.data.targetSalt || searchTerm);
      }
    } catch (err) {
      console.error("Substitute search failed:", err);
      showSimpleToast("Search Error ❌", "Failed to lookup substitutes.", "danger");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop show"
      id="substitute-finder-modal"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        background: "rgba(11, 15, 25, 0.75)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="modal-card"
        style={{
          width: "min(780px, 94vw)",
          maxWidth: "780px",
          maxHeight: "90vh",
          margin: "auto",
          overflowY: "auto",
          position: "relative",
          borderRadius: "16px",
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0 }}>🧪 Salt & Substitute Finder</h3>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "var(--success)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                }}
              >
                Alternative Medicine Engine
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Find 100% equivalent in-stock medicines by drug salt / composition
            </span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* SEARCH BAR */}
        <div style={{ padding: "20px 24px 0 24px" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            style={{ display: "flex", gap: "10px" }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <i
                className="fa-solid fa-flask"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--primary)",
                  fontSize: "15px",
                }}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type brand (e.g. Dolo 650) or salt (e.g. Paracetamol)..."
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  fontSize: "14px",
                  borderRadius: "10px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ padding: "10px 20px", fontSize: "14px", fontWeight: 600 }}
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: "6px" }} />
                  Searching...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-magnifying-glass" style={{ marginRight: "6px" }} />
                  Find Substitutes
                </>
              )}
            </button>
          </form>

          {/* QUICK SUGGESTION PILLS */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>Quick Salts:</span>
            {POPULAR_SALTS.map((item) => (
              <button
                key={item.name}
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setQuery(item.query);
                  handleSearch(item.query);
                }}
                style={{
                  padding: "3px 10px",
                  fontSize: "11.5px",
                  borderRadius: "14px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                }}
              >
                💊 {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* RESULTS SECTION */}
        <div style={{ padding: "20px 24px", maxHeight: "420px", overflowY: "auto" }}>
          {searched && (
            <>
              {/* ORIGINAL / SEARCHED SUMMARY CARD */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: "12px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-color)",
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Searched Item / Active Salt
                  </span>
                  <h4 style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {originalMed ? originalMed.name : query}
                  </h4>
                  <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                    🧪 Salt: {targetSalt || "General Composition"}
                  </span>
                </div>

                <div>
                  {originalMed ? (
                    <span
                      style={{
                        padding: "5px 12px",
                        borderRadius: "14px",
                        fontSize: "12px",
                        fontWeight: 700,
                        background: originalMed.quantity > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: originalMed.quantity > 0 ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${originalMed.quantity > 0 ? "var(--success)" : "var(--danger)"}`,
                      }}
                    >
                      {originalMed.quantity > 0 ? `In Stock (${originalMed.quantity} available)` : "❌ Out of Stock"}
                    </span>
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Drug Composition Query</span>
                  )}
                </div>
              </div>

              {/* SUBSTITUTES HEADING */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                  Available Equivalent Substitutes in Stock ({substitutes.length})
                </h4>
                {substitutes.length > 0 && (
                  <span style={{ fontSize: "11.5px", color: "var(--success)", fontWeight: 600 }}>
                    ✨ Same Salt Composition & Therapeutic Action
                  </span>
                )}
              </div>

              {/* SUBSTITUTES CARDS LIST */}
              {substitutes.length === 0 ? (
                <div
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    background: "var(--bg-input)",
                    borderRadius: "12px",
                    border: "1px dashed var(--border-color)",
                  }}
                >
                  <i className="fa-solid fa-boxes-stacked" style={{ fontSize: "32px", color: "var(--text-muted)", marginBottom: "10px" }} />
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    No alternative medicines currently in stock for "{targetSalt}"
                  </p>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Try searching a different salt or add new stock in Inventory.
                  </span>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {substitutes.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        padding: "14px 18px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                        transition: "transform 0.2s, border-color 0.2s",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {sub.name}
                          </h4>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "10.5px",
                              fontWeight: 600,
                              background: "rgba(99, 102, 241, 0.12)",
                              color: "#818cf8",
                            }}
                          >
                            {sub.category || "Tablet"}
                          </span>
                        </div>

                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                          <span>📦 Batch: <strong>{sub.batch}</strong></span>
                          <span>🧪 Salt: <strong>{sub.composition || targetSalt}</strong></span>
                          <span>🗓️ Exp: <strong>{sub.expiryDate}</strong></span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--success)" }}>
                            ₹{Number(sub.price).toFixed(2)} <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-muted)" }}>MRP</span>
                          </div>
                          <span style={{ fontSize: "11.5px", color: "var(--primary)", fontWeight: 600 }}>
                            {sub.quantity} units available
                          </span>
                        </div>

                        {onSelectSubstitute && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              onSelectSubstitute(sub);
                              showSimpleToast("Substitute Added 🛒", `Added "${sub.name}" to POS Bill Cart!`, "success");
                              onClose();
                            }}
                            style={{ padding: "8px 14px", fontSize: "12.5px", fontWeight: 600 }}
                          >
                            <i className="fa-solid fa-cart-plus" style={{ marginRight: "6px" }} />
                            Add to Bill
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
