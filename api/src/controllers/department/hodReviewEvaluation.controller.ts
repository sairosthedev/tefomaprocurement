import type { Request, Response } from 'express';
import { SupplierEvaluation } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const hodReviewEvaluation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { approved, comments } = req.body;

    const evaluation = await SupplierEvaluation.findById(id);
    if (!evaluation || evaluation.isDeleted) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }

    if (evaluation.status !== 'pending_hod') {
      return res.status(400).json({ success: false, message: 'Evaluation is not pending HOD review' });
    }

    evaluation.hodReviewedBy = req.user!._id;
    evaluation.hodReviewedAt = new Date();

    if (approved === false) {
      evaluation.status = 'rejected';
      evaluation.recommendation = 'reject';
    } else {
      evaluation.status = 'pending_sec';
    }

    if (comments) evaluation.scores.otherNotes = comments;
    await evaluation.save();

    await createAuditLog({
      action: approved === false ? 'reject' : 'approve',
      entity: 'SupplierEvaluation',
      entityId: evaluation._id,
      user: req.user,
      description: `HOD reviewed supplier evaluation`,
      req
    });

    res.status(200).json({ success: true, data: evaluation });
  } catch (error) {
    console.error('HOD review evaluation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default hodReviewEvaluation;
