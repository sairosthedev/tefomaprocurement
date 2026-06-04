export interface ApiErrorMeta {
  code?: string;
  details?: unknown;
}

/**
 * Operational HTTP error. Anything thrown as `ApiError` is treated as a
 * predictable failure and rendered as a clean JSON response by the
 * centralized error handler. Anything else is treated as a programmer bug
 * (logged + reported as 500).
 */
export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
  isOperational: boolean;

  constructor(statusCode: number, message: string, { code, details }: ApiErrorMeta = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', meta?: ApiErrorMeta): ApiError {
    return new ApiError(400, message, meta);
  }

  static unauthorized(message = 'Not authorized', meta?: ApiErrorMeta): ApiError {
    return new ApiError(401, message, meta);
  }

  static forbidden(message = 'Forbidden', meta?: ApiErrorMeta): ApiError {
    return new ApiError(403, message, meta);
  }

  static notFound(message = 'Resource not found', meta?: ApiErrorMeta): ApiError {
    return new ApiError(404, message, meta);
  }

  static conflict(message = 'Conflict', meta?: ApiErrorMeta): ApiError {
    return new ApiError(409, message, meta);
  }

  static unprocessable(message = 'Unprocessable entity', meta?: ApiErrorMeta): ApiError {
    return new ApiError(422, message, meta);
  }

  static internal(message = 'Internal server error', meta?: ApiErrorMeta): ApiError {
    return new ApiError(500, message, meta);
  }
}

export default ApiError;
