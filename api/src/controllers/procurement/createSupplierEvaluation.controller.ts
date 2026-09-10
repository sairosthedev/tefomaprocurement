import type { Request, Response } from 'express';
import { SUPPLIER_EVALUATION_CRITERIA, getNextReviewDate, getReviewIntervalMonths } from '@fossil/shared';
import { SupplierProfile, SupplierEvaluation } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

const VALID_RECOMMENDATIONS = ['approve', 'reject', 'conditional', 're_evaluate_later'];

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

    if (!VALID_RECOMMENDATIONS.includes(recommendation)) {
      return res.status(400).json({
        success: false,
        message: `Invalid recommendation. Allowed values: ${VALID_RECOMMENDATIONS.join(', ')}`
      });
    }

    // Range-check here rather than letting the schema throw a 500.
    const badScores = SUPPLIER_EVALUATION_CRITERIA.map((c) => c.key).filter((key) => {
      const value = (scores as any)[key];
      if (value === undefined || value === null) return false;
      return typeof value !== 'number' || value < 1 || value > 5;
    });
    if (badScores.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Scores must be numbers between 1 and 5. Invalid: ${badScores.join(', ')}`
      });
    }

    // Review cadence follows the supplier's tier rather than a flat quarter:
    // a transactional vendor does not warrant the same cycle as a sole-source
    // one, and a uniform cadence is what made the review backlog unworkable.
    const nextReviewDue = getNextReviewDate(supplier.tier);

    // The evaluator does not approve their own evaluation. It enters the
    // review chain at pending_hod (Rev 9 clause 5.6: HOD review, then SEC
    // sign-off), which is what makes hodReviewEvaluation and
    // secApproveEvaluation reachable at all. The supplier's
    // lastEvaluationAt/nextEvaluationDue are stamped only on final approval.
    const evaluation = await SupplierEvaluation.create({
      supplier: supplier._id,
      evaluationType: evaluationType || 'initial',
      scores: { ...scores, otherNotes },
      recommendation,
      evaluatedBy: req.user!._id,
      status: 'pending_hod',
      secApproved: false,
      nextReviewDue
    });

    await createAuditLog({
      action: 'create',
      entity: 'SupplierEvaluation',
      entityId: evaluation._id,
      user: req.user,
      description: `Recorded supplier evaluation for ${supplier.companyName} (pending HOD review)`,
      newData: {
        status: 'pending_hod',
        recommendation,
        tier: supplier.tier,
        reviewIntervalMonths: getReviewIntervalMonths(supplier.tier)
      },
      req
    });

    await notifyUsersByRole(['department_head'], {
      type: 'supplier_evaluation_due',
      title: 'Supplier evaluation awaiting review',
      message: `An evaluation for ${supplier.companyName} is awaiting your review.`,
      entity: 'SupplierEvaluation',
      entityId: evaluation._id,
      relatedUser: req.user!._id,
      metadata: { companyName: supplier.companyName }
    });

    res.status(201).json({
      success: true,
      message: 'Evaluation submitted for HOD review.',
      data: evaluation
    });
  } catch (error: any) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default createSupplierEvaluation;
