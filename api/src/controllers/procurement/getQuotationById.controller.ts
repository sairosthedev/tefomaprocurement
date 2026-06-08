import type { Request, Response } from 'express';

import { Quotation, PurchaseOrder } from '../../models/index.js';
import { isRfqSealed } from '../../lib/rfqVisibility.js';
import {
  meetsMinimumQuotations,
  quotationFullyAuthorized
} from '../../services/quotationCompliance.service.js';

const getQuotationById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id)
      .populate({
        path: 'rfq',
        select: 'rfqNumber title description items submissionDeadline status hodSelection pmAuthorization selectedQuotation quotationWaiver purchaseRequisition',
        populate: {
          path: 'purchaseRequisition',
          select: 'requisitionNumber title department',
          populate: { path: 'department', select: 'name code' }
        }
      })
      .populate('supplier', 'companyName contactEmail contactPhone')
      .populate('submittedBy', 'firstName lastName email')
      .select('-isDeleted');

    if (!quotation || quotation.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

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

    // Check if a PO already exists for this quotation
    const existingPO = await PurchaseOrder.findOne({
      quotation: id,
      isDeleted: false
    }).select('poNumber status');

    const quotationData: any = quotation.toObject();
    if (existingPO) {
      quotationData.existingPurchaseOrder = {
        poNumber: existingPO.poNumber,
        status: existingPO.status,
        _id: existingPO._id
      };
    }

    // FC-HQ-P-07 §5.1.2 / §6.3.4 — surface the acceptance compliance chain so
    // the UI can guide the user through HOD selection and PM authorization.
    const rfq = quotation.rfq as any;
    const qid = String(quotation._id);
    const { met, count, waived } = await meetsMinimumQuotations(String(rfq._id), rfq);
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
