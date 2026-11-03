import type { Request, Response } from 'express';

import { RFQ, Quotation } from '../../models/index.js';
import { isRfqSealed } from '../../lib/rfqVisibility.js';

const getRFQById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    // The bid count needs only the id, so it is taken alongside the RFQ read.
    // The requisition is a reference here, not a page: its number and title
    // are enough. (A second, unselected populate of the same path used to
    // override this one and send the whole requisition, items and history.)
    const [rfq, bidCount] = await Promise.all([
      RFQ.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate('site', 'code name type')
        .populate('invitedSuppliers.supplier', 'companyName contactEmail contactPhone')
        .populate('invitedSuppliers.quotation', 'quotationNumber status submittedAt totalAmount')
        .populate('purchaseRequisition', 'requisitionNumber title department')
        .lean(),
      // Number of bids received so far — always visible to procurement.
      Quotation.countDocuments({
        rfq: id,
        status: { $in: ['submitted', 'under_review', 'accepted', 'rejected'] },
        isDeleted: false
      })
    ]);

    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    (rfq as any).bidCount = bidCount;

    // Sealed bids: while the RFQ is ongoing, expose the COUNT only — never the
    // bid values, line items, or per-supplier quote references. Admins exempt.
    if (req.user!.role !== 'admin' && isRfqSealed(rfq)) {
      (rfq as any).bidsSealed = true;
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
