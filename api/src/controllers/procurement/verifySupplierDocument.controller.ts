import type { Request, Response } from 'express';
import { computeKysCompletionForTier, getChecklistKeyForDocType } from '@fossil/shared';
import { SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifySupplier } from '../../services/notification.service.js';

/**
 * Verify or reject a single uploaded compliance document.
 *
 * Until now `verified` was never set true by any code path: uploading any file
 * auto-ticked its checklist item, so an unopened document satisfied a KYS
 * requirement, and the supplier-side "verified documents cannot be removed"
 * guard could never fire. Verification is the step where a human actually
 * opens the file.
 *
 * Rejecting a document unticks the checklist item it was credited for, so a
 * rejected document cannot leave the supplier looking compliant.
 */
export const verifySupplierDocument = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id, docId } = req.params;
    const { verified, notes } = req.body as { verified?: boolean; notes?: string };

    const isRejection = verified === false;
    if (isRejection && !notes?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required when rejecting a document'
      });
    }

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const doc = supplier.complianceDocuments?.find((d: any) => d._id?.toString() === docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const checklistKey = getChecklistKeyForDocType(doc.documentType);

    if (isRejection) {
      doc.verified = false;
      doc.verifiedBy = undefined;
      doc.verifiedAt = undefined;
      doc.notes = notes!.trim();
      // A rejected document no longer counts toward KYS.
      if (checklistKey) {
        (supplier.kysChecklist as any)[checklistKey] = false;
      }
    } else {
      doc.verified = true;
      doc.verifiedBy = req.user!._id;
      doc.verifiedAt = new Date();
      if (notes?.trim()) doc.notes = notes.trim();
      if (checklistKey) {
        (supplier.kysChecklist as any)[checklistKey] = true;
      }
    }

    const completion = computeKysCompletionForTier(
      supplier.kysChecklist as Record<string, boolean>,
      supplier.tier
    );
    supplier.kysComplete = completion.isComplete;

    await supplier.save();

    await createAuditLog({
      action: isRejection ? 'reject' : 'approve',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: isRejection
        ? `Rejected ${doc.documentType} for ${supplier.companyName}: ${notes!.trim()}`
        : `Verified ${doc.documentType} for ${supplier.companyName}`,
      newData: { documentType: doc.documentType, verified: doc.verified, kysComplete: supplier.kysComplete },
      req
    });

    await notifySupplier(supplier._id, {
      type: isRejection ? 'supplier_document_rejected' : 'supplier_document_verified',
      title: isRejection ? 'Compliance document rejected' : 'Compliance document verified',
      message: isRejection
        ? `Your ${doc.documentType.replace(/_/g, ' ')} was not accepted: ${notes!.trim()} Please upload a corrected document.`
        : `Your ${doc.documentType.replace(/_/g, ' ')} has been verified.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      relatedUser: req.user!._id,
      metadata: { documentType: doc.documentType }
    });

    res.status(200).json({
      success: true,
      message: isRejection ? 'Document rejected' : 'Document verified',
      data: { document: doc, completion }
    });
  } catch (error: any) {
    console.error('Verify supplier document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default verifySupplierDocument;
