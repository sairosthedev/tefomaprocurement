import type { Request, Response } from 'express';
import { computeKysCompletion, getChecklistKeyForDocType } from '@fossil/shared';
import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const deleteSupplierDocument = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id, docId } = req.params;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const doc = supplier.complianceDocuments?.find((d: any) => d._id?.toString() === docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    supplier.complianceDocuments = supplier.complianceDocuments.filter(
      (d: any) => d._id?.toString() !== docId
    );

    // Untick the checklist item this document satisfied
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
      description: `Removed KYS document (${doc.documentType}) for ${supplier.companyName}`,
      req
    });

    res.status(200).json({ success: true, message: 'Document removed', data: supplier });
  } catch (error: any) {
    console.error('Delete supplier document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default deleteSupplierDocument;
