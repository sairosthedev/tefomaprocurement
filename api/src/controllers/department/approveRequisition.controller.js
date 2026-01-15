const { PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');

const approveRequisition = async (req, res) => {
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

    if (requisition.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: 'Requisition is not pending approval'
      });
    }

    // Verify department head is approving their department's requisition
    if (requisition.department.toString() !== req.user.department?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve requisitions from your department'
      });
    }

    requisition.status = 'approved';
    requisition.approvalHistory.push({
      action: 'approved',
      by: req.user._id,
      role: req.user.role,
      comments: comments || 'Approved by department head'
    });

    await requisition.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Approved requisition: ${requisition.requisitionNumber}`,
      newData: { status: 'approved' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Requisition approved',
      data: requisition
    });
  } catch (error) {
    console.error('Approve requisition error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = approveRequisition;

