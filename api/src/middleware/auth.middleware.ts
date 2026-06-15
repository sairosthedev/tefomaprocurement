import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { isProcurementHead } from '@fossil/shared';
import { User } from '../models/index.js';

interface DecodedToken {
  id: string;
  role: string;
}

// Protect routes - verify JWT token
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as DecodedToken;

    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('department', 'name code');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'User account is not active'
      });
    }

    req.user = user as unknown as Request['user'];
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Authorize by roles
export const authorize =
  (...roles: string[]): RequestHandler =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user!.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user?.role}' is not authorized to access this route`
      });
    }
    next();
  };

/**
 * Authorize procurement actions. Allows procurement officers and admins, plus
 * the head of the Procurement department (a department_head whose department is
 * Procurement) — per procurement policy. The procurement head therefore gains
 * procurement_officer-level access, including quotation authorization.
 */
export const authorizeProcurement: RequestHandler = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'procurement_officer' || role === 'admin' || isProcurementHead(req.user)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: `Role '${role}' is not authorized to access this route`
  });
};
