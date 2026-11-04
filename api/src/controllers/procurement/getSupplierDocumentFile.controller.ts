import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import { sendDocumentFile } from '../../services/supplierDocuments.service.js';

/**
 * One compliance document's file, for the procurement-side viewer.
 *
 * Supplier reads no longer carry file bodies (they are stored inline and a
 * full KYS file runs past the response cap), so the viewer fetches the one it
 * opens. Same access as the supplier record itself.
 */
const getSupplierDocumentFile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id, docId } = req.params;

    // The positional projection returns only the matching document.
    const supplier: any = await SupplierProfile.findOne({
      _id: id,
      'complianceDocuments._id': docId
    })
      .select({ isDeleted: 1, 'complianceDocuments.$': 1 })
      .lean();

    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    sendDocumentFile(res, supplier.complianceDocuments?.[0]);
  } catch (error: any) {
    console.error('Get supplier document file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getSupplierDocumentFile;
