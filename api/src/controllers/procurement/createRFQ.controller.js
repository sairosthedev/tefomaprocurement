const { RFQ, PurchaseRequisition, SupplierProfile } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createRFQ = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      purchaseRequisitionId, 
      items, 
      supplierIds, 
      submissionDeadline,
      deliveryRequirements,
      paymentTerms,
      termsAndConditions
    } = req.body;

    // Validate suppliers are active
    const suppliers = await SupplierProfile.find({
      _id: { $in: supplierIds },
      status: 'active',
      isDeleted: false
    });

    if (suppliers.length !== supplierIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some suppliers are not active or do not exist'
      });
    }

    // Create invited suppliers array
    const invitedSuppliers = suppliers.map(s => ({
      supplier: s._id,
      invitedAt: new Date()
    }));

    const rfq = await RFQ.create({
      title,
      description,
      purchaseRequisition: purchaseRequisitionId,
      items,
      invitedSuppliers,
      createdBy: req.user._id,
      submissionDeadline: new Date(submissionDeadline),
      deliveryRequirements,
      paymentTerms,
      termsAndConditions,
      status: 'draft'
    });

    // Update purchase requisition if linked
    if (purchaseRequisitionId) {
      await PurchaseRequisition.findByIdAndUpdate(purchaseRequisitionId, {
        rfq: rfq._id,
        status: 'sourcing'
      });
    }

    await createAuditLog({
      action: 'create',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `Created RFQ: ${rfq.rfqNumber} - ${title}`,
      newData: { title, supplierCount: suppliers.length, submissionDeadline },
      req
    });

    res.status(201).json({
      success: true,
      data: rfq
    });
  } catch (error) {
    console.error('Create RFQ error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = createRFQ;

