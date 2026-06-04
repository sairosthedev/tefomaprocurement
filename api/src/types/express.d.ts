import type { HydratedDocument } from 'mongoose';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Authenticated user document, attached by the `protect` middleware.
      // Typed loosely because controllers access many dynamic Mongoose fields.
      user?: HydratedDocument<Record<string, unknown>> & Record<string, any>;
    }
  }
}

export {};
