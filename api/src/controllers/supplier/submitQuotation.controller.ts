import type { Request, Response } from 'express';

import { Quotation, RFQ, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

const submitQuotation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      rfqId, 
      items, 
      validityPeriod, 
      deliveryPeriod, 
      paymentTerms,
      currency,
      notes 
    } = req.body;

    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    if (profile.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your supplier account is not active'
      });
    }

    const rfq = await RFQ.findById(rfqId);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    if (rfq.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'RFQ is not open for submissions'
      });
    }

    if (new Date() > new Date(rfq.submissionDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'Submission deadline has passed'
      });
    }

    // Check if supplier was invited
    const isInvited = rfq.invitedSuppliers.some(
      inv => inv.supplier.toString() === profile._id.toString()
    );
    if (!isInvited) {
      return res.status(403).json({
        success: false,
        message: 'You are not invited to this RFQ'
      });
    }

    // Check if already submitted
    const existingQuotation = await Quotation.findOne({
      rfq: rfqId,
      supplier: profile._id,
      isDeleted: false
    });
    if (existingQuotation) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a quotation for this RFQ'
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum: any, item: any) => sum + item.totalPrice, 0);
    const vatAmount = items.some(item => !item.vatIncluded) ? subtotal * 0.15 : 0;
    const totalAmount = subtotal + vatAmount;

    // Generate quotation number
    const count = await Quotation.countDocuments();
    const year = new Date().getFullYear();
    const quotationNumber = `QT-${year}-${String(count + 1).padStart(5, '0')}`;

    const validityDays = validityPeriod || 30;
    const quotation = await Quotation.create({
      quotationNumber,
      rfq: rfqId,
      site: rfq.site,
      supplier: profile._id,
      submittedBy: req.user!._id,
      items,
      subtotal,
      vatAmount,
      totalAmount,
      validityPeriod: validityDays,
      deliveryPeriod,
      paymentTerms,
      currency: currency || 'USD',
      notes,
      status: 'submitted',
      isLocked: true,
      lockedAt: new Date(),
      submittedAt: new Date(),
      validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
    });

    // Update RFQ invitation status
    await RFQ.updateOne(
      { _id: rfqId, 'invitedSuppliers.supplier': profile._id },
      { 
        $set: { 
          'invitedSuppliers.$.responded': true,
          'invitedSuppliers.$.respondedAt': new Date(),
          'invitedSuppliers.$.quotation': quotation._id
        }
      }
    );

    await createAuditLog({
      action: 'submit',
      entity: 'Quotation',
      entityId: quotation._id,
      user: req.user,
      description: `Submitted quotation ${quotation.quotationNumber} for RFQ ${rfq.rfqNumber}`,
      newData: { totalAmount, deliveryPeriod },
      req
    });

    // Notify procurement officers
    await notifyUsersByRole('procurement_officer', {
      type: 'quotation_submitted',
      title: 'New Quotation Received',
      message: `${profile.companyName || 'A supplier'} has submitted a quotation ${quotation.quotationNumber} for RFQ ${rfq.rfqNumber}.`,
      entity: 'Quotation',
      entityId: quotation._id,
      relatedUser: req.user!._id,
      metadata: { rfqNumber: rfq.rfqNumber, supplierName: profile.companyName }
    });

    res.status(201).json({
      success: true,
      message: 'Quotation submitted successfully',
      data: quotation
    });
  } catch (error: any) {
    console.error('Submit quotation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default submitQuotation;
