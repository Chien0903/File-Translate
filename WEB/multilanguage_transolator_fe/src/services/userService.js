import api from "./api";

const userService = {
  // ─── Auth ──────────────────────────────────────────────────────────────────

  login: (route, data, config) => api.post(route, data, config),

  register: (route, data, config) => api.post(route, data, config),

  // ─── User Management (Admin) ───────────────────────────────────────────────

  getUsers: () => api.get("/api/user/"),

  getUser: (id) => api.get(`/api/user/${id}/`),

  createUser: (data) => api.post("/api/user/register/", data),

  deleteUser: (id) => api.delete(`/api/user/${id}/delete/`),

  updateUserRole: (id, role) =>
    api.patch(`/api/user/${id}/update-role/`, { role }),

  // ─── Profile ───────────────────────────────────────────────────────────────

  getProfile: (config) => api.get("/api/user/profile/", config),

  updateProfile: (data, config) => api.patch("/api/user/profile/", data, config),

  // ─── Keyword Stats (Admin) ─────────────────────────────────────────────────

  getKeywordStats: (startDate, endDate, token) =>
    api.get("/admin/keyword-stats", {
      params: { start: startDate, end: endDate },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
};

export default userService;
