/**
 * Load environment files. Import this once, first, from an entrypoint.
 *
 * There must be exactly one place that reads .env files. ES modules hoist every
 * `import` above the importing module's own statements, so a `dotenv.config()`
 * sitting at the top level of any imported module runs BEFORE the entrypoint's
 * own loading code. When that stray call pointed at plain `.env`, it populated
 * process.env with the shared defaults first — and because dotenv never
 * overwrites a variable that is already set, every per-environment file loaded
 * afterwards was silently ignored. A developer running APP_ENV=development
 * would connect to whatever database `.env` named, with no error to show for it.
 *
 * Keeping the loading here, and importing this module before anything else,
 * removes the ordering question entirely.
 *
 * Precedence, highest first:
 *   1. Real environment variables (Vercel, CI, the shell) — dotenv never
 *      overwrites these.
 *   2. .env.<APP_ENV>.local — personal overrides, git-ignored
 *   3. .env.<APP_ENV>       — this environment's settings
 *   4. .env                 — defaults shared by every environment
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** api/ — the directory holding the .env files. */
const ENV_ROOT = path.join(__dirname, '../..');

let loaded = false;

export function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;

  const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || 'development')
    .trim()
    .toLowerCase();

  for (const file of [`.env.${appEnv}.local`, `.env.${appEnv}`, '.env']) {
    dotenv.config({ path: path.join(ENV_ROOT, file) });
  }
}

// Run on import so `import './config/loadEnv.js'` is enough.
loadEnvFiles();
