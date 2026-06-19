import { PurchaseOrder } from '../models/index.js';

export function parseRangeStart(range?: string): Date {
  const now = new Date();
  switch (range) {
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    case 'month':
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

export async function buildReportCharts(range?: string) {
  const start = parseRangeStart(range);
  const poMatch: Record<string, unknown> = {
    isDeleted: false,
    createdAt: { $gte: start }
  };

  const spendTrend = await PurchaseOrder.aggregate([
    {
      $match: {
        ...poMatch,
        status: { $in: ['approved', 'issued', 'partially_received', 'completed'] }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 31 }
  ]);

  const byStatus = await PurchaseOrder.aggregate([
    { $match: poMatch },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { value: -1 } }
  ]);

  const byDepartment = await PurchaseOrder.aggregate([
    { $match: { ...poMatch, purchaseRequisition: { $exists: true, $ne: null } } },
    {
      $lookup: {
        from: 'purchaserequisitions',
        localField: 'purchaseRequisition',
        foreignField: '_id',
        as: 'pr'
      }
    },
    { $unwind: '$pr' },
    {
      $group: {
        _id: '$pr.department',
        value: { $sum: '$totalAmount' }
      }
    },
    {
      $lookup: {
        from: 'departments',
        localField: '_id',
        foreignField: '_id',
        as: 'dept'
      }
    },
    { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        label: { $ifNull: ['$dept.name', 'Unassigned'] },
        value: 1
      }
    },
    { $sort: { value: -1 } },
    { $limit: 8 }
  ]);

  return {
    rangeStart: start.toISOString(),
    spendTrend: spendTrend.map((row) => ({ label: row._id, value: row.value || 0 })),
    distribution: byStatus.map((row) => ({
      label: String(row._id).replace(/_/g, ' '),
      value: row.value || 0,
      count: row.count || 0
    })),
    departmentSpend: byDepartment.map((row) => ({
      label: row.label,
      value: row.value || 0
    }))
  };
}
