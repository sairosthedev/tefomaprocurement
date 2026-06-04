import type { HydratedDocument } from 'mongoose';
import type { IUser } from '../models/User.model.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: HydratedDocument<IUser>;
    }
  }
}

export {};
