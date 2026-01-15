const { PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createRequisition = async (req, res) => {
  try {
    const { items, justification, priority, requiredDate, notes } = req.body;

    // Calculate estimated prices
    const processedItems = items.map(item => ({
      ...item,
      estimatedTotalPrice: item.estimatedUnitPrice ? item.estimatedUnitPrice * item.quantity : 0
    }));

    const requisition = await PurchaseRequisition.create({
      department: req.user.department,
      requestedBy: req.user._id,
      items: processedItems,
      justification,
      priority: priority || 'medium',
      requiredDate: requiredDate ? new Date(requiredDate) : undefined,
      notes,
      status: 'draft'
    });

    await createAuditLog({
      action: 'create',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Created requisition: ${requisition.requisitionNumber}`,
      newData: { itemCount: items.length, priority },
      req
    });

    res.status(201).json({
      success: true,
      data: requisition
    });
  } catch (error) {
    console.error('Create requisition error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = createRequisition;

