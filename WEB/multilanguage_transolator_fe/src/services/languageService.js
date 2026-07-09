import api from './api';

export const languageService = {
  getEnabledLanguages: () =>
    api.get('/languages/').then(res => res.data),
};
