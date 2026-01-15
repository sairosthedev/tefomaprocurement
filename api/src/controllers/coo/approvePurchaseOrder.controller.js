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

    if (po.status !== 'pending_coo') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not pending COO approval'
      });
    }

    po.status = 'approved';
    po.approvalHistory.push({
      action: 'coo_approved',
      by: req.user._id,
      role: 'coo',
      comments: comments || 'Approved by COO'
    });

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `COO approved PO: ${po.poNumber}`,
      newData: { status: 'approved' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Purchase order approved by COO',
      data: po
    });
  } catch (error) {
    console.error('COO approve PO error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = approvePurchaseOrder;

