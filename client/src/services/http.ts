import axios from 'axios';
import { clearSession, hasStoredSession } from '../lib/session';
import { getSbuCode } from '../lib/sbu';

/** Ensure production calls hit /api/auth/... not /auth/... */
function resolveApiBaseUrl(): string {
  const raw =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');
  const trimmed = String(raw).trim().replace(/\/$/, '');
  if (!trimmed) return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const baseURL = resolveApiBaseUrl();

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

    // Tells the API which business unit this request belongs to, for as long
    // as all SBUs share one domain. Once each has its own, the hostname
    // decides and this header is ignored.
    const sbuCode = getSbuCode();
    if (sbuCode) {
      config.headers['X-Sbu-Code'] = sbuCode;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

/** Fired after any successful write, so views that summarise data (the
 *  sidebar badges) can refresh straight away instead of polling hard. */
export const DATA_CHANGED_EVENT = 'procureline:data-changed';

http.interceptors.response.use(
  (response: any) => {
    const method = String(response.config?.method || 'get').toLowerCase();
    if (method !== 'get' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    }
    return response;
  },
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
