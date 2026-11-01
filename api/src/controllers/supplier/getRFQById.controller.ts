import type { Request, Response } from 'express';

import { PurchaseOrder, Quotation, RFQ, SupplierProfile } from '../../models/index.js';

const getRFQById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const rfq = await RFQ.findOne({
      _id: id,
      isDeleted: false,
      'invitedSuppliers.supplier': profile._id
    })
      .populate('invitedSuppliers.supplier', '_id')
      .select('rfqNumber title description items submissionDeadline status publishedAt termsAndConditions deliveryRequirements paymentTerms invitedSuppliers');

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found or you are not invited to this RFQ'
      });
    }

    // Check if supplier has already responded
    const invitation = rfq.invitedSuppliers?.find(
      inv => {
        const supplierId = inv.supplier?._id || inv.supplier;
        return supplierId.toString() === profile._id.toString();
      }
    );

    // The supplier's own latest quote and any order placed from it, so the page
    // can show where this RFQ stands for them. Never another supplier's outcome.
    const quotation: any = await Quotation.findOne({
      rfq: rfq._id,
      supplier: profile._id,
      status: { $ne: 'superseded' }
    })
      .sort({ createdAt: -1 })
      .select('quotationNumber status')
      .lean();
    const quotationStatus = quotation?.status || null;
    const revisionRequested = quotationStatus === 'revision_requested';
    const purchaseOrder: any =
      quotationStatus === 'accepted'
        ? await PurchaseOrder.findOne({
            rfq: rfq._id,
            supplier: profile._id,
            isDeleted: false,
            status: { $in: ['approved', 'issued', 'partially_received', 'completed'] }
          })
            .select('poNumber status approvalHistory')
            .lean()
        : null;
    // Same test as the supplier's PO list: the supplier recorded an acknowledgement.
    const poAcknowledged = !!purchaseOrder?.approvalHistory?.some((h: any) => h.action === 'acknowledged');

    res.status(200).json({
      success: true,
      data: {
        ...rfq.toObject(),
        hasResponded: invitation?.responded || false,
        hasSubmitted: (invitation?.responded || false) && !revisionRequested,
        revisionRequested,
        quotationStatus,
        quotationNumber: quotation?.quotationNumber || null,
        purchaseOrder: purchaseOrder
          ? { poNumber: purchaseOrder.poNumber, status: purchaseOrder.status, isAcknowledged: poAcknowledged }
          : null
      }
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
