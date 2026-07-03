import type { CorsOptions } from 'cors';
import { DEFAULT_CLIENT_URL } from '../lib/branding.js';

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173'
];

function parseAllowedOrigins(): Set<string> {
  const origins = new Set<string>([DEFAULT_CLIENT_URL, ...LOCAL_ORIGINS]);

  const clientUrl = process.env.CLIENT_URL?.trim();
  if (clientUrl) {
    origins.add(clientUrl.replace(/\/$/, ''));
  }

  const extra = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || [];
  extra.forEach((origin) => origins.add(origin.replace(/\/$/, '')));

  return origins;
}

const allowedOrigins = parseAllowedOrigins();

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins.has(origin.replace(/\/$/, ''));
}

export function applyCorsHeaders(origin: string | undefined, res: { setHeader(name: string, value: string): void }): void {
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
};
