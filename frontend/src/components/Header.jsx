import React, { useState, useEffect, useRef } from "react";
import {
  usePharmacyStore,
  formatDateDisplay,
  getLocalDateString,
} from "../store/usePharmacyStore";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

export default function Header() {
  const theme = usePharmacyStore((s) => s.theme);
  const toggleTheme = usePharmacyStore((s) => s.toggleTheme);
  const simulatedDate = usePharmacyStore((s) => s.simulatedDate);
  const setSimulatedDate = usePharmacyStore((s) => s.setSimulatedDate);
  const notifications = usePharmacyStore((s) => s.notifications);
  const clearNotifications = usePharmacyStore((s) => s.clearNotifications);
  const markAllNotificationsRead = usePharmacyStore(
    (s) => s.markAllNotificationsRead,
  );
  const setActiveTab = usePharmacyStore((s) => s.setActiveTab);
  const globalSearchQuery = usePharmacyStore((s) => s.globalSearchQuery);
  const setGlobalSearchQuery = usePharmacyStore((s) => s.setGlobalSearchQuery);

  const [searchDraft, setSearchDraft] = useState(globalSearchQuery);
  const debouncedSearch = useDebouncedValue(searchDraft, 280);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.reduce(
    (count, n) => count + (n.read ? 0 : 1),
    0,
  );

  useEffect(() => {
    setSearchDraft(globalSearchQuery);
  }, [globalSearchQuery]);

  useEffect(() => {
    if (debouncedSearch !== globalSearchQuery) {
      setGlobalSearchQuery(debouncedSearch);
    }
  }, [debouncedSearch, globalSearchQuery, setGlobalSearchQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBellClick = () => {
    setIsDropdownOpen((open) => {
      const next = !open;
      if (next) markAllNotificationsRead();
      return next;
    });
  };

  const todayStr = getLocalDateString(new Date());

  return (
    <header className="top-bar">
      <div className="header-search">
        <i className="fa-solid fa-magnifying-glass"></i>
        <input
          type="search"
          id="global-search"
          placeholder="Search medicines, batch numbers..."
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="header-actions">
        <div
          className="notification-bell-container"
          id="notif-bell-btn"
          ref={dropdownRef}
        >
          <button
            className="icon-btn"
            aria-label="View Notifications"
            onClick={handleBellClick}
          >
            <i className="fa-solid fa-bell"></i>
            {unreadCount > 0 && (
              <span className="badge" id="notif-count">
                {unreadCount}
              </span>
            )}
          </button>

          <div
            className={`notif-dropdown ${isDropdownOpen ? "show" : ""}`}
            id="notif-dropdown"
          >
            <div className="dropdown-header">
              <h3>Notifications</h3>
              <button
                id="clear-all-notif-btn"
                className="text-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  clearNotifications();
                }}
              >
                Clear All
              </button>
            </div>
            <div className="dropdown-list" id="notif-dropdown-list">
              {notifications.length === 0 ? (
                <div className="empty-state">No notifications</div>
              ) : (
                notifications.slice(0, 5).map((n) => {
                  let iconBg = "bg-primary";
                  let icon = "fa-bell";
                  if (n.severity === "orange") {
                    iconBg = "bg-warning";
                    icon = "fa-triangle-exclamation";
                  }

                  return (
                    <div
                      key={n.id || n._id}
                      className={`dropdown-item ${n.read ? "read" : "unread"}`}
                    >
                      <div className={`dropdown-item-icon ${iconBg}`}>
                        <i className={`fa-solid ${icon}`}></i>
                      </div>
                      <div className="dropdown-item-content">
                        <div>
                          <strong>{n.medicineName}</strong> ({n.batch})
                        </div>
                        <div style={{ fontSize: "12px", marginTop: "2px" }}>
                          {n.message}
                        </div>
                        <div className="dropdown-item-meta">
                          <span>{n.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="dropdown-footer">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("notifications-log");
                  setIsDropdownOpen(false);
                }}
              >
                View All Logs
              </a>
            </div>
          </div>
        </div>

        <button
          className="icon-btn"
          id="theme-toggle-btn"
          aria-label="Toggle Theme"
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <i className="fa-solid fa-moon moon-icon"></i>
          ) : (
            <i className="fa-solid fa-sun sun-icon"></i>
          )}
        </button>

        <div className="date-card">
          <i className="fa-solid fa-calendar-days"></i>
          <div className="date-details">
            <span className="date-label">System Date</span>
            <span className="date-value" id="current-system-date">
              {formatDateDisplay(simulatedDate)}
            </span>
          </div>
          {simulatedDate !== todayStr && (
            <button
              className="reset-system-date-btn"
              onClick={() => setSimulatedDate(todayStr)}
              title="Reset to real system date"
            >
              <i className="fa-solid fa-clock-rotate-left"></i>
              Back to Safety
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
