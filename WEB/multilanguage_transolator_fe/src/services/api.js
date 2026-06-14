import axios from "axios";

const apiBase =
  (import.meta.env.VITE_API_URL || window.location.origin) +
  (/(\/api)$/.test(import.meta.env.VITE_API_URL || "") ? "" : "/api");

const api = axios.create({ baseURL: apiBase });

// ── Request: normalize URL + attach JWT ──────────────────────────────────────
api.interceptors.request.use((config) => {
  try {
    const endsWithApi = (config.baseURL || "").replace(/\/$/, "").endsWith("/api");
    if (endsWithApi && typeof config.url === "string") {
      config.url = config.url.replace(/^\/api\//, "/");
    }
  } catch (e) {
    console.debug("URL normalization failed:", e.message);
  }

  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: auto-refresh on 401, then retry ────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

function clearAndRedirect() {
  ["access", "refresh", "fullName", "role", "email", "translationHistory"].forEach(
    (k) => localStorage.removeItem(k),
  );
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const orig = error.config;

    if (error.response?.status !== 401 || orig._retry) {
      return Promise.reject(error);
    }

    // Avoid retry loop on auth endpoints themselves
    if (orig.url?.includes("/auth/")) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject })).then(
        (token) => {
          orig.headers.Authorization = `Bearer ${token}`;
          return api(orig);
        },
      );
    }

    orig._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) {
      clearAndRedirect();
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      // Use plain axios to avoid recursive interceptor
      const { data } = await axios.post(`${apiBase}/auth/refresh/`, { refresh: refreshToken });
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      orig.headers.Authorization = `Bearer ${data.access}`;
      processQueue(null, data.access);
      return api(orig);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAndRedirect();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
