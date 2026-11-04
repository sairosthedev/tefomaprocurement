import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { transitionSupplierStatus } from '../../services/supplierEligibility.service.js';
import { withoutDocumentFiles } from '../../services/supplierDocuments.service.js';

const blacklistSupplier = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for blacklisting is required'
      });
    }

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const previousStatus = supplier.status;
    // Withdraws spend authorization along with the status.
    transitionSupplierStatus(supplier, 'blacklisted', req.user!._id, reason);
    supplier.blacklistReason = reason;
    supplier.blacklistedBy = req.user!._id;
    supplier.blacklistedAt = new Date();

    await supplier.save();

    await createAuditLog({
      action: 'status_change',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Blacklisted supplier: ${supplier.companyName}. Reason: ${reason}`,
      previousData: { status: previousStatus },
      newData: { status: 'blacklisted', blacklistReason: reason, transactability: supplier.transactability },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Supplier blacklisted successfully',
      data: withoutDocumentFiles(supplier)
    });
  } catch (error: any) {
    console.error('Blacklist supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default blacklistSupplier;
