const { PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');

const submitRequisition = async (req, res) => {
  try {
    const { id } = req.params;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    if (requisition.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft requisitions can be submitted'
      });
    }

    if (requisition.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own requisitions'
      });
    }

    requisition.status = 'pending_approval';
    requisition.approvalHistory.push({
      action: 'submitted',
      by: req.user._id,
      role: req.user.role,
      comments: 'Submitted for approval'
    });

    await requisition.save();

    await createAuditLog({
      action: 'submit',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Submitted requisition: ${requisition.requisitionNumber}`,
      newData: { status: 'pending_approval' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Requisition submitted for approval',
      data: requisition
    });
  } catch (error) {
    console.error('Submit requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = submitRequisition;

