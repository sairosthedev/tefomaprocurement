import axios from 'axios';

const DEFAULT_API_URL = 'https://fossil-procure-api.vercel.app/api';

const baseURL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

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
      url.includes('/auth/login') || url.includes('/auth/register');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default http;
