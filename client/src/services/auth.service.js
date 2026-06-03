import http from './http';

export const authAPI = {
  login: (credentials) => http.post('/auth/login', credentials),
  register: (data) => http.post('/auth/register', data),
  getMe: () => http.get('/auth/me')
};
