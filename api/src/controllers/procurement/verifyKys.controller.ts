import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { computeKysCompletion } from '@fossil/shared';
import { createAuditLog } from '../../middleware/index.js';

const verifyKys = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { approveForActivation, overrideKys, reason } = req.body;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const completion = computeKysCompletion(supplier.kysChecklist as Record<string, boolean>);

    if (overrideKys) {
      if (!reason?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required to activate a supplier without KYS'
        });
      }

      supplier.kysExempt = true;
      supplier.kysExemptReason = reason.trim();
      supplier.kysExemptBy = req.user!._id;
      supplier.kysExemptAt = new Date();
    } else if (!completion.isComplete) {
      return res.status(400).json({
        success: false,
        message: `KYS incomplete: ${completion.requiredComplete}/${completion.requiredTotal} required items`,
        data: { completion }
      });
    } else {
      supplier.kysChecklist.verifiedBy = req.user!._id;
      supplier.kysChecklist.verifiedAt = new Date();
      supplier.kysComplete = true;
    }

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
      description: overrideKys
        ? `Activated supplier without KYS override from KYS page: ${supplier.companyName}. Reason: ${reason.trim()}`
        : `Verified KYS for ${supplier.companyName}`,
      req
    });

    res.status(200).json({
      success: true,
      message: overrideKys
        ? 'Supplier activated without KYS (override applied)'
        : approveForActivation
          ? 'KYS verified and supplier activated'
          : 'KYS verified',
      data: supplier
    });
  } catch (error) {
    console.error('Verify KYS error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default verifyKys;
