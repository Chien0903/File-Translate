// services/albAuthService.ts (hoặc .js)

import api from "./api";

/**
 * Lưu ý: đảm bảo axios `api` được tạo với withCredentials: true
 *   const api = axios.create({ baseURL: "/", withCredentials: true, timeout: 15000 });
 */

class ALBAuthService {
  constructor() {
    this._initPromise = null;
  }

  /**
   * Gọi status; KHÔNG throw khi 302/401 để ta tự quyết định.
   */
  async checkALBAuth(signal) {
    try {
      const res = await api.get("/api/auth/alb/status/", {
        withCredentials: true,
        // đọc cả 3xx/4xx thay vì throw
        validateStatus: () => true,
        timeout: 10000, // 10 second timeout
        signal,
      });

      if (res.status === 200) return res.data; // { authenticated: true, user, ... }

      // Log non-200 responses for debugging production issues
      if (res.status !== 200) {
        console.debug(`ALB auth check returned ${res.status}:`, res.data);
      }

      return { authenticated: false, status: res.status }; // 302/401/403/…
    } catch (err) {
      // cross-domain redirect → ERR_NETWORK (không có res)
      const status = err?.response?.status ?? "network_error";

      // Log errors for production debugging
      if (err.name !== "AbortError") {
        // Don't log cancelled requests
        console.warn(`ALB auth check failed (${status}):`, err.message);
      }

      return { authenticated: false, status };
    }
  }

  async getUserPermissions() {
    try {
      const res = await api.get("/api/auth/alb/permissions/", {
        withCredentials: true,
        validateStatus: () => true,
      });
      if (res.status === 200) return res.data;
      return { permissions: {} }; // khi chưa auth hoặc 403
    } catch {
      return { permissions: {} };
    }
  }

  async logout() {
    try {
      const res = await api.post("/api/auth/alb/logout/", null, {
        withCredentials: true,
        validateStatus: () => true,
      });
      const logout_url = res.data?.logout_url ?? "/";
      this.clearLocalAuth();
      window.location.href = logout_url;
    } catch {
      this.clearLocalAuth();
      window.location.href = "/";
    }
  }

  clearLocalAuth() {
    try {
      localStorage.removeItem("fullName");
      localStorage.removeItem("role");
      localStorage.removeItem("email");
      localStorage.removeItem("auth_provider");
      // Xóa lịch sử dịch khi đăng xuất
      localStorage.removeItem("translationHistory");
    } catch {}
  }

  /**
   * Khởi tạo auth có retry/backoff nhỏ để tránh log “No auth”
   * do request đầu bị 302/ERR_NETWORK.
   */
  async initializeAuth() {
    // de-dupe nếu StrictMode gọi 2 lần
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      let last = null;

      for (let i = 0; i < 3; i++) {
        last = await this.checkALBAuth();
        if (last?.authenticated && last.user) {
          const user = last.user;
          try {
            const fullName = `${user.first_name ?? ""} ${
              user.last_name ?? ""
            }`.trim();
            localStorage.setItem("fullName", fullName);
            localStorage.setItem("email", user.email ?? "");
            localStorage.setItem("role", user.role ?? "");
            localStorage.setItem(
              "auth_provider",
              last.provider || "alb_cognito"
            );
          } catch {}
          return {
            authenticated: true,
            user: last.user,
            permissions: last.permissions,
            provider: last.provider || "alb_cognito",
          };
        }
        // chờ 300ms, 600ms, 900ms
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
      }

      return { authenticated: false, reason: last?.status ?? "unknown" };
    })().finally(() => {
      this._initPromise = null;
    });

    return this._initPromise;
  }

  async hasPermission(permission) {
    const data = await this.getUserPermissions();
    return Boolean(data?.permissions?.[permission]);
  }
}

export default new ALBAuthService();
