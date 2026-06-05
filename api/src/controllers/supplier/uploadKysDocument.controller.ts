import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { addComplianceDocument } from '../../services/supplierDocuments.service.js';
import { notifyUsersByRole } from '../../services/notification.service.js';

const uploadKysDocument = async (req: Request, res: Response): Promise<any> => {
  try {
    const supplier = await SupplierProfile.findOne({ user: req.user!._id });
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier profile not found' });
    }

    const result = addComplianceDocument(supplier, req.body, req.user!._id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, message: result.message });
    }

    await supplier.save();

    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Supplier uploaded KYS document (${req.body.documentType})`,
      newData: { documentType: req.body.documentType, kysComplete: supplier.kysComplete },
      req
    });

    // Let procurement know there is a document to review
    await notifyUsersByRole('procurement_officer', {
      type: 'supplier_added',
      title: 'KYS document uploaded',
      message: `${supplier.companyName} uploaded a KYS document for review.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({ success: true, message: 'Document uploaded', data: supplier });
  } catch (error: any) {
    console.error('Supplier upload KYS document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default uploadKysDocument;
