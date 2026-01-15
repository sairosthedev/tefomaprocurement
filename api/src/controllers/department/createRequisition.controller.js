const { PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createRequisition = async (req, res) => {
  try {
    const { 
      title, 
      description, // Used as justification
      urgency, // Maps to priority
      items, 
      justification, 
      priority, 
      requiredDate, 
      notes,
      status 
    } = req.body;

    // Validate required fields
    if (!title && !items?.length) {
      return res.status(400).json({
        success: false,
        message: 'Title and at least one item are required'
      });
    }

    // Calculate estimated prices and process items
    const processedItems = (items || []).map(item => ({
      description: item.description,
      specification: item.specification || item.specifications,
      quantity: item.quantity || 1,
      unit: item.unit || 'Each',
      estimatedUnitPrice: item.estimatedUnitPrice || 0,
      estimatedTotalPrice: item.estimatedUnitPrice ? item.estimatedUnitPrice * item.quantity : 0
    }));

    // Generate requisition number
    const count = await PurchaseRequisition.countDocuments();
    const year = new Date().getFullYear();
    const requisitionNumber = `PR-${year}-${String(count + 1).padStart(5, '0')}`;

    // Map urgency to priority if needed
    let mappedPriority = priority || 'medium';
    if (urgency === 'high') mappedPriority = 'high';
    else if (urgency === 'normal') mappedPriority = 'medium';

    const requisition = await PurchaseRequisition.create({
      requisitionNumber,
      title: title || 'Untitled Requisition',
      department: req.user.department || null,
      requestedBy: req.user._id,
      items: processedItems,
      justification: justification || description || '',
      priority: mappedPriority,
      requiredDate: requiredDate ? new Date(requiredDate) : undefined,
      notes,
      status: status === 'pending' ? 'pending_acceptance' : 'draft'
    });

    await createAuditLog({
      action: 'create',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Created requisition: ${requisition.requisitionNumber}`,
      newData: { title, itemCount: processedItems.length, priority: mappedPriority },
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

