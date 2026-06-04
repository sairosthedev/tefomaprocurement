import type { Request } from 'express';
import { AuditLog } from '../models/index.js';

export interface AuditLogOptions {
  action: string;
  entity: string;
  entityId?: unknown;
  user?: any;
  description?: string;
  previousData?: unknown;
  newData?: unknown;
  req?: Request;
}

export const createAuditLog = async (options: AuditLogOptions): Promise<void> => {
  try {
    const { action, entity, entityId, user, description, previousData, newData, req } =
      options;

    await AuditLog.create({
      action,
      entity,
      entityId,
      user: user?._id || user,
      userEmail: user?.email,
      userRole: user?.role,
      description,
      previousData,
      newData,
      ipAddress: req?.ip || (req as any)?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent']
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};
