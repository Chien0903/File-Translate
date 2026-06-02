import axios from "axios";

const apiBase =
  (import.meta.env.VITE_API_URL || window.location.origin) +
  (/(\/api)$/.test(import.meta.env.VITE_API_URL || "") ? "" : "/api");

// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
//   withCredentials: true,
// });

const api = axios.create({
  // Use same-origin (or configured) base URL ending with /api
  baseURL: apiBase,
  withCredentials: true,
});

// Normalize URL to avoid double path issues
api.interceptors.request.use((config) => {
  try {
    // If baseURL already has /api and url also begins with /api, drop the duplicate prefix
    const endsWithApi = (config.baseURL || "")
      .replace(/\/$/, "")
      .endsWith("/api");
    if (endsWithApi && typeof config.url === "string") {
      config.url = config.url.replace(/^\/api\//, "/");
    }
  } catch (error) {
    // Ignore URL normalization errors
    console.debug("URL normalization failed:", error.message);
  }
  return config;
});

export default api;
