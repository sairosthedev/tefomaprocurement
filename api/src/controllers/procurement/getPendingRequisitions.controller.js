const { PurchaseRequisition } = require('../../models');

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
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requisitions
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
