import http from './http';

export const authAPI: any = {
  login: (credentials: any) => http.post('/auth/login', credentials),
  verifyOtp: (data: any) => http.post('/auth/verify-otp', data),
  register: (data: any) => http.post('/auth/register', data),
  getMe: () => http.get('/auth/me'),
  updateProfile: (data: any) => http.put('/auth/profile', data),
  changePassword: (data: any) => http.put('/auth/change-password', data),
  forgotPassword: (data: any) => http.post('/auth/forgot-password', data),
  resetPassword: (data: any) => http.post('/auth/reset-password', data)
};
