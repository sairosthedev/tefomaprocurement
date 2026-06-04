import type { Request, Response } from 'express';

import { RFQ, PurchaseRequisition, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';

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
    const supplierIdArray = supplierIds || invitedSuppliersFromBody || [];
    
    if (!Array.isArray(supplierIdArray) || supplierIdArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one supplier must be selected'
      });
    }

    // Validate suppliers are active
    const suppliers = await SupplierProfile.find({
      _id: { $in: supplierIdArray },
      status: 'active',
      isDeleted: false
    });

    if (suppliers.length !== supplierIdArray.length) {
      return res.status(400).json({
        success: false,
        message: 'Some suppliers are not active or do not exist'
      });
    }

    // Create invited suppliers array
    const invitedSuppliers = suppliers.map(s => ({
      supplier: s._id,
      invitedAt: new Date()
    }));

    // Resolve the delivery site for this RFQ: prefer the linked requisition's
    // site, then an explicit body value, else fall back to the user's site/HQ.
    let requisitionSiteId = null;
    if (purchaseRequisitionId) {
      const pr = await PurchaseRequisition.findById(purchaseRequisitionId).select('site');
      requisitionSiteId = pr?.site || null;
    }
    const siteId = await resolveSiteId(req.user, req.body.siteId || requisitionSiteId);

    // Generate RFQ number
    const count = await RFQ.countDocuments();
    const year = new Date().getFullYear();
    const rfqNumber = `RFQ-${year}-${String(count + 1).padStart(5, '0')}`;

    // Auto-publish: if 'open' status is requested, automatically publish the RFQ
    // (Suppliers are already validated above, so we can safely publish)
    const rfqStatus = requestedStatus === 'open' ? 'open' : 'draft';
    
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
      description: `Created RFQ: ${rfq.rfqNumber} - ${title}`,
      newData: { title, supplierCount: suppliers.length, submissionDeadline },
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
