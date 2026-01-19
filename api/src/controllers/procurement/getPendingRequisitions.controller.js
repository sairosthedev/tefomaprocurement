const { PurchaseRequisition, PurchaseOrder } = require('../../models');

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
      .populate('rfq')
      .sort({ createdAt: -1 })
      .lean();

    // Get purchase orders for these requisitions
    const requisitionIds = requisitions.map(r => r._id);
    const purchaseOrders = await PurchaseOrder.find({
      purchaseRequisition: { $in: requisitionIds },
      isDeleted: false
    })
      .select('poNumber status financeApproved cooApproved financeApprovedAt cooApprovedAt purchaseRequisition')
      .lean();

    // Map POs to requisitions
    const requisitionsWithPOs = requisitions.map(req => {
      const po = purchaseOrders.find(p => p.purchaseRequisition?.toString() === req._id.toString());
      if (po) {
        req.purchaseOrder = po;
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
