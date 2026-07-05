import axios from 'axios';
import { clearSession, hasStoredSession } from '../lib/session';

const baseURL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

const http = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

http.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

http.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    const url = error.config?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/verify-otp') ||
      url.includes('/auth/register');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      const hadSession = hasStoredSession();
      clearSession();

      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const onPublicAuthPage =
        path === '/' ||
        path.startsWith('/login') ||
        path.startsWith('/supplier/login') ||
        path.startsWith('/register');

      if (hadSession && !onPublicAuthPage && typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default http;
