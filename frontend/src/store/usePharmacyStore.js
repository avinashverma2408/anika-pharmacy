import { create } from "zustand";
import {
  authApi,
  medicineApi,
  notificationApi,
  dashboardApi,
  billApi,
} from "../api/apiClient";

// ── Auth Screen <-> Hash Route Map ──────────────────────────────────────────
export const AUTH_SCREEN_TO_HASH = {
  login: "/",
  forgot: "/forgot-password",
  otp: "/verify-otp",
  reset: "/create-password",
  success: "/success",
};
export const AUTH_HASH_TO_SCREEN = Object.fromEntries(
  Object.entries(AUTH_SCREEN_TO_HASH).map(([k, v]) => [v, k]),
);

import {
  getLocalDateString,
  addDays,
  calculateDaysDifference,
  formatDateDisplay,
  formatDateTimeDisplay,
  getExpiryStatus,
  generateOTP,
} from "../../../shared/sharedUtils.js";

export {
  getLocalDateString,
  addDays,
  calculateDaysDifference,
  formatDateDisplay,
  formatDateTimeDisplay,
  getExpiryStatus,
  generateOTP,
};

// Sound synthesis helper using Web Audio API
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();

    const playBeep = (freq, duration, startTime) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.02); // fade in to reduce pop
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // fade out

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    // Play double beep
    playBeep(880, 0.15, now);
    playBeep(1046.5, 0.2, now + 0.12);
  } catch (err) {
    console.warn("Notification sound playback was blocked or failed:", err);
  }
}

// ── Toast System ─────────────────────────────────────────────────────────────
function showInAppToast(notif) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${notif.severity}`;

  let iconClass = "fa-bell";
  if (notif.severity === "critical") iconClass = "fa-circle-xmark";
  else if (notif.severity === "orange") iconClass = "fa-triangle-exclamation";
  else if (notif.severity === "warning") iconClass = "fa-circle-exclamation";

  toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-body">
            <div class="toast-title">${notif.severity.toUpperCase()} ALERT</div>
            <div class="toast-message">${notif.message}</div>
            <div class="toast-message" style="font-style:italic;font-size:11px;margin-top:2px;color:var(--text-muted);">${notif.hindiMessage}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
  container.appendChild(toast);
  const timer = setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s forwards";
    setTimeout(() => toast.remove(), 300);
  }, 8000);
  toast.querySelector(".toast-close").addEventListener("click", () => {
    clearTimeout(timer);
    toast.remove();
  });
}

export function showSimpleToast(title, message, severity = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${severity}`;
  const iconClass =
    severity === "danger" ? "fa-circle-xmark" : "fa-circle-check";

  toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
  toast
    .querySelector(".toast-close")
    .addEventListener("click", () => toast.remove());
}

function shakeBellIcon() {
  const btn = document.getElementById("notif-bell-btn");
  if (!btn) return;
  const icon = btn.querySelector("i");
  if (icon) {
    icon.classList.add("shake-bell");
    setTimeout(() => icon.classList.remove("shake-bell"), 600);
  }
}

// ── Initial State from localStorage ─────────────────────────────────────────
const loadInitialState = () => {
  const storedTheme = localStorage.getItem("anika_theme") || "dark";
  const storedAuth = localStorage.getItem("anika_auth") === "true";
  const todayStr = getLocalDateString(new Date());

  document.documentElement.setAttribute("data-theme", storedTheme);

  return {
    // Auth
    isAuthenticated: storedAuth,
    authScreen: "login",
    authEmail: "",
    isLogoutModalOpen: false,

    // Data (loaded from API)
    medicines: [],
    notifications: [],
    dashboardStats: null,

    // Simulator (local only — for testing expiry alerts without waiting for real dates)
    simulatedDate: localStorage.getItem("anika_simulated_date") || todayStr,

    // UI state
    theme: storedTheme,
    activeTab: "dashboard",
    inventorySubTab: "active",
    inventoryCategoryFilter: "all",
    editingProduct: null,
    deletingProduct: null,
    isAddModalOpen: false,
    isEditModalOpen: false,
    isDeleteModalOpen: false,
    selectedMedicineForDetails: null,
    globalSearchQuery: "",

    // Bills state
    bills: [],
    billStats: null,

    // Loading states
    isLoadingMedicines: false,
    isLoadingNotifications: false,
    isLoadingStats: false,
    isLoadingAuth: false,
    isSavingMedicine: false,
    isDeletingMedicine: false,
    isLoadingBills: false,
  };
};

