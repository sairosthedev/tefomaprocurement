import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';

import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/index.js';

/**
 * Build the Express app. Pure factory — no listeners, no DB calls — so it
 * can be mounted in tests or serverless handlers without side effects.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default { createApp };
