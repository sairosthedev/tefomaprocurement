import type { Request, Response } from 'express';
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

    if (evaluation.status !== 'pending_sec') {
      return res.status(400).json({ success: false, message: 'Evaluation is not pending SEC approval' });
    }

    evaluation.secApproved = approved !== false;
    evaluation.secApprovedBy = req.user!._id;
    evaluation.secApprovedAt = new Date();
    evaluation.secNotes = secNotes;
    evaluation.status = approved === false ? 'rejected' : 'approved';

    const due = new Date();
    due.setMonth(due.getMonth() + 3);
    evaluation.nextReviewDue = due;

    await evaluation.save();

    if (evaluation.status === 'approved' && evaluation.supplier) {
      const supplier = await SupplierProfile.findById(evaluation.supplier);
      if (supplier) {
        supplier.lastEvaluationAt = new Date();
        supplier.nextEvaluationDue = due;
        if (supplier.status === 'pending') supplier.status = 'active';
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
