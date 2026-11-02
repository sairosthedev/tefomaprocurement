import type { Request, Response } from 'express';

import { SupplierBankChangeRequest, SupplierProfile } from '../../models/index.js';

const getMyProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    // Where the supplier's latest banking change stands. Only its progress is
    // returned: the account numbers stay on the request itself.
    const bankChange: any = await SupplierBankChangeRequest.findOne({ supplier: profile._id })
      .sort({ createdAt: -1 })
      .select('status createdAt callback.verifiedAt approvedAt rejectedAt rejectionReason appliedAt')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...profile.toObject(),
        bankChangeRequest: bankChange
          ? {
              status: bankChange.status,
              requestedAt: bankChange.createdAt,
              verifiedAt: bankChange.callback?.verifiedAt || null,
              approvedAt: bankChange.approvedAt || null,
              rejectedAt: bankChange.rejectedAt || null,
              rejectionReason: bankChange.rejectionReason || null
            }
          : null
      }
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMyProfile;
