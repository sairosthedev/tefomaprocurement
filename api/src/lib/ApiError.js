'use strict';

/**
 * Operational HTTP error. Anything thrown as `ApiError` is treated as a
 * predictable failure and rendered as a clean JSON response by the
 * centralized error handler. Anything else is treated as a programmer bug
 * (logged + reported as 500).
 */
class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', meta) {
    return new ApiError(400, message, meta);
  }

  static unauthorized(message = 'Not authorized', meta) {
    return new ApiError(401, message, meta);
  }

  static forbidden(message = 'Forbidden', meta) {
    return new ApiError(403, message, meta);
  }

  static notFound(message = 'Resource not found', meta) {
    return new ApiError(404, message, meta);
  }

  static conflict(message = 'Conflict', meta) {
    return new ApiError(409, message, meta);
  }

  static unprocessable(message = 'Unprocessable entity', meta) {
    return new ApiError(422, message, meta);
  }

  static internal(message = 'Internal server error', meta) {
    return new ApiError(500, message, meta);
  }
}

module.exports = ApiError;
