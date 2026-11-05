import type { Request, Response } from 'express';

import { SupplierBankChangeRequest, SupplierProfile } from '../../models/index.js';

/** Profile fields a supplier may see of their own record. */
const SUPPLIER_VISIBLE_FIELDS = [
  '_id',
  'user',
  'supplierCode',
  'companyName',
  'tradingName',
  'registrationNumber',
  'vatNumber',
  'taxNumber',
  'address',
  'contactPersons',
  'bankDetails',
  'categories',
  'clientReferrals',
  'website',
  'incorporationDate',
  'proposedBusiness',
  'tradeVolume',
  'tradeProducts',
  'businessType',
  'entityType',
  'status',
  // The values only, without the reasons or who set them: the KYS page reads
  // the tier for which documents are required, and transactability to say
  // whether the account can be awarded work yet.
  'tier',
  'transactability',
  'kysComplete',
  'kysExempt',
  'hasExpiredDocuments',
  'expiredDocumentTypes',
  'approvedAt',
  'createdAt',
  'updatedAt'
] as const;

/**
 * A supplier's own profile, as the supplier sees it. An allow-list rather than
 * the whole record: the record also holds procurement's assessment of the
 * supplier (the reason for its tier, vetting and site-visit notes, blacklist
 * and KYS-exemption reasons, internal notes, status history, the activation
 * request) and staff ids,
 * none of which is the supplier's to read. Document files are not included
 * either: the KYS page fetches each from /supplier/kys/documents/:id/file.
 */
export function supplierSafeProfile(profile: any): Record<string, unknown> {
  const source = typeof profile?.toObject === 'function' ? profile.toObject() : profile || {};
  const safe: Record<string, unknown> = {};
  for (const field of SUPPLIER_VISIBLE_FIELDS) {
    if (source[field] !== undefined) safe[field] = source[field];
  }
  // Onboarding, as far as the supplier's banners need it: that a request is
  // with procurement, but not who raised it or any override reason; and why a
  // registration was turned down, while it stands.
  safe.activationPending = source.status === 'pending' && Boolean(source.activationRequest?.requestedBy);
  if (source.status === 'rejected' && source.rejectionReason) {
    safe.rejectionReason = source.rejectionReason;
    safe.rejectedAt = source.rejectedAt;
  }
  safe.complianceDocuments = (source.complianceDocuments || []).map((doc: any) => ({
    _id: doc._id,
    documentType: doc.documentType,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    expiryDate: doc.expiryDate,
    uploadedAt: doc.uploadedAt,
    verified: doc.verified,
    verifiedAt: doc.verifiedAt,
    // On an unverified document the notes are the reason it was turned
    // down, which the supplier needs to fix it. A verifier's notes on an
    // accepted one are internal.
    ...(doc.verified ? {} : { notes: doc.notes })
  }));
  return safe;
}

const getMyProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    // The document files are megabytes each and not returned, so not read.
    const profile = await SupplierProfile.findOne({ user: req.user!._id }).select('-complianceDocuments.filePath');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    // Where the supplier's latest banking change stands. Only its progress is
    // returned: the account numbers stay on the request itself.
    const bankChange: any = await SupplierBankChangeRequest.findOne({ supplier: profile._id })
      .sort({ createdAt: -1 })
      .select('status createdAt callback.verifiedAt approvedAt rejectedAt rejectionReason appliedAt')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...supplierSafeProfile(profile),
        bankChangeRequest: bankChange
          ? {
              status: bankChange.status,
              requestedAt: bankChange.createdAt,
              verifiedAt: bankChange.callback?.verifiedAt || null,
              approvedAt: bankChange.approvedAt || null,
              rejectedAt: bankChange.rejectedAt || null,
              rejectionReason: bankChange.rejectionReason || null
            }
          : null
      }
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMyProfile;
