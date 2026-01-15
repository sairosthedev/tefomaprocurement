const { PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');

const rejectRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, comments } = req.body;

    if (!reason && !comments) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

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

    requisition.status = 'rejected';
    requisition.processedBy = req.user._id;
    requisition.statusHistory = requisition.statusHistory || [];
    requisition.statusHistory.push({
      action: 'rejected',
      by: req.user._id,
      role: req.user.role,
      comments: reason || comments
    });

    await requisition.save();

    await createAuditLog({
      action: 'reject',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Procurement rejected requisition: ${requisition.requisitionNumber}`,
      newData: { status: 'rejected', reason: reason || comments },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Requisition rejected',
      data: requisition
    });
  } catch (error) {
    console.error('Reject requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = rejectRequisition;
