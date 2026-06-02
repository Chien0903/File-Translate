import api from "./api";

const translationService = {
  // ─── Text Translation ──────────────────────────────────────────────────────

  translateText: (payload) => api.post("/api/translate-text/", payload),

  // ─── File Translation ──────────────────────────────────────────────────────

  translateFile: (payload) => api.post("/api/translate/", payload),

  // ─── File Upload ───────────────────────────────────────────────────────────

  uploadToS3: (formData, config) =>
    api.post("/api/upload-to-s3/", formData, config),

  checkPdfEditable: (data) => api.post("/api/check-pdf-editable/", data),

  // ─── Format Conversion ─────────────────────────────────────────────────────

  convertFile: (payload) => api.post("/api/convert/", payload),

  // ─── History ───────────────────────────────────────────────────────────────

  getFileHistory: () => api.get("/api/translated-file/history/"),

  deleteFileHistory: (fileId) =>
    api.delete(`/api/translated-file/history/${fileId}/`),
};

export default translationService;
