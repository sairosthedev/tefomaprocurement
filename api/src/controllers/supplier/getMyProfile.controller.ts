import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';

const getMyProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
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
