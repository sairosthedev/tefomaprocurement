const { PurchaseRequisition, PurchaseOrder, Quotation } = require('../../models');

const getPendingRequisitions = async (req, res) => {
  try {
    const { status, search } = req.query;

    const query = { isDeleted: false };
    
    // Default to pending_acceptance for the requisitions page
    if (status) {
      query.status = status;
    } else {
      // Show pending_acceptance by default, or all non-draft
      query.status = { $in: ['pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered'] };
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

    // Map POs to requisitions
    const requisitionsWithPOs = requisitions.map(req => {
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
        req.purchaseOrder = po;
        // If PO exists, update requisition status to 'ordered' for display
        if (req.status !== 'ordered' && req.status !== 'completed') {
          req.status = 'ordered';
        }
      }
      return req;
    });

    res.status(200).json({
      success: true,
      data: requisitionsWithPOs
    });
  } catch (error) {
    console.error('Get pending requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getPendingRequisitions;
