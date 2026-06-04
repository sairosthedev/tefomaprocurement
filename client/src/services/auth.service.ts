import http from './http';

export const authAPI = {
  login: (credentials: any) => http.post('/auth/login', credentials),
  register: (data: any) => http.post('/auth/register', data),
  getMe: () => http.get('/auth/me')
};
