import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';
import { canSeeFullBankDetails, maskBankNumbers } from '../../lib/bankMasking.js';
import { WITHOUT_DOCUMENT_FILES } from '../../services/supplierDocuments.service.js';

const getSupplierById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    // Document metadata only; the viewer fetches a file when it is opened
    // (GET .../documents/:docId/file).
    const supplier = await SupplierProfile.findById(id)
      .select(WITHOUT_DOCUMENT_FILES)
      .populate('user', 'email firstName lastName phone status')
      .populate('approvedBy', 'firstName lastName')
      .populate('blacklistedBy', 'firstName lastName')
      // Named on the page: who submitted for activation, who rejected.
      .populate('activationRequest.requestedBy', 'firstName lastName')
      .populate('rejectedBy', 'firstName lastName');

    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.status(200).json({
      success: true,
      // Read-only oversight (the COO) sees which account, not the full number.
      data: canSeeFullBankDetails(req.user) ? supplier : maskBankNumbers(supplier)
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
