import api from "./api";

const keywordService = {
  // ─── Private Library ───────────────────────────────────────────────────────

  getPrivateKeywords: () => api.get("/api/keywords/private/"),

  createPrivateKeyword: (data) => api.post("/api/keywords/private/", data),

  updatePrivateKeyword: (id, data) =>
    api.put(`/api/keywords/private/${id}/`, data),

  deletePrivateKeyword: (id) => api.delete(`/api/keywords/private/${id}/`),

  suggestPrivateKeywords: (ids) =>
    api.post("/api/keywords/private/suggest/", { ids }),

  // ─── Common Library / Suggestions ──────────────────────────────────────────

  getSuggestions: (params) => api.get("/api/keywords/suggestions/", { params: params || {} }),

  createSuggestion: (data) => api.post("/api/keywords/suggestions/", data),

  updateSuggestion: (id, data) =>
    api.put(`/api/keywords/suggestions/${id}/review/`, data),

  approveSuggestion: (id, data) =>
    api.post(`/api/keywords/suggestions/${id}/approve/`, data || {}),

  getSuggestionQueue: (params) =>
    api.get("/api/keywords/suggestions/queue/", { params: params || {} }),

  getSuggestionQueueSettings: () =>
    api.get("/api/keywords/suggestions/queue-settings/"),

  patchSuggestionQueueSettings: (minSuggestersForQueue) =>
    api.patch("/api/keywords/suggestions/queue-settings/", {
      min_suggesters_for_queue: minSuggestersForQueue,
    }),

  deleteKeyword: (id) => api.delete(`/api/keywords/${id}/delete/`),

  updateKeyword: (id, data) => api.put(`/api/keywords/${id}/update/`, data),

  // ─── Duplicate Alerts ────────────────────────────────────────────────────

  getDuplicateAlerts: () => api.get("/api/keywords/duplicate-alerts/"),

  dismissDuplicateAlert: (notificationId) =>
    api.post(`/api/keywords/duplicate-alerts/${notificationId}/dismiss/`),

  // ─── GCS ───────────────────────────────────────────────────────────────────

  getGCSStatus: () => api.get("/api/keywords/gcs-status/"),

  uploadToGCS: () => api.post("/api/keywords/upload-to-gcs/"),

  // ─── Queue ─────────────────────────────────────────────────────────────────

  getQueueStatus: (params) =>
    api.get("/api/keywords/queue/status/", { params }),
};

export default keywordService;
