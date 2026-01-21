const { PurchaseOrder } = require('../../models');
const { createAuditLog } = require('../../middleware');
const { notifyUsersByRole, notifySupplier } = require('../../services/notification.service');

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

    // Check if PO is pending approvals and Finance hasn't approved yet
    if (po.status !== 'pending_approvals') {
      return res.status(400).json({
        success: false,
        message: 'Purchase order is not pending approvals'
      });
    }

    if (po.financeApproved) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order has already been approved by Finance'
      });
    }

    // Mark Finance approval
    po.financeApproved = true;
    po.financeApprovedBy = req.user._id;
    po.financeApprovedAt = new Date();
    po.approvalHistory.push({
      action: 'finance_approved',
      by: req.user._id,
      role: 'finance',
      comments: comments || 'Approved by Finance'
    });

    // Check if both approvals are complete
    if (po.financeApproved && po.cooApproved) {
      po.status = 'approved';
    }

    await po.save();

    await createAuditLog({
      action: 'approve',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Finance approved PO: ${po.poNumber}`,
      newData: { 
        financeApproved: true,
        status: po.status 
      },
      req
    });

    // Notify procurement and COO
    await notifyUsersByRole(po.status === 'approved' ? ['procurement_officer', 'coo'] : ['procurement_officer'], {
      type: po.status === 'approved' ? 'po_coo_approved' : 'po_finance_approved',
      title: po.status === 'approved' ? 'Purchase Order Fully Approved' : 'Purchase Order Approved by Finance',
      message: po.status === 'approved' 
        ? `Purchase Order ${po.poNumber} has been fully approved and is ready for issuance.`
        : `Purchase Order ${po.poNumber} has been approved by Finance. ${po.cooApproved ? 'All approvals complete.' : 'Awaiting COO approval.'}`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user._id,
      metadata: { poNumber: po.poNumber, status: po.status }
    });

    // Notify supplier if fully approved
    if (po.status === 'approved') {
      await notifySupplier(po.supplier, {
        type: 'po_coo_approved',
        title: 'Purchase Order Approved',
        message: `Purchase Order ${po.poNumber} has been fully approved and is ready for processing.`,
        entity: 'PurchaseOrder',
        entityId: po._id,
        relatedUser: req.user._id,
        metadata: { poNumber: po.poNumber }
      });
    }

    res.status(200).json({
      success: true,
      message: po.status === 'approved' 
        ? 'Purchase order approved by Finance. All approvals complete.' 
        : 'Purchase order approved by Finance. Awaiting COO approval.',
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

