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
          select: '_id rfqNumber status publishedAt closedAt'
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
      .populate('purchaseRequisition', '_id requisitionNumber') // Populate to ensure we can match it
      .populate('rfq', '_id purchaseRequisition') // Also populate RFQ to check purchaseRequisition link
      .lean();
    
    // Also find POs by RFQ directly (in case purchaseRequisition wasn't set)
    // Convert rfqIds to ObjectIds if they're strings
    const rfqObjectIds = rfqIds.map(id => {
      try {
        return typeof id === 'string' ? require('mongoose').Types.ObjectId(id) : id;
      } catch {
        return id;
      }
    });
    
    // Find POs by RFQ ID
    const rfqPOs = rfqObjectIds.length > 0 ? await PurchaseOrder.find({
      rfq: { $in: rfqObjectIds },
      isDeleted: false
    })
      .select('poNumber status financeApproved cooApproved financeApprovedBy cooApprovedBy financeApprovedAt cooApprovedAt purchaseRequisition rfq quotation supplier items totalAmount')
      .populate('supplier', 'companyName')
      .populate('financeApprovedBy', 'firstName lastName')
      .populate('cooApprovedBy', 'firstName lastName')
      .populate('rfq', '_id purchaseRequisition') // Populate RFQ to check purchaseRequisition link
      .populate('quotation', '_id')
      .lean() : [];
    
    // Also find POs via RFQ's purchaseRequisition field (another way to link)
    // First get RFQs that have purchaseRequisition matching our requisitions
    const RFQ = require('../../models').RFQ;
    const rfqsWithRequisitions = rfqObjectIds.length > 0 ? await RFQ.find({
      _id: { $in: rfqObjectIds },
      purchaseRequisition: { $in: requisitionIds },
      isDeleted: false
    })
      .select('_id purchaseRequisition')
      .lean() : [];
    
    // Get RFQ IDs that match our requisitions
    const matchingRfqIds = rfqsWithRequisitions.map(rfq => rfq._id);
    
    // Find POs for those RFQs
    const rfqViaReqPOs = matchingRfqIds.length > 0 ? await PurchaseOrder.find({
      rfq: { $in: matchingRfqIds },
      isDeleted: false
    })
      .select('poNumber status financeApproved cooApproved financeApprovedBy cooApprovedBy financeApprovedAt cooApprovedAt purchaseRequisition rfq quotation supplier items totalAmount')
      .populate('supplier', 'companyName')
      .populate('financeApprovedBy', 'firstName lastName')
      .populate('cooApprovedBy', 'firstName lastName')
      .populate('rfq', '_id purchaseRequisition')
      .populate('quotation', '_id')
      .lean() : [];

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
          .populate('quotation', '_id') // Populate quotation to ensure we can match it
          .lean();
      }
    }

    // Combine all PO lists and remove duplicates
    const allPOs = [...directPOs];
    rfqLinkedPOs.forEach(po => {
      if (!allPOs.find(p => p._id.toString() === po._id.toString())) {
        allPOs.push(po);
      }
    });
    rfqPOs.forEach(po => {
      if (!allPOs.find(p => p._id.toString() === po._id.toString())) {
        allPOs.push(po);
      }
    });
    rfqViaReqPOs.forEach(po => {
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
      const reqId = req._id.toString();
      
      // First try direct link via purchaseRequisition on PO
      let po = allPOs.find(p => {
        // Handle both populated and non-populated purchaseRequisition field
        let poReqId = null;
        if (p.purchaseRequisition) {
          if (typeof p.purchaseRequisition === 'object' && p.purchaseRequisition._id) {
            poReqId = p.purchaseRequisition._id.toString();
          } else {
            poReqId = p.purchaseRequisition.toString();
          }
        }
        // Also check if RFQ's purchaseRequisition matches (in case PO's purchaseRequisition wasn't set)
        if (!poReqId && p.rfq && p.rfq.purchaseRequisition) {
          const rfqReqId = typeof p.rfq.purchaseRequisition === 'object' 
            ? (p.rfq.purchaseRequisition._id ? p.rfq.purchaseRequisition._id.toString() : p.rfq.purchaseRequisition.toString())
            : p.rfq.purchaseRequisition.toString();
          if (rfqReqId === reqId) {
            poReqId = reqId;
          }
        }
        return poReqId === reqId;
      });
      
      // If not found, try via RFQ directly
      if (!po && req.rfq) {
        const rfqId = (req.rfq._id || req.rfq).toString();
        po = allPOs.find(p => {
          // Handle both ObjectId and string comparison
          const poRfqId = p.rfq ? (p.rfq._id ? p.rfq._id.toString() : p.rfq.toString()) : null;
          return poRfqId === rfqId;
        });
      }
      
      // If still not found, try via RFQ -> quotation -> PO
      if (!po && req.rfq) {
        const rfqId = (req.rfq._id || req.rfq).toString();
        const quotationIds = rfqToQuotationMap[rfqId] || [];
        if (quotationIds.length > 0) {
          po = allPOs.find(p => {
            // Handle both populated and non-populated quotation field
            let poQuotationId = null;
            if (p.quotation) {
              if (typeof p.quotation === 'object' && p.quotation._id) {
                poQuotationId = p.quotation._id.toString();
              } else {
                poQuotationId = p.quotation.toString();
              }
            }
            return poQuotationId && quotationIds.includes(poQuotationId);
          });
        }
      }
      
      if (po) {
        reqObj.purchaseOrder = po;
        // Check if items have been delivered to stores (received or accepted deliveries exist)
        reqObj.itemsDeliveredToStores = poWithDeliveries.has(po._id.toString());
        
        // Check if items have been collected (store requisition issued)
        reqObj.itemsCollected = collectedRequisitionIds.has(req._id.toString());
        
        // If PO exists, ALWAYS update requisition status to 'ordered' for display
        // (even if DB status hasn't been updated yet)
        if (reqObj.status !== 'ordered' && reqObj.status !== 'completed') {
          reqObj.status = 'ordered';
        }
      } else {
        // Debug: Log if PO not found for requisition with RFQ
        if (req.rfq) {
          console.log(`[DEBUG] PO not found for requisition ${req.requisitionNumber || reqId}, RFQ: ${(req.rfq._id || req.rfq).toString()}, All POs: ${allPOs.length}, RFQ POs: ${rfqPOs.length}, RFQ Linked POs: ${rfqLinkedPOs.length}`);
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

