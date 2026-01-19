const { PurchaseRequisition, PurchaseOrder, Quotation, Delivery, StoreRequisition } = require('../../models');

const getRequisitions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = { 
      department: req.user.department,
      isDeleted: false 
    };
    
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    
    const [requisitions, total] = await Promise.all([
      PurchaseRequisition.find(query)
        .populate('requestedBy', 'firstName lastName')
        .populate('department', 'name')
        .populate({
          path: 'rfq',
          select: 'rfqNumber status publishedAt closedAt'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PurchaseRequisition.countDocuments(query)
    ]);

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

    // Also find POs linked via RFQ -> quotation -> PO chain (in case purchaseRequisition wasn't set)
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
    
    // Create a map of RFQ ID to quotation IDs for lookup
    const rfqToQuotationMap = {};
    if (rfqIds.length > 0) {
      const quotations = await Quotation.find({
        rfq: { $in: rfqIds },
        isDeleted: false
      })
        .select('_id rfq')
        .lean();
      
      quotations.forEach(q => {
        const rfqId = q.rfq?.toString();
        if (rfqId) {
          if (!rfqToQuotationMap[rfqId]) {
            rfqToQuotationMap[rfqId] = [];
          }
          rfqToQuotationMap[rfqId].push(q._id.toString());
        }
      });
    }

    // Get PO IDs to check deliveries
    const poIds = allPOs.map(po => po._id);
    
    // Check which POs have accepted deliveries (items in stores)
    const acceptedDeliveries = await Delivery.find({
      purchaseOrder: { $in: poIds },
      status: { $in: ['accepted', 'partially_accepted'] },
      isDeleted: false
    })
      .select('purchaseOrder status')
      .lean();
    
    const poWithDeliveries = new Set(
      acceptedDeliveries.map(d => d.purchaseOrder.toString())
    );

    // Check which requisitions have store requisitions that are issued (items collected)
    const storeRequisitions = await StoreRequisition.find({
      department: req.user.department,
      isDeleted: false,
      status: { $in: ['issued', 'partially_issued'] }
    })
      .select('_id purpose status')
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

    // Map POs to requisitions
    const requisitionsWithPOs = requisitions.map(req => {
      const reqObj = req.toObject();
      
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
        reqObj.purchaseOrder = po;
        // Check if items have been delivered to stores (accepted deliveries exist)
        reqObj.itemsDeliveredToStores = poWithDeliveries.has(po._id.toString());
        
        // Check if items have been collected (store requisition issued)
        reqObj.itemsCollected = collectedRequisitionIds.has(req._id.toString());
        
        // Update requisition status based on PO and delivery status
        if (reqObj.itemsDeliveredToStores) {
          // Items are in stores - status should be 'completed' or show as delivered
          if (reqObj.status !== 'completed') {
            reqObj.status = 'ordered'; // Keep as ordered but show delivered to stores
          }
        } else if (po.status === 'completed') {
          // PO is completed but items not yet in stores
          reqObj.status = 'ordered';
        } else if (po.status === 'issued' || po.status === 'partially_received') {
          // PO is issued - items are being delivered
          reqObj.status = 'ordered';
        } else if (po.status === 'approved') {
          // PO is approved but not yet issued
          reqObj.status = 'ordered';
        } else if (po.status === 'pending_approvals' || po.status === 'pending_finance' || po.status === 'pending_coo') {
          // PO is pending approvals
          reqObj.status = 'ordered';
        } else if (po.status === 'draft') {
          // PO is in draft
          reqObj.status = 'ordered';
        } else {
          // If PO exists, update requisition status to 'ordered' for display
          // (even if DB status hasn't been updated yet)
          if (reqObj.status !== 'ordered' && reqObj.status !== 'completed') {
            reqObj.status = 'ordered';
          }
        }
      }
      return reqObj;
    });

    res.status(200).json({
      success: true,
      data: requisitionsWithPOs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getRequisitions;

