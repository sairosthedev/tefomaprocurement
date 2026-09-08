import { createApp } from './app.js';
import { getAppEnv } from './config/env.js';
import { validateEnvironment } from './config/validate.js';

/**
 * Serverless entrypoint. This path never runs server.ts, so the configuration
 * checks have to happen here too — otherwise a Vercel project with a missing
 * variable deploys green and fails on the first request instead.
 *
 * No dotenv here: on Vercel the environment variables come from the project's
 * settings, scoped per environment, and there are no .env files in the bundle.
 */
validateEnvironment();

console.log(`API cold start in ${getAppEnv()} mode`);

// Vercel @vercel/node accepts an Express app as the default export.
export default createApp();
