import api from "./api";

const notificationService = {
  getNotifications: () => api.get("/api/notifications/"),

  markAsRead: (id) => api.post(`/api/notifications/${id}/read/`),

  markMultipleAsRead: (ids) =>
    Promise.all(ids.map((id) => api.post(`/api/notifications/${id}/read/`))),

  createNotification: (data) => api.post("/api/notifications/create/", data),

  createNotificationForAll: (data) =>
    api.post("/api/notifications/create-for-all/", data),
};

export default notificationService;
