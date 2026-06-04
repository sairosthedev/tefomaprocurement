import type { Request, Response } from 'express';

import { RFQ, SupplierProfile } from '../../models/index.js';

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

    res.status(200).json({
      success: true,
      data: {
        ...rfq.toObject(),
        hasResponded: invitation?.responded || false,
        hasSubmitted: invitation?.responded || false
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
