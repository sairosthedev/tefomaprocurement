import type { Request, Response } from 'express';
import { AuditLog } from '../../models/index.js';

/** Escape user input before it reaches a $regex so a stray "(" cannot break the query. */
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildQuery = (req: Request) => {
  const { action, entity, user, search, startDate, endDate } = req.query as any;

  const query: any = {};

  if (action) query.action = { $in: String(action).split(',').filter(Boolean) };
  if (entity) query.entity = { $in: String(entity).split(',').filter(Boolean) };
  if (user) query.user = user;

  if (search) {
    const rx = { $regex: escapeRegex(String(search)), $options: 'i' };
    query.$or = [
      { description: rx },
      { entity: rx },
      { entityLabel: rx },
      { userEmail: rx },
      { userRole: rx },
      { ipAddress: rx },
      { status: rx }
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      // Include the whole end day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  return query;
};

const getAuditLogs = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 25 } = req.query as any;
    const query = buildQuery(req);

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    // Exports pull a wide page, so allow a larger ceiling than the UI default.
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 1000);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Headline counts for the audit dashboard, honouring the same filters as the
 * list so the tiles always describe what the user is actually looking at.
 */
export const getAuditLogStats = async (req: Request, res: Response): Promise<any> => {
  try {
    const query = buildQuery(req);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Keep any date filter intact: take the later of its lower bound and 24h ago.
    const existingFrom = query.createdAt?.$gte;
    const last24hQuery = {
      ...query,
      createdAt: {
        ...(query.createdAt || {}),
        $gte: existingFrom && existingFrom > since24h ? existingFrom : since24h
      }
    };

    const [total, last24h, activeUsers, byAction, topUsers] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.countDocuments(last24hQuery),
      AuditLog.distinct('user', query).then((ids) => ids.filter(Boolean).length),
      AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.aggregate([
        { $match: { ...query, user: { $ne: null } } },
        {
          $group: {
            _id: '$user',
            count: { $sum: 1 },
            email: { $first: '$userEmail' },
            role: { $first: '$userRole' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    const failedLogins = byAction.find((a: any) => a._id === 'login_failed')?.count || 0;

    res.status(200).json({
      success: true,
      data: {
        total,
        last24h,
        activeUsers,
        failedLogins,
        byAction: byAction.map((a: any) => ({ action: a._id, count: a.count })),
        topUsers: topUsers.map((u: any) => ({
          user: u._id,
          email: u.email,
          role: u.role,
          count: u.count
        }))
      }
    });
  } catch (error) {
    console.error('Get audit log stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getAuditLogs;
