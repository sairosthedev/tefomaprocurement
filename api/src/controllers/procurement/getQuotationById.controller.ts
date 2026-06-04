import type { Request, Response } from 'express';

import { Quotation, PurchaseOrder } from '../../models/index.js';
import { isRfqSealed } from '../../lib/rfqVisibility.js';

const getQuotationById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id)
      .populate('rfq', 'rfqNumber title description items submissionDeadline status')
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
      return res.status(403).json({
        success: false,
        sealed: true,
        message:
          'This bid is sealed until the RFQ submission deadline passes or the RFQ is closed.'
      });
    }

    // Check if a PO already exists for this quotation
    const existingPO = await PurchaseOrder.findOne({
      quotation: id,
      isDeleted: false
    }).select('poNumber status');

    const quotationData = quotation.toObject();
    if (existingPO) {
      quotationData.existingPurchaseOrder = {
        poNumber: existingPO.poNumber,
        status: existingPO.status,
        _id: existingPO._id
      };
    }

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
