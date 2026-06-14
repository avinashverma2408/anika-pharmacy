import axios from 'axios';

// Axios instance — uses VITE_API_URL in production, falls back to /api in dev (proxied to port 5000)
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
});

// ── Request interceptor: attach JWT token & simulated date ──────────────────
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('anika_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const simulatedDate = localStorage.getItem('anika_simulated_date');
        if (simulatedDate) {
            config.headers['x-simulated-date'] = simulatedDate;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 (token expired) ───────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const isLoginRequest = error.config?.url?.includes('/auth/login');
            if (!isLoginRequest) {
                localStorage.removeItem('anika_token');
                localStorage.setItem('anika_auth', 'false');
                window.location.hash = '/login';
                window.dispatchEvent(new CustomEvent('unauthorized', { detail: { sessionExpired: true } }));
            }
        }
        return Promise.reject(error);
    }
);

// ── Auth API ────────────────────────────────────────────────────────────────
export const authApi = {
    login: (email, password) =>
        api.post('/auth/login', { email, password }),

    forgotPassword: (email) =>
        api.post('/auth/forgot-password', { email }),

    verifyOtp: (email, otp) =>
        api.post('/auth/verify-otp', { email, otp }),

    resetPassword: (email, otp, newPassword, confirmPassword) =>
        api.post('/auth/reset-password', { email, otp, newPassword, confirmPassword }),

    updatePassword: (currentPassword, newPassword, confirmPassword) =>
        api.post('/auth/update-password', { currentPassword, newPassword, confirmPassword })
};

// ── Medicine API ─────────────────────────────────────────────────────────────
export const medicineApi = {
    getAll: (params = {}) =>
        api.get('/medicines', { params }),

    getCounts: (params = {}) =>
        api.get('/medicines/counts', { params }),

    add: (data) =>
        api.post('/medicines', data),

    update: (id, data) =>
        api.put(`/medicines/${id}`, data),

    delete: (id) =>
        api.delete(`/medicines/${id}`),

    updateStatus: (id, status) =>
        api.patch(`/medicines/${id}/status`, { status })
};

// ── Notification API ─────────────────────────────────────────────────────────
export const notificationApi = {
    getAll: (params = {}) =>
        api.get('/notifications', { params }),

    markAllRead: () =>
        api.patch('/notifications/mark-all-read'),

    clearAll: () =>
        api.delete('/notifications')
};

// ── Dashboard API ─────────────────────────────────────────────────────────────
export const dashboardApi = {
    getStats: () =>
        api.get('/dashboard/stats')
};

// ── Bill API ──────────────────────────────────────────────────────────────────
export const billApi = {
    create: (data) =>
        api.post('/bills', data),
    getAll: (params = {}) =>
        api.get('/bills', { params }),
    getStats: () =>
        api.get('/bills/stats'),
    delete: (id) =>
        api.delete(`/bills/${id}`)
};

export default api;
