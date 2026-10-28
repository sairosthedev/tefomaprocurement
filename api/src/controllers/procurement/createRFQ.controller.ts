import type { Request, Response } from 'express';

import { RFQ, PurchaseRequisition, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { hasEnteredLineItems } from '../../lib/lineItems.js';
import { proposeInvitationsForRequisition } from '../../services/supplierInvitation.service.js';

/**
 * Requisition statuses from which sourcing may legitimately begin (BR-4).
 *
 * `accepted` means stores confirmed the goods are not on a shelf and
 * procurement took the request on; `sourcing` allows a second RFQ against a
 * requisition already being sourced, which happens when a first round draws no
 * usable quotes. Everything earlier — draft, pending_hod, stores_review — is
 * still upstream of the stock check, and everything later is already ordered.
 */
const RFQ_ELIGIBLE_REQUISITION_STATUSES = ['accepted', 'sourcing'];

const createRFQ = async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      title, 
      description, 
      purchaseRequisitionId, 
      items, 
      supplierIds,
      invitedSuppliers: invitedSuppliersFromBody, 
      submissionDeadline,
      deliveryRequirements,
      paymentTerms,
      termsAndConditions,
      status: requestedStatus
    } = req.body;

    // Support both supplierIds and invitedSuppliers for backward compatibility
    let supplierIdArray: any[] = supplierIds || invitedSuppliersFromBody || [];

    /**
     * Where each invited supplier came from. An officer's explicit selection is
     * `manual`; anything the category matcher proposed carries its basis and a
     * reason, so the invitation list can be defended later.
     */
    let invitationBasis = new Map<string, { basis: string; reason: string; categories: string[] }>();

    // Auto-invite: with no suppliers named and a requisition to work from, the
    // category matcher proposes the list rather than refusing the request.
    // Exact category matches, topped up from related categories to the
    // competitive minimum. The client normally pre-fills this so the officer can
    // edit it first; this covers the API caller and the officer who left it blank.
    let autoInvited = false;
    if ((!Array.isArray(supplierIdArray) || supplierIdArray.length === 0) && purchaseRequisitionId) {
      const proposal = await proposeInvitationsForRequisition(purchaseRequisitionId, {
        siteId: req.body.siteId
      });

      if (proposal.proposed.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'No supplier could be matched to this requisition’s categories, so nobody could be ' +
            'invited automatically. Select suppliers manually, or check the requisition lines are categorised.',
          data: { proposal }
        });
      }

      supplierIdArray = proposal.proposed.map((p) => p.supplierId);
      invitationBasis = new Map(
        proposal.proposed.map((p) => [
          p.supplierId,
          { basis: p.basis, reason: p.reason, categories: p.matchedCategories }
        ])
      );
      autoInvited = true;
    }

    if (!Array.isArray(supplierIdArray) || supplierIdArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one supplier must be selected'
      });
    }

    // Pending suppliers may be invited to quote — competition is widened at
    // invitation, not at payment. They still cannot be awarded or issued a PO
    // until KYS completes (see supplierEligibility). Suspended, blacklisted and
    // dormant suppliers remain excluded.
    const suppliers = await SupplierProfile.find({
      _id: { $in: supplierIdArray },
      status: { $in: ['active', 'pending'] },
      isDeleted: false
    });

    if (suppliers.length !== supplierIdArray.length) {
      return res.status(400).json({
        success: false,
        message: 'Some suppliers cannot be invited (suspended, blacklisted, dormant, or not found)'
      });
    }

    // Create invited suppliers array, carrying the provenance of each name.
    const invitedSuppliers = suppliers.map(s => {
      const provenance = invitationBasis.get(String(s._id));
      return {
        supplier: s._id,
        invitedAt: new Date(),
        basis: (provenance?.basis as any) || 'manual',
        autoInvited: Boolean(provenance),
        matchedCategories: provenance?.categories || undefined,
        invitationReason: provenance?.reason || 'Selected by the procurement officer.'
      };
    });

    // Resolve the delivery site for this RFQ: prefer the linked requisition's
    // site, then an explicit body value, else fall back to the user's site/HQ.
    let requisitionSiteId = null;
    if (purchaseRequisitionId) {
      const pr = await PurchaseRequisition.findById(purchaseRequisitionId).select('site status requisitionNumber');

      if (!pr) {
        return res.status(404).json({
          success: false,
          message: 'Linked purchase requisition not found'
        });
      }

      // BR-4: stores must confirm the goods cannot be met from existing stock
      // before anything is sourced externally. Nothing previously checked the
      // requisition's status here, so an RFQ raised while it sat in
      // stores_review skipped that check entirely and the business could buy what it
      // already had on a shelf.
      if (!RFQ_ELIGIBLE_REQUISITION_STATUSES.includes(pr.status)) {
        return res.status(400).json({
          success: false,
          message:
            `Requisition ${pr.requisitionNumber || ''} is at "${String(pr.status).replace(/_/g, ' ')}" and ` +
            'is not ready for sourcing. It must clear the stores stock check and be accepted by procurement first.'
        });
      }

      requisitionSiteId = pr.site || null;
    }
    const siteId = await resolveSiteId(req.user, req.body.siteId || requisitionSiteId);

    // Generate RFQ number
    const count = await RFQ.countDocuments();
    const year = new Date().getFullYear();
    const rfqNumber = `RFQ-${year}-${String(count + 1).padStart(5, '0')}`;

    // Auto-publish: if 'open' status is requested, automatically publish the RFQ
    // (Suppliers are already validated above, so we can safely publish)
    const rfqStatus = requestedStatus === 'open' ? 'open' : 'draft';

    if (rfqStatus === 'open' && !hasEnteredLineItems(items)) {
      return res.status(400).json({
        success: false,
        message: 'RFQ must have at least one item before it can be sent to suppliers'
      });
    }
    
    const rfqData: any = {
      rfqNumber,
      title,
      description,
      site: siteId,
      purchaseRequisition: purchaseRequisitionId || undefined, // Only set if provided
      items,
      invitedSuppliers,
      createdBy: req.user!._id,
      submissionDeadline: new Date(submissionDeadline),
      deliveryRequirements,
      paymentTerms,
      termsAndConditions,
      status: rfqStatus
    };

    // Automatically set publishedAt when status is 'open' (auto-publish)
    if (rfqStatus === 'open') {
      rfqData.publishedAt = new Date();
    }

    const rfq = await RFQ.create(rfqData);

    // Update purchase requisition if linked
    if (purchaseRequisitionId) {
      await PurchaseRequisition.findByIdAndUpdate(purchaseRequisitionId, {
        rfq: rfq._id,
        status: 'sourcing'
      });
    }

    await createAuditLog({
      action: 'create',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description:
        `Created RFQ: ${rfq.rfqNumber} - ${title}` +
        (autoInvited ? ` (${suppliers.length} supplier(s) invited automatically by category match)` : ''),
      newData: { title, supplierCount: suppliers.length, submissionDeadline, autoInvited },
      req
    });

    res.status(201).json({
      success: true,
      data: rfq
    });
  } catch (error: any) {
    console.error('Create RFQ error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default createRFQ;
