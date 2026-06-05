import type { Request, Response } from 'express';
import { SupplierProfile, SupplierEvaluation } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

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

    const evaluation = await SupplierEvaluation.create({
      supplier: supplier._id,
      evaluationType: evaluationType || 'initial',
      scores: { ...scores, otherNotes },
      recommendation,
      evaluatedBy: req.user!._id,
      status: 'pending_hod'
    });

    await createAuditLog({
      action: 'create',
      entity: 'SupplierEvaluation',
      entityId: evaluation._id,
      user: req.user,
      description: `Created supplier evaluation for ${supplier.companyName} (FC-HQ-P-07 §6.2.4)`,
      req
    });

    await notifyUsersByRole('department_head', {
      type: 'supplier_added',
      title: 'Supplier evaluation pending HOD review',
      message: `Evaluation for ${supplier.companyName} requires HOD review.`,
      entity: 'SupplierEvaluation',
      entityId: evaluation._id,
      relatedUser: req.user!._id
    });

    res.status(201).json({ success: true, data: evaluation });
  } catch (error: any) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default createSupplierEvaluation;
