import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';

const getSupplierById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const supplier = await SupplierProfile.findById(id)
      .populate('user', 'email firstName lastName phone status')
      .populate('approvedBy', 'firstName lastName')
      .populate('blacklistedBy', 'firstName lastName');

    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: supplier
    });
  } catch (error: any) {
    console.error('Get supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getSupplierById;
