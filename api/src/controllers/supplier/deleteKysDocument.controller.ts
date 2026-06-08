import type { Request, Response } from 'express';
import { computeKysCompletion, getChecklistKeyForDocType } from '@fossil/shared';
import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const deleteKysDocument = async (req: Request, res: Response): Promise<any> => {
  try {
    const { docId } = req.params;

    const supplier = await SupplierProfile.findOne({ user: req.user!._id });
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier profile not found' });
    }

    const doc = supplier.complianceDocuments?.find((d: any) => d._id?.toString() === docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Do not allow removing a document procurement already verified
    if (doc.verified) {
      return res.status(400).json({ success: false, message: 'Verified documents cannot be removed' });
    }

    supplier.complianceDocuments = supplier.complianceDocuments.filter(
      (d: any) => d._id?.toString() !== docId
    );

    const checklistKey = getChecklistKeyForDocType(doc.documentType);
    if (checklistKey) {
      (supplier.kysChecklist as any)[checklistKey] = false;
    }

    const completion = computeKysCompletion(supplier.kysChecklist as Record<string, boolean>);
    supplier.kysComplete = completion.isComplete;

    await supplier.save();

    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Supplier removed KYS document (${doc.documentType})`,
      req
    });

    res.status(200).json({ success: true, message: 'Document removed', data: supplier });
  } catch (error: any) {
    console.error('Supplier delete KYS document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default deleteKysDocument;
