import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

/** In-flight GET dedupe — identical requests share one network call */
const inflightGets = new Map();

function stableParamsKey(params) {
  if (!params || typeof params !== "object") return "";
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function dedupedGet(url, config = {}) {
  const key = `${url}?${stableParamsKey(config.params)}`;
  if (inflightGets.has(key)) return inflightGets.get(key);

  const request = api.get(url, config).finally(() => {
    inflightGets.delete(key);
  });

  inflightGets.set(key, request);
  return request;
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("anika_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const simulatedDate = localStorage.getItem("anika_simulated_date");
    if (simulatedDate) config.headers["x-simulated-date"] = simulatedDate;

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes("/auth/login");
      if (!isLoginRequest) {
        const token = localStorage.getItem("anika_token");
        if (token) {
          localStorage.removeItem("anika_token");
          localStorage.setItem("anika_auth", "false");
          window.location.hash = "/";
          window.dispatchEvent(
            new CustomEvent("unauthorized", {
              detail: { sessionExpired: true },
            }),
          );
        }
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  verifyOtp: (email, otp) => api.post("/auth/verify-otp", { email, otp }),
  resetPassword: (email, otp, newPassword, confirmPassword) =>
    api.post("/auth/reset-password", {
      email,
      otp,
      newPassword,
      confirmPassword,
    }),
  updatePassword: (currentPassword, newPassword, confirmPassword) =>
    api.post("/auth/update-password", {
      currentPassword,
      newPassword,
      confirmPassword,
    }),
};

export const medicineApi = {
  getAll: (params = {}) => dedupedGet("/medicines", { params }),
  getCounts: (params = {}) => dedupedGet("/medicines/counts", { params }),
  getSubstitutes: (query) => dedupedGet("/medicines/substitutes", { params: { query } }),
  add: (data) => api.post("/medicines", data),
  update: (id, data) => api.put(`/medicines/${id}`, data),
  delete: (id) => api.delete(`/medicines/${id}`),
  updateStatus: (id, status) =>
    api.patch(`/medicines/${id}/status`, { status }),
};

export const notificationApi = {
  getAll: (params = {}) => dedupedGet("/notifications", { params }),
  markAllRead: () => api.patch("/notifications/mark-all-read"),
  clearAll: () => api.delete("/notifications"),
};

export const dashboardApi = {
  getStats: () => dedupedGet("/dashboard/stats"),
};

export const billApi = {
  create: (data) => api.post("/bills", data),
  getAll: (params = {}) => dedupedGet("/bills", { params }),
  getStats: () => dedupedGet("/bills/stats"),
  delete: (id) => api.delete(`/bills/${id}`),
};

export const supplierApi = {
  getAll: (params = {}) => dedupedGet("/suppliers", { params }),
  getById: (id) => dedupedGet(`/suppliers/${id}`),
  add: (data) => api.post("/suppliers", data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
  getTransactions: (id, params = {}) =>
    dedupedGet(`/suppliers/${id}/transactions`, { params }),
  addTransaction: (id, data) => api.post(`/suppliers/${id}/transactions`, data),
  syncFromStockists: () => api.post("/suppliers/sync-from-stockists"),
};

export const customerApi = {
  getAll: (params = {}) => dedupedGet("/customers", { params }),
  getById: (id) => dedupedGet(`/customers/${id}`),
  lookupByMobile: (mobile) => dedupedGet(`/customers/lookup/${mobile}`),
  add: (data) => api.post("/customers", data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  syncFromBills: () => api.post("/customers/sync-from-bills"),
};

export const ocrApi = {
  scanBill: (imageBase64, mimeType) =>
    api.post("/ocr/scan-bill", { imageBase64, mimeType }, { timeout: 45000 }),
};

export default api;
