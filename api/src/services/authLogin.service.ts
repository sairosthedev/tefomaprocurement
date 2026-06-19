import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Request } from 'express';
import { User, SupplierProfile } from '../models/index.js';
import { createAuditLog } from '../middleware/index.js';
import { createNotification } from './notification.service.js';

export async function finalizeUserLogin(user: any, req: Request) {
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
  );

  await user.populate('department', 'name code');

  let supplierProfile = null;
  if (user.role === 'supplier') {
    supplierProfile = await SupplierProfile.findOne({ user: user._id });
  }

  await createAuditLog({
    action: 'login',
    entity: 'User',
    entityId: user._id,
    user,
    description: 'User logged in successfully (OTP verified)',
    req
  });

  await createNotification({
    recipient: user._id,
    type: 'login_successful',
    title: 'Successful Login',
    message: `You have successfully logged into your account. ${req.ip ? `IP Address: ${req.ip}` : ''}`,
    entity: 'User',
    entityId: user._id,
    relatedUser: user._id,
    metadata: {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
      timestamp: new Date()
    }
  });

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      supplierProfile: supplierProfile?._id
    }
  };
}

export async function findActiveUserByEmail(email: string) {
  return User.findOne({ email, isDeleted: false }).select('+password');
}
