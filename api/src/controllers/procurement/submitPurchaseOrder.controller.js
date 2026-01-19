const { PurchaseOrder } = require('../../models');
const { createAuditLog } = require('../../middleware');

const submitPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (po.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit purchase order with status: ${po.status}. Only draft purchase orders can be submitted.`
      });
    }

    po.status = 'pending_finance';
    po.approvalHistory.push({
      action: 'submitted',
      by: req.user._id,
      role: req.user.role,
      comments: 'Submitted for Finance approval'
    });

    await po.save();

    await createAuditLog({
      action: 'submit',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Submitted PO: ${po.poNumber} for Finance approval`,
      newData: { status: 'pending_finance' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order submitted for Finance approval',
      data: po
    });
  } catch (error) {
    console.error('Submit PO error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = submitPurchaseOrder;

