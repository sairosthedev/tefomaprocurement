const { PurchaseOrder, SupplierProfile } = require('../../models');

const getMyPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await SupplierProfile.findOne({ user: req.user._id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    const order = await PurchaseOrder.findOne({
      _id: id,
      supplier: profile._id,
      isDeleted: false
    })
      .populate('quotation', 'quotationNumber currency rfq')
      .populate({
        path: 'quotation',
        populate: {
          path: 'rfq',
          select: 'rfqNumber title'
        }
      })
      .populate('rfq', 'rfqNumber title')
      .populate('purchaseRequisition', 'requisitionNumber title')
      .lean();
    
    // Add currency from quotation if not directly on order
    if (order && order.quotation && order.quotation.currency && !order.currency) {
      order.currency = order.quotation.currency;
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Add acknowledgment status
    const isAcknowledged = order.approvalHistory?.some(
      h => h.action === 'acknowledged' && h.by.toString() === req.user._id.toString()
    );
    order.isAcknowledged = isAcknowledged || false;

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get my purchase order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getMyPurchaseOrderById;

