import type { Request, Response } from 'express';
import { RFQ, PurchaseRequisition, Quotation } from '../../models/index.js';

const toIdString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
};

/**
 * RFQs waiting for a department head to choose the winning supplier.
 *
 * Bids are sealed until an RFQ closes, so only closed or evaluating RFQs are
 * listed. An RFQ is waiting while it has neither a whole-quotation selection
 * nor a selection on every line that has bids. Department heads see the RFQs
 * raised from their own department's requisitions; admins see all of them.
 */
const getPendingAwardSelections = async (req: Request, res: Response): Promise<any> => {
  try {
    const filter: Record<string, any> = {
      isDeleted: false,
      status: { $in: ['closed', 'evaluating'] },
      'hodSelection.quotation': { $exists: false }
    };

    if (req.user!.role !== 'admin') {
      const deptId = toIdString(req.user!.department);
      const reqs = deptId
        ? await PurchaseRequisition.find({ department: deptId, isDeleted: false }).select('_id')
        : [];
      filter.purchaseRequisition = { $in: reqs.map((r) => r._id) };
    }

    const rfqs = await RFQ.find(filter)
      .populate({ path: 'purchaseRequisition', select: 'requisitionNumber title department', populate: { path: 'department', select: 'name' } })
      .select('rfqNumber title status closedAt submissionDeadline lineAwards purchaseRequisition items')
      .sort({ closedAt: -1, updatedAt: -1 });

    // A line with no bids has nothing to select, so only pending lines count.
    // lineAwards is empty until the award page is first opened.
    const waiting = rfqs.filter(
      (r) => !r.lineAwards?.length || r.lineAwards.some((l) => l.status === 'pending')
    );

    const counts = await Quotation.aggregate([
      {
        $match: {
          rfq: { $in: waiting.map((r) => r._id) },
          isDeleted: false,
          status: { $in: ['submitted', 'under_review', 'accepted'] }
        }
      },
      { $group: { _id: '$rfq', count: { $sum: 1 } } }
    ]);
    const countByRfq = new Map(counts.map((c) => [String(c._id), c.count]));

    res.status(200).json({
      success: true,
      data: waiting.map((r) => ({
        _id: r._id,
        rfqNumber: r.rfqNumber,
        title: r.title,
        status: r.status,
        closedAt: r.closedAt,
        lineCount: r.items?.length || 0,
        pendingLines: r.lineAwards?.length
          ? r.lineAwards.filter((l) => l.status === 'pending').length
          : r.items?.length || 0,
        quotationCount: countByRfq.get(String(r._id)) || 0,
        requisition: r.purchaseRequisition
          ? {
              _id: r.purchaseRequisition._id,
              requisitionNumber: r.purchaseRequisition.requisitionNumber,
              title: r.purchaseRequisition.title,
              department: r.purchaseRequisition.department?.name
            }
          : null
      }))
    });
  } catch (error) {
    console.error('Get pending award selections (HOD) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingAwardSelections;
