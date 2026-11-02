import type { Request, Response } from 'express';
import { PurchaseOrder, PurchaseRequisition } from '../../models/index.js';
import { isProcurementHead } from '@fossil/shared';
import { resolveUserDepartmentIds } from '../../lib/departmentScope.js';

/**
 * Pending PO approvals for department heads.
 *  - Procurement HOD: POs awaiting the Procurement-HOD step (pending_proc_hod),
 *    plus the first HOD step for the Procurement department's own requisitions
 *    and for POs with no requisition (approvePurchaseOrder leaves those to
 *    them) — otherwise those sit in no one's queue.
 *  - Other department heads: POs awaiting the requesting-department HOD step
 *    (pending_dept_hod / legacy pending_hod) whose requisition belongs to their
 *    department.
 */
const getPendingPoApprovals = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 20 } = req.query as Record<string, any>;
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const procHead = isProcurementHead(req.user);

    // For proc HOD: POs at pending_proc_hod. The Dept HOD step was removed so
    // other department heads have no PO approval step; their query is kept for
    // any legacy pending_dept_hod records still in the system.
    const deptIds = await resolveUserDepartmentIds(req.user);
    const reqs = deptIds.length
      ? await PurchaseRequisition.find({ department: { $in: deptIds }, isDeleted: false }).select('_id')
      : [];
    const reqIds: any[] = reqs.map((r) => r._id);
    if (procHead) reqIds.push(null);
    const deptStep = {
      status: { $in: ['pending_dept_hod', 'pending_hod', 'pending_approvals'] },
      deptHodApproved: false,
      purchaseRequisition: { $in: reqIds }
    };
    const filter: Record<string, any> = procHead
      ? {
          isDeleted: false,
          $or: [{ status: 'pending_proc_hod', procHodApproved: false }, deptStep]
        }
      : { isDeleted: false, ...deptStep };

    const [total, orders] = await Promise.all([
      PurchaseOrder.countDocuments(filter),
      PurchaseOrder.find(filter)
        .populate('supplier', 'companyName')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get pending PO approvals (HOD) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingPoApprovals;
