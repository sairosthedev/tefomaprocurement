import type { CorsOptions } from 'cors';
import { DEFAULT_CLIENT_URL } from '../lib/branding.js';
import { sbuByDomain } from '../tenancy/registry.js';
import { connectToDatabase } from './db.js';

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
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

/**
 * Origins proved to belong to an SBU, remembered once the registry has
 * confirmed them.
 *
 * Every SBU's domain is a legitimate origin, and there are as many of them as
 * there are business units — listing them in CORS_ORIGINS would mean editing an
 * environment variable every time one is added. The registry already knows, so
 * it is the source of truth here too.
 *
 * The cache exists because `applyCorsHeaders` has nowhere to await: it runs on
 * the error path of a failed database connection, where asking the database
 * which origins are valid is precisely what cannot be done.
 */
const registryOrigins = new Set<string>();

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalised = origin.replace(/\/$/, '');
  return allowedOrigins.has(normalised) || registryOrigins.has(normalised);
}

/** Does this origin's hostname belong to an SBU? Caches the answer. */
async function isSbuOrigin(origin: string): Promise<boolean> {
  const normalised = origin.replace(/\/$/, '');
  if (registryOrigins.has(normalised)) return true;

  try {
    // Connect first. This runs before any other middleware, and on serverless
    // the connection is opened lazily by a guard further down the chain that
    // skips OPTIONS altogether — so without this the registry is always
    // unreachable here, every preflight is declined, and every SBU domain is
    // blocked by the browser while curl sees a perfectly healthy API.
    await connectToDatabase();

    const sbu = await sbuByDomain(origin);
    if (!sbu) return false;
    registryOrigins.add(normalised);
    return true;
  } catch {
    // The registry is genuinely unreachable. Refusing is the safe answer, and
    // the request was going to fail at the database anyway.
    return false;
  }
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

    isSbuOrigin(origin).then((allowed) => {
      // `false` rather than an Error: an unknown origin is not a server fault,
      // and throwing here produced a 500 whose body carried a stack trace with
      // local file paths in it. Declining simply omits the CORS headers, which
      // is what the browser needs to see.
      callback(null, allowed);
    });
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Sbu-Code'],
  optionsSuccessStatus: 204
};
