import type { Request, Response } from 'express';

import { RFQ, Quotation } from '../../models/index.js';
import { isRfqSealed } from '../../lib/rfqVisibility.js';

const getRFQById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const rfq = await RFQ.findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('site', 'code name type')
      .populate('invitedSuppliers.supplier', 'companyName contactEmail contactPhone')
      .populate('invitedSuppliers.quotation', 'quotationNumber status submittedAt totalAmount')
      .populate('purchaseRequisition', 'requisitionNumber title department')
      .populate({
        path: 'purchaseRequisition',
        populate: {
          path: 'department',
          select: 'name code'
        }
      })
      .lean();

    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    // Number of bids received so far — always visible to procurement.
    const bidCount = await Quotation.countDocuments({
      rfq: rfq._id,
      status: { $in: ['submitted', 'under_review', 'accepted', 'rejected'] },
      isDeleted: false
    });
    rfq.bidCount = bidCount;

    // Sealed bids: while the RFQ is ongoing, expose the COUNT only — never the
    // bid values, line items, or per-supplier quote references. Admins exempt.
    if (req.user!.role !== 'admin' && isRfqSealed(rfq)) {
      rfq.bidsSealed = true;
      rfq.invitedSuppliers = (rfq.invitedSuppliers || []).map((inv) => ({
        ...inv,
        quotation: undefined,
        responded: inv.responded || false,
        respondedAt: inv.respondedAt
      }));
    }

    res.status(200).json({
      success: true,
      data: rfq
    });
  } catch (error: any) {
    console.error('Get RFQ by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getRFQById;
