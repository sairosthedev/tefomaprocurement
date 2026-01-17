const { PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');

const acceptRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    if (requisition.status !== 'pending_acceptance') {
      return res.status(400).json({
        success: false,
        message: 'Requisition is not pending acceptance'
      });
    }

    requisition.status = 'accepted';
    requisition.processedBy = req.user._id;
    requisition.statusHistory = requisition.statusHistory || [];
    requisition.statusHistory.push({
      action: 'accepted',
      by: req.user._id,
      role: req.user.role,
      comments: comments || 'Accepted by Procurement'
    });

    await requisition.save();

    await createAuditLog({
      action: 'accept',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Procurement accepted requisition: ${requisition.requisitionNumber}`,
      newData: { status: 'accepted' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Requisition accepted',
      data: requisition
    });
  } catch (error) {
    console.error('Accept requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = acceptRequisition;






