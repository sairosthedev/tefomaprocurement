import type { Request, Response } from 'express';
import { AuditLog } from '../../models/index.js';

const getAuditLogs = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      action,
      entity,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = req.query as any;

    const query: any = {};

    if (action) query.action = action;
    if (entity) query.entity = entity;

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { entity: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
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

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
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

export default getAuditLogs;
