import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { Department, DepartmentBudget, PurchaseOrder, Payment } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const COMMITTED_PO_STATUSES = ['pending_hod', 'pending_finance', 'pending_coo', 'pending_approvals'];

async function sumPoAmountsByDepartment(
  departmentIds: string[],
  statuses: string[]
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  departmentIds.forEach((id) => totals.set(id, 0));

  if (departmentIds.length === 0) return totals;

  const rows = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
        status: { $in: statuses },
        purchaseRequisition: { $exists: true, $ne: null }
      }
    },
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
      $match: {
        'pr.department': { $in: departmentIds.map((id) => new mongoose.Types.ObjectId(id)) }
      }
    },
    {
      $group: {
        _id: '$pr.department',
        total: { $sum: '$totalAmount' }
      }
    }
  ]);

  rows.forEach((row: { _id: { toString(): string }; total: number }) => {
    totals.set(row._id.toString(), row.total || 0);
  });

  return totals;
}

async function sumPaidByDepartment(departmentIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  departmentIds.forEach((id) => totals.set(id, 0));

  if (departmentIds.length === 0) return totals;

  const rows = await Payment.aggregate([
    { $match: { isDeleted: false, status: 'completed' } },
    { $unwind: '$invoices' },
    {
      $lookup: {
        from: 'invoices',
        localField: 'invoices',
        foreignField: '_id',
        as: 'inv'
      }
    },
    { $unwind: '$inv' },
    {
      $lookup: {
        from: 'purchaseorders',
        localField: 'inv.purchaseOrder',
        foreignField: '_id',
        as: 'po'
      }
    },
    { $unwind: '$po' },
    {
      $lookup: {
        from: 'purchaserequisitions',
        localField: 'po.purchaseRequisition',
        foreignField: '_id',
        as: 'pr'
      }
    },
    { $unwind: '$pr' },
    {
      $match: {
        'pr.department': { $in: departmentIds.map((id) => new mongoose.Types.ObjectId(id)) }
      }
    },
    {
      $group: {
        _id: '$pr.department',
        total: { $sum: '$amount' }
      }
    }
  ]);

  rows.forEach((row: { _id: { toString(): string }; total: number }) => {
    totals.set(row._id.toString(), row.total || 0);
  });

  return totals;
}

const getBudgets = async (req: Request, res: Response): Promise<any> => {
  try {
    const fiscalYear = Number(req.query.fiscalYear) || new Date().getFullYear();

    const departments = await Department.find({ isDeleted: false, status: 'active' })
      .sort({ name: 1 })
      .lean();

    const departmentIds = departments.map((d) => String(d._id));

    const [allocations, utilizedFromPayments, committedTotals] = await Promise.all([
      DepartmentBudget.find({ fiscalYear, isDeleted: false }).lean(),
      sumPaidByDepartment(departmentIds),
      sumPoAmountsByDepartment(departmentIds, COMMITTED_PO_STATUSES)
    ]);

    const allocationMap = new Map(
      allocations.map((a) => [String(a.department), a.allocatedAmount])
    );

    const departmentRows = departments.map((dept) => {
      const deptId = String(dept._id);
      const budget = allocationMap.get(deptId) || 0;
      const utilized = utilizedFromPayments.get(deptId) || 0;
      const committed = committedTotals.get(deptId) || 0;
      const available = Math.max(0, budget - utilized - committed);
      const percentage = budget > 0 ? Math.round((utilized / budget) * 100) : 0;

      return {
        departmentId: deptId,
        name: dept.name,
        code: dept.code,
        budget,
        utilized,
        committed,
        available,
        percentage
      };
    });

    const totalBudget = departmentRows.reduce((sum, d) => sum + d.budget, 0);
    const utilized = departmentRows.reduce((sum, d) => sum + d.utilized, 0);
    const committed = departmentRows.reduce((sum, d) => sum + d.committed, 0);
    const available = Math.max(0, totalBudget - utilized - committed);

    res.status(200).json({
      success: true,
      data: {
        fiscalYear,
        totalBudget,
        utilized,
        committed,
        available,
        departments: departmentRows
      }
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getBudgets;
