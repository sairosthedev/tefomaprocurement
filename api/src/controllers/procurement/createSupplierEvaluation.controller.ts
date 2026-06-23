import type { Request, Response } from 'express';
import { SupplierProfile, SupplierEvaluation } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const createSupplierEvaluation = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { scores, recommendation, evaluationType, otherNotes } = req.body;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    if (!scores || !recommendation) {
      return res.status(400).json({ success: false, message: 'Scores and recommendation are required' });
    }

    const finalStatus = recommendation === 'reject' ? 'rejected' : 'approved';
    const now = new Date();
    const nextReviewDue = new Date();
    nextReviewDue.setMonth(nextReviewDue.getMonth() + 3);

    const evaluation = await SupplierEvaluation.create({
      supplier: supplier._id,
      evaluationType: evaluationType || 'initial',
      scores: { ...scores, otherNotes },
      recommendation,
      evaluatedBy: req.user!._id,
      status: finalStatus,
      secApproved: finalStatus === 'approved',
      secApprovedBy: finalStatus === 'approved' ? req.user!._id : undefined,
      secApprovedAt: finalStatus === 'approved' ? now : undefined,
      nextReviewDue
    });

    if (finalStatus === 'approved') {
      supplier.lastEvaluationAt = now;
      supplier.nextEvaluationDue = nextReviewDue;
      await supplier.save();
    }

    await createAuditLog({
      action: 'create',
      entity: 'SupplierEvaluation',
      entityId: evaluation._id,
      user: req.user,
      description: `Recorded supplier evaluation for ${supplier.companyName}`,
      req
    });

    res.status(201).json({ success: true, data: evaluation });
  } catch (error: any) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default createSupplierEvaluation;
