'use strict';

const ApiError = require('../lib/ApiError');
const logger = require('../lib/logger');

/**
 * 404 catch-all for unmatched routes. Mount AFTER all real routes.
 */
function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Centralized error handler. Normalizes:
 *   - ApiError (our operational class)
 *   - Mongoose ValidationError -> 400
 *   - Mongoose CastError -> 400
 *   - duplicate key (E11000) -> 409
 *   - JWT errors -> 401
 *   - anything else -> 500
 */
// eslint-disable-next-line no-unused-vars -- Express requires 4-arg signature
function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code;
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
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

  const body = { success: false, message };
  if (code) body.code = code;
  if (details) body.details = details;
  if (isServerError && process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
