import type { Request, Response } from 'express';
import { PurchaseOrder } from '../../models/index.js';

const getPendingPoApprovals = async (req: Request, res: Response): Promise<any> => {
  try {
    const orders = await PurchaseOrder.find({
      isDeleted: false,
      status: { $in: ['pending_hod', 'pending_approvals'] },
      hodApproved: false
    })
      .populate('supplier', 'companyName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error('Get pending PO approvals (HOD) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingPoApprovals;
