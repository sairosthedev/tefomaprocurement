import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route/middleware so any rejected promise is forwarded
 * to Express's error pipeline. Removes the need for `try/catch` in every
 * controller and guarantees errors hit the central handler.
 */
export const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;