export const usePharmacyStore = create((set, get) => ({
  ...loadInitialState(),

  // ── Auth Actions ─────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoadingAuth: true });
    try {
      const { data } = await authApi.login(email, password);
      localStorage.setItem("anika_token", data.token);
      localStorage.setItem("anika_auth", "true");

      // Show toast FIRST (while auth container is still mounted)
      showSimpleToast(
        "Login Successful",
        "Welcome to Anika Pharmacy! 🎉",
        "success",
      );

      // Small delay so toast renders before component unmounts
      setTimeout(() => {
        set({ isAuthenticated: true, isLoadingAuth: false });
        window.location.hash = "/dashboard";
      }, 600);

      return { success: true };
    } catch (err) {
      set({ isLoadingAuth: false });

      let msg;
      if (!err.response) {
        msg =
          "Cannot connect to server. Make sure the backend is running on port 5000.";
      } else if (err.response?.status === 401) {
        msg = err.response?.data?.message || "Invalid email or password.";
      } else {
        msg = err.response?.data?.message || "Login failed. Please try again.";
      }

      showSimpleToast("Login Failed", msg, "danger");
      return { success: false, message: msg };
    }
  },

  logout: (sessionExpired = false) => {
    // Show toast BEFORE unmounting dashboard (toast-container must exist in DOM)
    if (sessionExpired) {
      showSimpleToast("Session Expired", "Please login again.", "danger");
    } else {
      showSimpleToast(
        "Logged Out",
        "Admin logout successfully",
        "success",
      );
    }
    localStorage.removeItem("anika_token");
    localStorage.setItem("anika_auth", "false");
    window.location.hash = "/";
    set({
      isAuthenticated: false,
      authScreen: "login",
      authEmail: "",
      isLogoutModalOpen: false,
      medicines: [],
      notifications: [],
      dashboardStats: null,
    });
  },

  sendOtp: async (email) => {
    set({ isLoadingAuth: true });
    try {
      const { data } = await authApi.forgotPassword(email);
      set({ authEmail: email, authScreen: "otp", isLoadingAuth: false });
      window.location.hash = "/verify-otp";
      showSimpleToast(
        "OTP Sent",
        data.message || "Check your email for the OTP code.",
        "success",
      );
      return { success: true };
    } catch (err) {
      set({ isLoadingAuth: false });
      const msg = err.response?.data?.message || "Failed to send OTP.";
      // Handle validation errors
      const errors = err.response?.data?.errors;
      if (errors?.length) {
        errors.forEach((e) =>
          showSimpleToast("Validation Error", e.message, "danger"),
        );
      } else {
        showSimpleToast("Error", msg, "danger");
      }
      return { success: false, message: msg };
    }
  },

  verifyOtp: async (otp) => {
    set({ isLoadingAuth: true });
    try {
      const email = get().authEmail;
      await authApi.verifyOtp(email, otp);
      set({ authScreen: "reset", isLoadingAuth: false });
      window.location.hash = "/create-password";
      showSimpleToast(
        "OTP Verified",
        "Please set your new password.",
        "success",
      );
      return { success: true };
    } catch (err) {
      set({ isLoadingAuth: false });
      const msg = err.response?.data?.message || "Invalid OTP.";
      showSimpleToast("Verification Failed", msg, "danger");
      return { success: false, message: msg };
    }
  },

  resetPassword: async (newPassword, confirmPassword) => {
    set({ isLoadingAuth: true });
    try {
      const { authEmail } = get();
      // We need the OTP stored; frontend re-sends it
      await authApi.resetPassword(
        authEmail,
        get()._lastOtp || "",
        newPassword,
        confirmPassword,
      );
      set({ authScreen: "success", isLoadingAuth: false });
      window.location.hash = "/success";
      showSimpleToast(
        "Password Reset",
        "Your password has been changed successfully.",
        "success",
      );
      return { success: true };
    } catch (err) {
      set({ isLoadingAuth: false });
      const msg = err.response?.data?.message || "Password reset failed.";
      const errors = err.response?.data?.errors;
      if (errors?.length) {
        errors.forEach((e) =>
          showSimpleToast("Validation Error", e.message, "danger"),
        );
      } else {
        showSimpleToast("Reset Failed", msg, "danger");
      }
      return { success: false, message: msg };
    }
  },

  // Store OTP temporarily (needed for reset step)
  setLastOtp: (otp) => set({ _lastOtp: otp }),

  setAuthScreen: (screen) => {
    const hash = AUTH_SCREEN_TO_HASH[screen];
    if (hash) window.location.hash = hash;
    set({ authScreen: screen });
  },

  syncAuthWithHash: () => {
    const hash = window.location.hash.replace("#", "");
    const screen = AUTH_HASH_TO_SCREEN[hash];
    if (screen && screen !== get().authScreen) {
      set({ authScreen: screen });
    }
  },

  setLogoutModalOpen: (isOpen) => set({ isLogoutModalOpen: isOpen }),

  updatePasswordInSettings: async (
    currentPassword,
    newPassword,
    confirmPassword,
  ) => {
    set({ isLoadingAuth: true });
    try {
      await authApi.updatePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      set({ isLoadingAuth: false });
      showSimpleToast(
        "Password Updated",
        "Your password has been updated successfully.",
        "success",
      );
      return true;
    } catch (err) {
      set({ isLoadingAuth: false });
      const msg = err.response?.data?.message || "Failed to update password.";
      const errors = err.response?.data?.errors;
      if (errors?.length) {
        errors.forEach((e) =>
          showSimpleToast("Validation Error", e.message, "danger"),
        );
      } else {
        showSimpleToast("Update Failed", msg, "danger");
      }
      return false;
    }
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  setActiveTab: (tab) => {
    window.location.hash = "/" + tab;
    const updates = { activeTab: tab };
    if (tab !== "inventory") {
      updates.globalSearchQuery = "";
      updates.inventoryCategoryFilter = "all";
    }
    set(updates);
  },

  setInventorySubTab: (tab) => {
    set({ inventorySubTab: tab });
  },

  setInventoryCategoryFilter: (category) => {
    set({ inventoryCategoryFilter: category });
  },

  syncTabWithHash: () => {
    const hash = window.location.hash.replace("#/", "");
    const validTabs = [
      "dashboard",
      "inventory",
      "calendar",
      "billing",
      "analytics",
      "simulator",
      "notifications-log",
      "settings",
    ];
    if (hash && validTabs.includes(hash) && hash !== get().activeTab) {
      const updates = { activeTab: hash };
      if (hash !== "inventory") {
        updates.globalSearchQuery = "";
        updates.inventoryCategoryFilter = "all";
      }
      set(updates);
    }
  },

  setGlobalSearchQuery: (query) => {
    const updates = { globalSearchQuery: query };
    if (query && get().activeTab !== "inventory") {
      updates.activeTab = "inventory";
      updates.inventorySubTab = "all";
      updates.inventoryCategoryFilter = "all";
      window.location.hash = "/inventory";
    }
    set(updates);
  },

  // ── Bills / Revenue Actions ────────────────────────────────────────────────
  fetchBills: async (params = {}) => {
    set({ isLoadingBills: true });
    try {
      const { data } = await billApi.getAll(params);
      if (data.success) {
        set({ bills: data.bills, isLoadingBills: false });
      } else {
        set({ isLoadingBills: false });
      }
    } catch (err) {
      set({ isLoadingBills: false });
      showSimpleToast("Error", "Failed to load billing history.", "danger");
    }
  },

  fetchBillStats: async () => {
    try {
      const { data } = await billApi.getStats();
      if (data.success) {
        set({ billStats: data.stats });
      }
    } catch (err) {
      console.error("Failed to load bill stats:", err);
    }
  },

  saveBillRecord: async (billData) => {
    try {
      const { data } = await billApi.create(billData);
      if (data.success) {
        // Refresh stats and history
        get().fetchBillStats();
        return { success: true, bill: data.bill };
      }
      return { success: false, message: data.message };
    } catch (err) {
      const msg =
        err.response?.data?.message || "Failed to save invoice record.";
      showSimpleToast("Database Save Error", msg, "danger");
      return { success: false, message: msg };
    }
  },

  deleteBillRecord: async (id) => {
    try {
      const { data } = await billApi.delete(id);
      if (data.success) {
        // Refresh list & stats
        get().fetchBills();
        get().fetchBillStats();
        showSimpleToast("Success", "Invoice deleted successfully.", "success");
        return true;
      }
      return false;
    } catch (err) {
      showSimpleToast("Error", "Failed to delete invoice.", "danger");
      return false;
    }
  },

  // ── Modal Toggles ─────────────────────────────────────────────────────────
  setAddModalOpen: (isOpen) => set({ isAddModalOpen: isOpen }),
  setEditModalOpen: (isOpen, product = null) =>
    set({ isEditModalOpen: isOpen, editingProduct: product }),
  setDeleteModalOpen: (isOpen, product = null) =>
    set({ isDeleteModalOpen: isOpen, deletingProduct: product }),
  setSelectedMedicineForDetails: (product) =>
    set({ selectedMedicineForDetails: product }),

  // ── Theme ─────────────────────────────────────────────────────────────────
  toggleTheme: () => {
    const nextTheme = get().theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("anika_theme", nextTheme);
    set({ theme: nextTheme });
  },

  // ── Simulator (local date simulation for testing alerts) ──────────────────
  setSimulatedDate: (dateStr) => {
    localStorage.setItem("anika_simulated_date", dateStr);
    set({ simulatedDate: dateStr });
    // Re-fetch data to reflect simulated date
    get().fetchNotifications();
    get().fetchDashboardStats();
    get().fetchMedicines();
  },

  // ── Medicine CRUD (API) ───────────────────────────────────────────────────
  fetchMedicines: async (params = {}) => {
    set({ isLoadingMedicines: true });
    try {
      const { data } = await medicineApi.getAll(params);
      set({ medicines: data.medicines, isLoadingMedicines: false });
    } catch (err) {
      set({ isLoadingMedicines: false });
      showSimpleToast("Error", "Failed to load medicines.", "danger");
    }
  },

  addMedicine: async (medData) => {
    set({ isSavingMedicine: true });
    try {
      const { data } = await medicineApi.add(medData);
      set((state) => ({
        medicines: [
          ...state.medicines,
          { ...data.medicine, id: data.medicine._id },
        ],
        isSavingMedicine: false,
        isAddModalOpen: false,
      }));
      // Refresh notifications after add
      get().fetchNotifications();
      showSimpleToast(
        "Medicine Added",
        `"${data.medicine.name}" added successfully.`,
        "success",
      );
      return true;
    } catch (err) {
      set({ isSavingMedicine: false });
      const errors = err.response?.data?.errors;
      if (errors?.length) {
        errors.forEach((e) =>
          showSimpleToast("Validation Error", e.message, "danger"),
        );
      } else {
        showSimpleToast(
          "Error",
          err.response?.data?.message || "Failed to add medicine.",
          "danger",
        );
      }
      return false;
    }
  },

  updateMedicine: async (id, medData) => {
    set({ isSavingMedicine: true });
    try {
      const { data } = await medicineApi.update(id, medData);
      set((state) => {
        const updatedMed = { ...data.medicine, id: data.medicine._id };
        const currentSelected = state.selectedMedicineForDetails;
        const newSelected =
          currentSelected?._id === id || currentSelected?.id === id
            ? updatedMed
            : currentSelected;
        return {
          medicines: state.medicines.map((m) =>
            m._id === id || m.id === id ? updatedMed : m,
          ),
          selectedMedicineForDetails: newSelected,
          isSavingMedicine: false,
          isEditModalOpen: false,
          editingProduct: null,
        };
      });
      get().fetchNotifications();
      showSimpleToast(
        "Medicine Updated",
        `"${data.medicine.name}" updated.`,
        "success",
      );
      return true;
    } catch (err) {
      set({ isSavingMedicine: false });
      const errors = err.response?.data?.errors;
      if (errors?.length) {
        errors.forEach((e) =>
          showSimpleToast("Validation Error", e.message, "danger"),
        );
      } else {
        showSimpleToast(
          "Error",
          err.response?.data?.message || "Failed to update.",
          "danger",
        );
      }
      return false;
    }
  },

  confirmDeleteMedicine: async () => {
    const { deletingProduct } = get();
    if (!deletingProduct) return;
    set({ isDeletingMedicine: true });
    try {
      const delId = deletingProduct._id || deletingProduct.id;
      await medicineApi.delete(delId);
      set((state) => {
        const currentSelected = state.selectedMedicineForDetails;
        const newSelected =
          currentSelected?._id === delId || currentSelected?.id === delId
            ? null
            : currentSelected;
        return {
          medicines: state.medicines.filter((m) => (m._id || m.id) !== delId),
          notifications: state.notifications.filter(
            (n) => String(n.medicineId) !== String(delId),
          ),
          selectedMedicineForDetails: newSelected,
          isDeleteModalOpen: false,
          deletingProduct: null,
          isDeletingMedicine: false,
        };
      });
      showSimpleToast(
        "Medicine Deleted",
        `"${deletingProduct.name}" was removed.`,
        "danger",
      );
    } catch (err) {
      set({ isDeletingMedicine: false });
      showSimpleToast("Error", "Failed to delete medicine.", "danger");
    }
  },

  updateMedicineStatus: async (id, newStatus) => {
    try {
      const { data } = await medicineApi.updateStatus(id, newStatus);
      set((state) => ({
        medicines: state.medicines.map((m) =>
          m._id === id || m.id === id
            ? { ...data.medicine, id: data.medicine._id }
            : m,
        ),
      }));
      showSimpleToast(
        "Status Changed",
        `Status updated to "${newStatus}".`,
        "success",
      );
    } catch (err) {
      showSimpleToast("Error", "Failed to update status.", "danger");
    }
  },

  checkoutBill: async (items) => {
    try {
      set({ isSavingMedicine: true });

      // Sequentially update each medicine's quantity
      for (const item of items) {
        const med = item.medicine;
        const newQty = Math.max(0, med.quantity - item.quantityBilled);
        const newStatus = newQty === 0 ? "Out of Stock" : med.status;

        await medicineApi.update(med._id || med.id, {
          name: med.name,
          category: med.category,
          batch: med.batch,
          price: med.price,
          quantity: newQty,
          expiryDate: med.expiryDate,
          status: newStatus,
          stockistName: med.stockistName,
          ptr: med.ptr,
          hsn: med.hsn,
          pack: med.pack,
          gstRate: med.gstRate,
        });
      }

      // Reload all medicines and stats
      await get().fetchMedicines();
      await get().fetchDashboardStats();
      await get().fetchNotifications();

      set({ isSavingMedicine: false });
      return true;
    } catch (err) {
      console.error("Checkout error:", err);
      set({ isSavingMedicine: false });
      showSimpleToast(
        "Checkout Failed",
        "Failed to update stock quantities.",
        "danger",
      );
      return false;
    }
  },

  // ── Notifications (API) ───────────────────────────────────────────────────
  fetchNotifications: async () => {
    set({ isLoadingNotifications: true });
    try {
      const { data } = await notificationApi.getAll();
      // Show in-app toasts for new unread notifications
      const currentNotifications = get().notifications;
      const prevIds = new Set(
        currentNotifications.map((n) => String(n._id || n.id)),
      );
      let hasNewToast = false;

      data.notifications.forEach((notif) => {
        if (!notif.read && !prevIds.has(String(notif._id || notif.id))) {
          showInAppToast(notif);
          hasNewToast = true;
        }
      });

      // Play sound if new alerts are shown (skip on initial store load when notifications are empty)
      if (hasNewToast && currentNotifications.length > 0) {
        playNotificationSound();
      }

      const hasNew = data.notifications.some((n) => !n.read);
      if (hasNew) shakeBellIcon();
      set({ notifications: data.notifications, isLoadingNotifications: false });
    } catch (err) {
      set({ isLoadingNotifications: false });
    }
  },

  markAllNotificationsRead: async () => {
    try {
      await notificationApi.markAllRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      }));
    } catch (err) {
      showSimpleToast(
        "Error",
        "Failed to mark notifications as read.",
        "danger",
      );
    }
  },

  clearNotifications: async () => {
    try {
      await notificationApi.clearAll();
      set({ notifications: [] });
      showSimpleToast("Cleared", "All notifications cleared.", "success");
    } catch (err) {
      showSimpleToast("Error", "Failed to clear notifications.", "danger");
    }
  },

  clearLogs: async () => {
    await get().clearNotifications();
  },

  // ── Dashboard Stats (API) ─────────────────────────────────────────────────
  fetchDashboardStats: async () => {
    set({ isLoadingStats: true });
    try {
      const { data } = await dashboardApi.getStats();
      set({ dashboardStats: data, isLoadingStats: false });
    } catch (err) {
      set({ isLoadingStats: false });
    }
  },

  // ── Legacy: Expiry Evaluate (now handled by backend cron) ────────────────
  // Kept to satisfy App.jsx; just triggers a notification fetch
  evaluateExpiries: async () => {
    await get().fetchNotifications();
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("unauthorized", (e) => {
    const sessionExpired = e.detail?.sessionExpired || false;
    usePharmacyStore.getState().logout(sessionExpired);
  });
}
