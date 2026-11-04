import type { Request, Response } from 'express';
import mongoose from 'mongoose';

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

    // The RFQ (with only this supplier's own invitation: the others, and who
    // has responded, are not theirs to see), their latest quote, and any order
    // placed from it, all at once.
    // A malformed id cannot be an RFQ of theirs; without this the lookup
    // throws and answers with a 500.
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found or you are not invited to this RFQ'
      });
    }

    const [rfq, quotation, acceptedOrder]: any[] = await Promise.all([
      RFQ.findOne({
        _id: id,
        isDeleted: false,
        'invitedSuppliers.supplier': profile._id,
        // A draft has not been sent to anyone, even if suppliers are already
        // listed on it.
        status: { $ne: 'draft' }
      })
        .select({
          rfqNumber: 1,
          title: 1,
          description: 1,
          items: 1,
          submissionDeadline: 1,
          status: 1,
          publishedAt: 1,
          termsAndConditions: 1,
          deliveryRequirements: 1,
          paymentTerms: 1,
          invitedSuppliers: { $elemMatch: { supplier: profile._id } }
        })
        .lean(),
      Quotation.findOne({
        rfq: id,
        supplier: profile._id,
        status: { $ne: 'superseded' }
      })
        .sort({ createdAt: -1 })
        .select('quotationNumber status')
        .lean(),
      PurchaseOrder.findOne({
        rfq: id,
        supplier: profile._id,
        isDeleted: false,
        status: { $in: ['approved', 'issued', 'partially_received', 'completed'] }
      })
        .select('poNumber status approvalHistory')
        .lean()
    ]);

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found or you are not invited to this RFQ'
      });
    }

    const { invitedSuppliers, ...rfqFields } = rfq;
    const invitation = invitedSuppliers?.[0];
    const quotationStatus = quotation?.status || null;
    const revisionRequested = quotationStatus === 'revision_requested';
    // An order counts only once this supplier's quote has been accepted.
    const purchaseOrder = quotationStatus === 'accepted' ? acceptedOrder : null;
    // Same test as the supplier's PO list: the supplier recorded an acknowledgement.
    const poAcknowledged = !!purchaseOrder?.approvalHistory?.some((h: any) => h.action === 'acknowledged');

    res.status(200).json({
      success: true,
      data: {
        ...rfqFields,
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
