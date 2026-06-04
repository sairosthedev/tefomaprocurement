import type { Request, Response } from 'express';

import { PurchaseRequisition, PurchaseOrder, Quotation, Delivery, StoreRequisition } from '../../models/index.js';

const getPendingRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search } = req.query as Record<string, any>;

    const query = { isDeleted: false };
    
    // Default to pending_acceptance for the requisitions page
    if (status) {
      query.status = status;
    } else {
      // Show pending_acceptance by default, or all non-draft (including completed to show delivered items)
      query.status = { $in: ['pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered', 'completed'] };
    }

    if (search) {
      query.$or = [
        { requisitionNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const requisitions = await PurchaseRequisition.find(query)
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName')
      .populate({
        path: 'rfq',
        select: 'rfqNumber status publishedAt closedAt'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Get purchase orders for these requisitions - check both direct link and via RFQ
    const requisitionIds = requisitions.map(r => r._id);
    const rfqIds = requisitions.filter(r => r.rfq).map(r => (r.rfq._id || r.rfq).toString());
    
    // Find POs linked directly to requisitions
    const directPOs = await PurchaseOrder.find({
      purchaseRequisition: { $in: requisitionIds },
      isDeleted: false
    })
      .select('poNumber status financeApproved cooApproved financeApprovedBy cooApprovedBy financeApprovedAt cooApprovedAt purchaseRequisition rfq quotation supplier items totalAmount')
      .populate('supplier', 'companyName')
      .populate('financeApprovedBy', 'firstName lastName')
      .populate('cooApprovedBy', 'firstName lastName')
      .lean();

    // Also find POs linked via RFQ -> quotation -> PO chain
    let rfqLinkedPOs = [];
    if (rfqIds.length > 0) {
      const quotations = await Quotation.find({
        rfq: { $in: rfqIds },
        isDeleted: false
      })
        .select('_id rfq')
        .lean();
      
      const quotationIds = quotations.map(q => q._id);
      
      if (quotationIds.length > 0) {
        rfqLinkedPOs = await PurchaseOrder.find({
          quotation: { $in: quotationIds },
          isDeleted: false
        })
          .select('poNumber status financeApproved cooApproved financeApprovedBy cooApprovedBy financeApprovedAt cooApprovedAt purchaseRequisition rfq quotation supplier items totalAmount')
          .populate('supplier', 'companyName')
          .populate('financeApprovedBy', 'firstName lastName')
          .populate('cooApprovedBy', 'firstName lastName')
          .lean();
      }
    }

    // Combine both PO lists and remove duplicates
    const allPOs = [...directPOs];
    rfqLinkedPOs.forEach(po => {
      if (!allPOs.find(p => p._id.toString() === po._id.toString())) {
        allPOs.push(po);
      }
    });
    
    // Fetch all quotations for RFQs linked to these requisitions
    let allQuotations = [];
    if (rfqIds.length > 0) {
      allQuotations = await Quotation.find({
        rfq: { $in: rfqIds },
        isDeleted: false
      })
        .select('_id quotationNumber rfq supplier status totalAmount currency submittedAt')
        .populate('supplier', 'companyName')
        .sort({ submittedAt: -1 })
        .lean();
    }

    // Create a map of RFQ ID to quotations for lookup
    const rfqToQuotationsMap = {};
    allQuotations.forEach(q => {
      const rfqId = q.rfq?.toString();
      if (rfqId) {
        if (!rfqToQuotationsMap[rfqId]) {
          rfqToQuotationsMap[rfqId] = [];
        }
        rfqToQuotationsMap[rfqId].push(q);
      }
    });

    // Also create a map of RFQ ID to quotation IDs for PO lookup
    const rfqToQuotationMap = {};
    allQuotations.forEach(q => {
      const rfqId = q.rfq?.toString();
      if (rfqId) {
        if (!rfqToQuotationMap[rfqId]) {
          rfqToQuotationMap[rfqId] = [];
        }
        rfqToQuotationMap[rfqId].push(q._id.toString());
      }
    });

    // Get PO IDs to check deliveries
    const poIds = allPOs.map(po => po._id);
    
    // Check which POs have received or accepted deliveries (items in stores)
    // Include 'received' status because receiveGoods auto-accepts, but also check accepted
    const deliveries = await Delivery.find({
      purchaseOrder: { $in: poIds },
      status: { $in: ['received', 'accepted', 'partially_accepted'] },
      isDeleted: false
    })
      .select('purchaseOrder status')
      .lean();
    
    const poWithDeliveries = new Set(
      deliveries.map(d => d.purchaseOrder.toString())
    );

    // Check which requisitions have store requisitions that are issued (items collected)
    // For procurement, we need to check all departments' store requisitions
    const storeRequisitions = await StoreRequisition.find({
      isDeleted: false,
      status: { $in: ['issued', 'partially_issued'] }
    })
      .select('_id purpose status department')
      .lean();
    
    // Create a set of requisition IDs that have collected items
    // We'll match by checking if the store requisition purpose contains the purchase requisition number
    const collectedRequisitionIds = new Set();
    requisitions.forEach(req => {
      const reqNumber = req.requisitionNumber || `PR-${req._id.toString().slice(-6)}`;
      const hasCollected = storeRequisitions.some(sr => 
        sr.purpose && sr.purpose.includes(reqNumber)
      );
      if (hasCollected) {
        collectedRequisitionIds.add(req._id.toString());
      }
    });

    // Map POs and quotations to requisitions
    const requisitionsWithPOs = requisitions.map(req => {
      const reqObj = { ...req };
      
      // Get quotations for this requisition's RFQ
      if (req.rfq) {
        const rfqId = (req.rfq._id || req.rfq).toString();
        (reqObj as any).quotations = rfqToQuotationsMap[rfqId] || [];
      } else {
        (reqObj as any).quotations = [];
      }
      
      // First try direct link via purchaseRequisition
      let po = allPOs.find(p => {
        const poReqId = p.purchaseRequisition?.toString();
        const reqId = req._id.toString();
        return poReqId === reqId;
      });
      
      // If not found, try via RFQ -> quotation -> PO
      if (!po && req.rfq) {
        const rfqId = (req.rfq._id || req.rfq).toString();
        const quotationIds = rfqToQuotationMap[rfqId] || [];
        if (quotationIds.length > 0) {
          po = allPOs.find(p => {
            // Handle both populated and non-populated quotation field
            const poQuotationId = p.quotation?._id ? p.quotation._id.toString() : p.quotation?.toString();
            return quotationIds.includes(poQuotationId);
          });
        }
      }
      
      if (po) {
        (reqObj as any).purchaseOrder = po;
        
        // Check if items have been delivered to stores (received or accepted deliveries exist)
        (reqObj as any).itemsDeliveredToStores = poWithDeliveries.has(po._id.toString());
        
        // Check if items have been collected (store requisition issued)
        (reqObj as any).itemsCollected = collectedRequisitionIds.has(req._id.toString());
        
        // If PO exists, update requisition status to 'ordered' for display
        if (reqObj.status !== 'ordered' && reqObj.status !== 'completed') {
          (reqObj as any).status = 'ordered';
        }
      }
      
      return reqObj;
    });

    res.status(200).json({
      success: true,
      data: requisitionsWithPOs
    });
  } catch (error: any) {
    console.error('Get pending requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getPendingRequisitions;
