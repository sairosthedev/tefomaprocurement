import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { computeKysCompletion } from '@fossil/shared';
import { createAuditLog } from '../../middleware/index.js';

const verifyKys = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { approveForActivation } = req.body;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const completion = computeKysCompletion(supplier.kysChecklist as Record<string, boolean>);
    if (!completion.isComplete) {
      return res.status(400).json({
        success: false,
        message: `KYS incomplete: ${completion.requiredComplete}/${completion.requiredTotal} required items`,
        data: { completion }
      });
    }

    supplier.kysChecklist.verifiedBy = req.user!._id;
    supplier.kysChecklist.verifiedAt = new Date();
    supplier.kysComplete = true;

    if (approveForActivation) {
      supplier.status = 'active';
      supplier.approvedBy = req.user!._id;
      supplier.approvedAt = new Date();
    }

    await supplier.save();

    await createAuditLog({
      action: 'approve',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Verified KYS for ${supplier.companyName} (FC-HQ-P-07 §6.2.3)`,
      req
    });

    res.status(200).json({
      success: true,
      message: approveForActivation ? 'KYS verified and supplier activated' : 'KYS verified',
      data: supplier
    });
  } catch (error) {
    console.error('Verify KYS error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default verifyKys;
