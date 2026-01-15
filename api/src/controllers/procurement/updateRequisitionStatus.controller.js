const { PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');

const updateRequisitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Get new status from URL path if not in body
    const newStatus = status || req.path.split('/').pop();
    
    const validStatuses = ['accepted', 'sourcing', 'quoted', 'ordered', 'completed'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    const previousStatus = requisition.status;
    requisition.status = newStatus;
    requisition.statusHistory = requisition.statusHistory || [];
    requisition.statusHistory.push({
      action: newStatus === 'sourcing' ? 'rfq_created' : newStatus,
      by: req.user._id,
      role: req.user.role,
      comments: `Status changed from ${previousStatus} to ${newStatus}`
    });

    await requisition.save();

    await createAuditLog({
      action: 'update_status',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Updated requisition status to ${newStatus}`,
      previousData: { status: previousStatus },
      newData: { status: newStatus },
      req
    });

    res.status(200).json({
      success: true,
      message: `Requisition status updated to ${newStatus}`,
      data: requisition
    });
  } catch (error) {
    console.error('Update requisition status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = updateRequisitionStatus;

