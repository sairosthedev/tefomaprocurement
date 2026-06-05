import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { addComplianceDocument } from '../../services/supplierDocuments.service.js';

const uploadSupplierDocument = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
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
      description: `Uploaded KYS document (${req.body.documentType}) for ${supplier.companyName}`,
      newData: { documentType: req.body.documentType, kysComplete: supplier.kysComplete },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Document uploaded',
      data: supplier
    });
  } catch (error: any) {
    console.error('Upload supplier document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default uploadSupplierDocument;
