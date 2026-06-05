import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { computeKysCompletion } from '@fosssil/shared';
import { createAuditLog } from '../../middleware/index.js';

const updateKysChecklist = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { checklist, clientReferrals } = req.body;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    if (checklist) {
      supplier.kysChecklist = { ...supplier.kysChecklist, ...checklist, completedBy: req.user!._id, completedAt: new Date() };
    }

    if (clientReferrals && Array.isArray(clientReferrals)) {
      supplier.clientReferrals = clientReferrals;
      if (clientReferrals.length >= 3) {
        supplier.kysChecklist.clientReferrals = true;
      }
    }

    const completion = computeKysCompletion(supplier.kysChecklist as Record<string, boolean>);
    supplier.kysComplete = completion.isComplete;

    await supplier.save();

    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Updated KYS checklist for ${supplier.companyName}`,
      newData: { kysComplete: supplier.kysComplete, percentComplete: completion.percentComplete },
      req
    });

    res.status(200).json({
      success: true,
      message: 'KYS checklist updated',
      data: { supplier, completion }
    });
  } catch (error: any) {
    console.error('Update KYS error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default updateKysChecklist;
