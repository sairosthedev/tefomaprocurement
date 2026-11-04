import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { sendDocumentFile } from '../../services/supplierDocuments.service.js';

/**
 * One of the signed-in supplier's own KYS documents. Scoped to the profile
 * owned by the requesting user, so a document id from another supplier finds
 * nothing.
 */
const getKysDocumentFile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { docId } = req.params;

    const supplier: any = await SupplierProfile.findOne({
      user: req.user!._id,
      'complianceDocuments._id': docId
    })
      .select({ isDeleted: 1, 'complianceDocuments.$': 1 })
      .lean();

    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    sendDocumentFile(res, supplier.complianceDocuments?.[0]);
  } catch (error: any) {
    console.error('Supplier get KYS document file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getKysDocumentFile;
