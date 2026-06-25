import api from './api';

export const languageService = {
  getAllLanguages: () =>
    api.get('/languages/').then(res => res.data),

  getMyCompanyLanguages: () =>
    api.get('/languages/my-company/').then(res => res.data),

  getCompanyLanguages: (companyId) =>
    api.get(`/companies/${companyId}/languages/`).then(res => res.data),

  enableLanguage: (companyId, langId) =>
    api.post(`/companies/${companyId}/languages/${langId}/enable/`).then(res => res.data),

  disableLanguage: (companyId, langId) =>
    api.post(`/companies/${companyId}/languages/${langId}/disable/`).then(res => res.data),

  setDefaultLanguage: (companyId, langId) =>
    api.post(`/companies/${companyId}/languages/${langId}/set-default/`).then(res => res.data),

  addLanguage: (companyId, data) =>
    api.post(`/companies/${companyId}/languages/add/`, data).then(res => res.data),

  getAuditLog: (companyId) =>
    api.get(`/companies/${companyId}/languages/audit-log/`).then(res => res.data),
};
