import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRoot = path.join(__dirname, '..');

/**
 * Load env files in ascending priority. dotenv never overwrites a variable that
 * is already set, so the first file to define a key wins — which is why the
 * most specific file is read first. Real platform variables (Vercel, CI, the
 * shell) are already in process.env and therefore always win over any file.
 *
 *   .env.<env>.local  — personal overrides, git-ignored, never shared
 *   .env.<env>        — the environment's committed-shape settings
 *   .env              — shared defaults across every environment
 */
const appEnvName = (process.env.APP_ENV || process.env.NODE_ENV || 'development').trim().toLowerCase();
for (const file of [`.env.${appEnvName}.local`, `.env.${appEnvName}`, '.env']) {
  dotenv.config({ path: path.join(envRoot, file) });
}

import { createApp } from './app.js';
import connectDB from './config/db.js';
import { getAppEnv } from './config/env.js';
import { validateEnvironment } from './config/validate.js';
import { logger } from './lib/logger.js';
import { startAlertScheduler, stopAlertScheduler } from './jobs/scheduler.js';

const PORT = process.env.PORT || 3001;

async function bootstrap(): Promise<void> {
  // Fail fast on a misconfigured environment rather than at the first login.
  validateEnvironment();

  const appEnv = getAppEnv();
  logger.info(`Starting API in ${appEnv} mode`);

  await connectDB();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`API server running on http://localhost:${PORT} (${appEnv})`);
    startAlertScheduler();
  });

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    stopAlertScheduler();
    server.close((err?: Error) => {
      if (err) {
        logger.error('Error closing server', err);
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
