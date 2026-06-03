'use strict';

require('dotenv').config();

const { createApp } = require('./app');
const connectDB = require('./config/db');
const logger = require('./lib/logger');

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  await connectDB();

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`API server running on http://localhost:${PORT}`);
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close((err) => {
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
