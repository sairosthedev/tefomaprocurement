import 'dotenv/config';

import { createApp } from './app.js';
import connectDB from './config/db.js';
import { logger } from './lib/logger.js';

const PORT = process.env.PORT || 3001;

async function bootstrap(): Promise<void> {
  await connectDB();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`API server running on http://localhost:${PORT}`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
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
