import type { Request, Response } from 'express';
import { PurchaseOrder, PurchaseRequisition } from '../../models/index.js';
import { isProcurementHead } from '@fossil/shared';

const toIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

/**
 * Pending PO approvals for department heads.
 *  - Procurement HOD: POs awaiting the Procurement-HOD step (pending_proc_hod).
 *  - Other department heads: POs awaiting the requesting-department HOD step
 *    (pending_dept_hod / legacy pending_hod) whose requisition belongs to their
 *    department.
 * Admins see every pending PO across both HOD steps.
 */
const getPendingPoApprovals = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 20 } = req.query as Record<string, any>;
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const isAdmin = req.user!.role === 'admin';
    const procHead = isProcurementHead(req.user);

    let filter: Record<string, any>;
    if (isAdmin) {
      filter = {
        isDeleted: false,
        status: { $in: ['pending_dept_hod', 'pending_proc_hod', 'pending_hod', 'pending_approvals'] }
      };
    } else if (procHead) {
      filter = {
        isDeleted: false,
        status: 'pending_proc_hod',
        procHodApproved: false
      };
    } else {
      // Requesting-department HODs: only their own department's POs at the
      // first HOD step. Resolve which requisitions belong to this department.
      const deptId = toIdString(req.user!.department);
      const reqs = deptId
        ? await PurchaseRequisition.find({ department: deptId, isDeleted: false }).select('_id')
        : [];
      const reqIds = reqs.map((r) => r._id);
      filter = {
        isDeleted: false,
        status: { $in: ['pending_dept_hod', 'pending_hod', 'pending_approvals'] },
        deptHodApproved: false,
        purchaseRequisition: { $in: reqIds }
      };
    }

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
