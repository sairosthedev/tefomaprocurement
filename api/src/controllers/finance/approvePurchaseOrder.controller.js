const { PurchaseOrder } = require('../../models');
const { createAuditLog } = require('../../middleware');

const approvePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po || po.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (po.status !== 'pending_finance') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not pending finance approval'
      });
    }

    po.status = 'pending_coo';
    po.approvalHistory.push({
      action: 'finance_approved',
      by: req.user._id,
      role: 'finance',
      comments: comments || 'Approved by Finance'
    });

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Finance approved PO: ${po.poNumber}`,
      newData: { status: 'pending_coo' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order approved by Finance',
      data: po
    });
  } catch (error) {
    console.error('Approve PO error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = approvePurchaseOrder;

