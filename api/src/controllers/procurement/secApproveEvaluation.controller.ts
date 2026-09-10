import type { Request, Response } from 'express';
import { getNextReviewDate } from '@fossil/shared';
import { SupplierEvaluation, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const secApproveEvaluation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { approved, secNotes } = req.body;

    const evaluation = await SupplierEvaluation.findById(id).populate('supplier');
    if (!evaluation || evaluation.isDeleted) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    if (!['pending_sec', 'pending_hod'].includes(evaluation.status)) {
      return res.status(400).json({ success: false, message: 'Evaluation is not pending approval' });
    }

    evaluation.secApproved = approved !== false;
    evaluation.secApprovedBy = req.user!._id;
    evaluation.secApprovedAt = new Date();
    evaluation.secNotes = secNotes;
    evaluation.status = approved === false ? 'rejected' : 'approved';

    // The supplier's tier decides when they come round again.
    const supplierForTier = evaluation.supplier
      ? await SupplierProfile.findById(evaluation.supplier).select('tier')
      : null;
    const due = getNextReviewDate(supplierForTier?.tier);
    evaluation.nextReviewDue = due;

    await evaluation.save();

    if (evaluation.status === 'approved' && evaluation.supplier) {
      const supplier = await SupplierProfile.findById(evaluation.supplier);
      if (supplier) {
        supplier.lastEvaluationAt = new Date();
        supplier.nextEvaluationDue = due;
        // A passing evaluation is not a substitute for KYS. Activation here is
        // held to the same gate as approveSupplier and setSupplierStatus.
        if (supplier.status === 'pending' && (supplier.kysComplete || supplier.kysExempt)) {
          supplier.status = 'active';
        }
        await supplier.save();
      }
    }

    await createAuditLog({
      action: approved === false ? 'reject' : 'approve',
      entity: 'SupplierEvaluation',
      entityId: evaluation._id,
      user: req.user,
      description: `SEC approved supplier evaluation`,
      req
    });

    res.status(200).json({ success: true, data: evaluation });
  } catch (error) {
    console.error('SEC approve evaluation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default secApproveEvaluation;
