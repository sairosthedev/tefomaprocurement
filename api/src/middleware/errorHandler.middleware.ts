import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../lib/ApiError.js';
import { logger } from '../lib/logger.js';

/**
 * 404 catch-all for unmatched routes. Mount AFTER all real routes.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Centralized error handler. Normalizes ApiError, Mongoose validation/cast,
 * duplicate-key, and JWT errors; everything else becomes a 500.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let status: number = err.statusCode || 500;
  let message: string = err.message || 'Internal server error';
  const code: string | undefined = err.code;
  let details: unknown = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]: [string, any]) => [k, v.message])
    );
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value';
    details = err.keyValue;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired token';
  }

  const isServerError = status >= 500;
  if (isServerError) {
    logger.error('Unhandled error', {
      path: `${req.method} ${req.originalUrl}`,
      message: err.message,
      stack: err.stack
    });
  } else {
    logger.warn('Request failed', {
      path: `${req.method} ${req.originalUrl}`,
      status,
      message
    });
  }

  const body: Record<string, unknown> = { success: false, message };
  if (code) body.code = code;
  if (details) body.details = details;
  if (isServerError && process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}
