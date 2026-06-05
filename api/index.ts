import type { IncomingMessage, ServerResponse } from 'http';

import { createApp } from './src/app.js';
import { connectToDatabase } from './src/config/db.js';

/**
 * Vercel serverless entry point.
 *
 * The Express app is built once per cold start and reused across warm
 * invocations. The database connection is established (and cached) on the
 * first request. Errors are returned as JSON instead of crashing the function
 * so that CORS headers are still applied by the Express middleware.
 */
const app = createApp();

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await connectToDatabase();
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', (req.headers.origin as string) || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.end(
      JSON.stringify({ success: false, message: 'Database connection failed' })
    );
    return;
  }

  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(
    req,
    res
  );
}
