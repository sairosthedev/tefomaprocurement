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
    
    console.log(`[DEBUG] Department Requisitions - Requisition IDs: ${requisitionIds.length}, RFQ IDs: ${rfqIds.length}`);
    console.log(`[DEBUG] Requisition Numbers:`, requisitions.map(r => r.requisitionNumber || r._id.toString()));
    if (rfqIds.length > 0) {
      console.log(`[DEBUG] RFQ IDs:`, rfqIds);
    }
    
    // Find POs linked directly to requisitions
    console.log(`[DEBUG] Searching for POs with requisitionIds:`, requisitionIds.map(id => id.toString()));
    
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
    
    console.log(`[DEBUG] Direct POs found: ${directPOs.length}`);
    if (directPOs.length > 0) {
      directPOs.forEach(po => {
        const reqId = po.purchaseRequisition ? (po.purchaseRequisition._id || po.purchaseRequisition).toString() : 'null';
        console.log(`[DEBUG] Found PO: ${po.poNumber}, purchaseRequisition: ${reqId}`);
      });
    }
    
    // Check ALL POs to see what they're linked to
    const allPOsInDB = await PurchaseOrder.find({ isDeleted: false })
      .select('poNumber purchaseRequisition rfq')
      .populate('purchaseRequisition', '_id requisitionNumber')
      .populate('rfq', '_id purchaseRequisition')
      .lean();
    
    console.log(`[DEBUG] All ${allPOsInDB.length} POs in database:`);
    allPOsInDB.forEach(po => {
      const poReqId = po.purchaseRequisition ? (po.purchaseRequisition._id || po.purchaseRequisition).toString() : 'null';
      const rfqId = po.rfq ? (po.rfq._id || po.rfq).toString() : 'null';
      const rfqReqId = po.rfq?.purchaseRequisition ? (typeof po.rfq.purchaseRequisition === 'object' ? po.rfq.purchaseRequisition._id?.toString() : po.rfq.purchaseRequisition.toString()) : 'null';
      console.log(`  PO: ${po.poNumber}, direct purchaseRequisition: ${poReqId}, rfq: ${rfqId}, rfq.purchaseRequisition: ${rfqReqId}`);
    });
    
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
    
    console.log(`[DEBUG] RFQ POs found: ${rfqPOs.length} for ${rfqObjectIds.length} RFQs`);
    
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
    
    console.log(`[DEBUG] RFQ Via Req POs found: ${rfqViaReqPOs.length} for ${matchingRfqIds.length} matching RFQs`);

    // Also find POs linked via RFQ -> quotation -> PO chain (in case purchaseRequisition wasn't set)
    let rfqLinkedPOs = [];
    if (rfqIds.length > 0) {
      // Use the same rfqObjectIds we already converted
      const quotations = rfqObjectIds.length > 0 ? await Quotation.find({
        rfq: { $in: rfqObjectIds },
        isDeleted: false
      })
        .select('_id rfq')
        .lean() : [];
      
      console.log(`[DEBUG] Quotations found: ${quotations.length} for ${rfqObjectIds.length} RFQs`);
      
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
        
        console.log(`[DEBUG] RFQ Linked POs found: ${rfqLinkedPOs.length} for ${quotationIds.length} quotations`);
      }
    }

    // Combine all PO lists and remove duplicates
    const allPOsMap = new Map();
    
    [...directPOs, ...rfqLinkedPOs, ...rfqPOs, ...rfqViaReqPOs].forEach(po => {
      const poId = po._id.toString();
      if (!allPOsMap.has(poId)) {
        allPOsMap.set(poId, po);
        console.log(`[DEBUG] Added PO: ${po.poNumber}, purchaseRequisition: ${po.purchaseRequisition?._id || po.purchaseRequisition}, rfq: ${po.rfq?._id || po.rfq}`);
      }
    });
    
    const allPOs = Array.from(allPOsMap.values());
    
    // Debug: Log PO counts
    console.log(`[DEBUG] Department Requisitions - Found ${allPOs.length} total POs (direct: ${directPOs.length}, rfqLinked: ${rfqLinkedPOs.length}, rfqPOs: ${rfqPOs.length}, rfqViaReq: ${rfqViaReqPOs.length})`);
    
    // Also check if there are ANY POs in the database for debugging
    const totalPOsInDB = await PurchaseOrder.countDocuments({ isDeleted: false });
    console.log(`[DEBUG] Total POs in database: ${totalPOsInDB}`);
    
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

    // Map POs to requisitions - try ALL possible methods
    const requisitionsWithPOs = requisitions.map(req => {
      const reqObj = req.toObject();
      const reqId = req._id.toString();
      let po = null;
      
      // Method 1: Direct link via purchaseRequisition on PO
      po = allPOs.find(p => {
        let poReqId = null;
        if (p.purchaseRequisition) {
          if (typeof p.purchaseRequisition === 'object' && p.purchaseRequisition._id) {
            poReqId = p.purchaseRequisition._id.toString();
          } else {
            poReqId = p.purchaseRequisition.toString();
          }
        }
        return poReqId === reqId;
      });
      
      // Method 2: Via RFQ's purchaseRequisition field
      if (!po) {
        po = allPOs.find(p => {
          if (p.rfq && p.rfq.purchaseRequisition) {
            const rfqReqId = typeof p.rfq.purchaseRequisition === 'object' 
              ? (p.rfq.purchaseRequisition._id ? p.rfq.purchaseRequisition._id.toString() : p.rfq.purchaseRequisition.toString())
              : p.rfq.purchaseRequisition.toString();
            return rfqReqId === reqId;
          }
          return false;
        });
      }
      
      // Method 3: Via RFQ directly (match RFQ ID)
      if (!po && req.rfq) {
        const rfqId = (req.rfq._id || req.rfq).toString();
        po = allPOs.find(p => {
          if (!p.rfq) return false;
          const poRfqId = typeof p.rfq === 'object' 
            ? (p.rfq._id ? p.rfq._id.toString() : p.rfq.toString())
            : p.rfq.toString();
          return poRfqId === rfqId;
        });
      }
      
      // Method 4: Via RFQ -> quotation -> PO chain
      if (!po && req.rfq) {
        const rfqId = (req.rfq._id || req.rfq).toString();
        const quotationIds = rfqToQuotationMap[rfqId] || [];
        if (quotationIds.length > 0) {
          po = allPOs.find(p => {
            if (!p.quotation) return false;
            let poQuotationId = null;
            if (typeof p.quotation === 'object' && p.quotation._id) {
              poQuotationId = p.quotation._id.toString();
            } else {
              poQuotationId = p.quotation.toString();
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

