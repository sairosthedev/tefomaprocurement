import type { Request, Response } from 'express';

import { Quotation, PurchaseOrder } from '../../models/index.js';
import { isRfqSealed } from '../../lib/rfqVisibility.js';
import {
  countSubmittedQuotations,
  minimumQuotationsFrom,
  quotationFullyAuthorized
} from '../../services/quotationCompliance.service.js';

const getQuotationById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    // Filter deleted quotes in the query: `isDeleted` is deselected, so a
    // check on the loaded document could never see it.
    const quotation = await Quotation.findOne({ _id: id, isDeleted: false }).select('-isDeleted');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // The PO lookup and the RFQ's bid count need only ids the quotation already
    // carries, so they run while its references populate. Neither is sent
    // until the sealed-bid check below has passed.
    const rfqId = String(quotation.rfq);
    const [, existingPO, submittedCount] = await Promise.all([
      quotation.populate([
        {
          path: 'rfq',
          select: 'rfqNumber title description items submissionDeadline status hodSelection pmAuthorization selectedQuotation quotationWaiver purchaseRequisition',
          populate: {
            path: 'purchaseRequisition',
            select: 'requisitionNumber title department',
            populate: { path: 'department', select: 'name code' }
          }
        },
        { path: 'supplier', select: 'companyName contactEmail contactPhone' },
        { path: 'submittedBy', select: 'firstName lastName email' }
      ]),
      // Check if a PO already exists for this quotation
      PurchaseOrder.findOne({
        quotation: id,
        isDeleted: false
      }).select('poNumber status'),
      countSubmittedQuotations(rfqId)
    ]);

    // Sealed bids: while the RFQ is still ongoing, procurement cannot open
    // individual bids. Admins are exempt.
    if (req.user!.role !== 'admin' && isRfqSealed(quotation.rfq)) {
      const rfq = quotation.rfq as any;
      return res.status(403).json({
        success: false,
        sealed: true,
        rfqId: rfq?._id,
        rfqNumber: rfq?.rfqNumber,
        submissionDeadline: rfq?.submissionDeadline,
        message:
          'This bid is sealed until the RFQ submission deadline passes or the RFQ is closed. Close the RFQ to reveal bids for evaluation.'
      });
    }

    const quotationData: any = quotation.toObject();
    if (existingPO) {
      quotationData.existingPurchaseOrder = {
        poNumber: existingPO.poNumber,
        status: existingPO.status,
        _id: existingPO._id
      };
    }

    // Surface the acceptance compliance chain so
    // the UI can guide the user through selection and PM authorization.
    const rfq = quotation.rfq as any;
    const qid = String(quotation._id);
    const { met, count, waived } = minimumQuotationsFrom(submittedCount, rfq);
    const hodSelected =
      rfq?.hodSelection?.quotation && String(rfq.hodSelection.quotation) === qid;
    const hodHasJustification = Boolean(rfq?.hodSelection?.justification);
    const pmAuthorized =
      rfq?.pmAuthorization?.quotation && String(rfq.pmAuthorization.quotation) === qid;

    const requestingDepartment = rfq?.purchaseRequisition?.department || null;

    quotationData.compliance = {
      minQuotationsMet: met,
      quotationCount: count,
      waived,
      hodSelected: Boolean(hodSelected && hodHasJustification),
      hodJustification: hodSelected ? rfq?.hodSelection?.justification || null : null,
      pmAuthorized: Boolean(pmAuthorized),
      fullyAuthorized: quotationFullyAuthorized(rfq, qid),
      requestingDepartment: requestingDepartment
        ? {
            id: requestingDepartment._id,
            name: requestingDepartment.name,
            code: requestingDepartment.code
          }
        : null
    };

    res.status(200).json({
      success: true,
      data: quotationData
    });
  } catch (error: any) {
    console.error('Get quotation by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getQuotationById;
