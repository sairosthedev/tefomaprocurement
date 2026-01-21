const { PurchaseOrder } = require('../../models');

const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await PurchaseOrder.findById(id)
      .populate('supplier', 'companyName contactEmail contactPhone address')
      .populate('createdBy', 'firstName lastName email')
      .populate('quotation', 'quotationNumber currency submittedAt')
      .populate('financeApprovedBy', 'firstName lastName')
      .populate('cooApprovedBy', 'firstName lastName')
      .populate('purchaseRequisition', 'requisitionNumber title department')
      .populate({
        path: 'purchaseRequisition',
        populate: {
          path: 'department',
          select: 'name code'
        }
      })
      .lean();

    if (!order || order.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get purchase order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getPurchaseOrderById;






