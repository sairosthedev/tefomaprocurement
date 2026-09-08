// First, so any local .env files are read before other modules load. On Vercel
// there are no .env files — the variables come from project settings — so this
// is a no-op there.
import './config/loadEnv.js';

import { createApp } from './app.js';
import { getAppEnv } from './config/env.js';
import { validateEnvironment } from './config/validate.js';

/**
 * Serverless entrypoint. This path never runs server.ts, so the configuration
 * checks have to happen here too — otherwise a Vercel project with a missing
 * variable deploys green and fails on the first request instead.
 *
 * Environment variables come from the project's settings on Vercel, scoped per
 * environment; loadEnv is imported above only so local runs behave the same.
 */
validateEnvironment();

console.log(`API cold start in ${getAppEnv()} mode`);

// Vercel @vercel/node accepts an Express app as the default export.
export default createApp();
