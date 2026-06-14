import axios from "axios";

// Dedicated axios for auth endpoints — avoids circular dependency with api.js
const apiBase =
  (import.meta.env.VITE_API_URL || window.location.origin) +
  (/(\/api)$/.test(import.meta.env.VITE_API_URL || "") ? "" : "/api");

const authAxios = axios.create({ baseURL: apiBase });

const AUTH_KEYS = ["access", "refresh", "fullName", "role", "email", "translationHistory"];

const authService = {
  async login(email, password) {
    const res = await authAxios.post("/auth/login/", { email, password });
    const { access, refresh, user } = res.data;
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("fullName", `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim());
    localStorage.setItem("email", user.email ?? "");
    localStorage.setItem("role", user.role ?? "");
    return res.data;
  },

  async logout() {
    const refresh = localStorage.getItem("refresh");
    const access = localStorage.getItem("access");
    try {
      if (refresh) {
        await authAxios.post(
          "/auth/logout/",
          { refresh },
          { headers: access ? { Authorization: `Bearer ${access}` } : {} },
        );
      }
    } catch {
      // Best-effort: always clear locally
    }
    this.clearTokens();
    window.location.href = "/login";
  },

  clearTokens() {
    AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
  },

  getAccessToken: () => localStorage.getItem("access"),
  getRefreshToken: () => localStorage.getItem("refresh"),
  isAuthenticated: () => !!localStorage.getItem("access"),
};

export default authService;
