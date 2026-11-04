import type { Request, Response } from 'express';

import { RFQ, SupplierProfile, Quotation } from '../../models/index.js';

/** The RFQ statuses a supplier's list shows; drafts have not been sent to them. */
export const SUPPLIER_LISTED_RFQ_STATUSES = ['open', 'closed', 'evaluating', 'awarded'];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Paging and status filter for the supplier's own lists. Query values can
 * arrive as arrays or objects, so only strings are read; a requested status
 * is narrowed to the ones the supplier may see (none matching means an empty
 * list, never an unfiltered one); and the page size is capped.
 */
export function supplierListQuery(query: Request['query'], visible: readonly string[]) {
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const pageN = parseInt(text(query.page), 10);
  const limitN = parseInt(text(query.limit), 10);
  const page = pageN > 0 ? pageN : 1;
  const limit = limitN > 0 ? Math.min(MAX_PAGE_SIZE, limitN) : DEFAULT_PAGE_SIZE;
  const requested = text(query.status).split(',').map((s) => s.trim()).filter(Boolean);
  const statuses = requested.length ? visible.filter((s) => requested.includes(s)) : [...visible];
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    statuses,
    /** Whether a status was asked for, for lists that otherwise apply none. */
    statusRequested: requested.length > 0
  };
}

const getMyRFQs = async (req: Request, res: Response): Promise<any> => {
  try {
    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const { page, limit, skip, statuses } = supplierListQuery(req.query, SUPPLIER_LISTED_RFQ_STATUSES);

    const query: any = {
      isDeleted: false,
      'invitedSuppliers.supplier': profile._id,
      status: { $in: statuses }
    };

    const [rfqs, total] = await Promise.all([
      RFQ.find(query)
        // Only this supplier's own invitation: the rest of the list (and the
        // other suppliers' quote statuses) is not theirs to see. Lines carry
        // what the row shows, without the photos — the RFQ page loads those.
        .select({
          rfqNumber: 1,
          title: 1,
          description: 1,
          'items._id': 1,
          'items.description': 1,
          'items.specifications': 1,
          'items.quantity': 1,
          'items.unit': 1,
          submissionDeadline: 1,
          status: 1,
          publishedAt: 1,
          invitedSuppliers: { $elemMatch: { supplier: profile._id } }
        })
        .populate('invitedSuppliers.quotation', 'status quotationNumber')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      RFQ.countDocuments(query)
    ]);

    // Add responded status and quotation status for each RFQ
    const rfqsWithStatus = rfqs.map(rfq => {
      const invitation = rfq.invitedSuppliers?.find(
        inv => {
          const supplierId = inv.supplier?._id || inv.supplier;
          return supplierId.toString() === profile._id.toString();
        }
      );
      
      // Get quotation status if quotation exists
      let quotationStatus = null;
      if (invitation?.quotation) {
        const quotation = invitation.quotation;
        quotationStatus = quotation.status || null;
      }

      // When procurement asks for a revised price the supplier must be able to
      // submit again, so treat a revision request as "not yet submitted".
      const revisionRequested = quotationStatus === 'revision_requested';
      const hasSubmitted = (invitation?.responded || false) && !revisionRequested;

      // The invitation is summarised below rather than sent as-is.
      const { invitedSuppliers: _invitation, ...row } = rfq.toObject();
      return {
        ...row,
        hasResponded: invitation?.responded || false,
        hasSubmitted,
        revisionRequested,
        quotationStatus: quotationStatus
      };
    });

    res.status(200).json({
      success: true,
      data: rfqsWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get my RFQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMyRFQs;
