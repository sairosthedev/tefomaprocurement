import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';

import connectToDatabase from './config/db.js';
import { corsOptions, applyCorsHeaders } from './config/cors.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/index.js';

/**
 * Build the Express app. Pure factory — no listeners, no DB calls — so it
 * can be mounted in tests or serverless handlers without side effects.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // On Vercel (serverless), connect to MongoDB before API routes. /health stays
  // available without a DB connection so deploy health checks still pass.
  if (process.env.VERCEL) {
    app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'OPTIONS') {
        next();
        return;
      }

      try {
        await connectToDatabase();
        next();
      } catch {
        applyCorsHeaders(req.headers.origin, res);
        res.status(503).json({
          success: false,
          message: 'Database connection failed'
        });
      }
    });
  }

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default { createApp };
