const { PurchaseOrder, Quotation, RFQ } = require('../../models');
const { createAuditLog } = require('../../middleware');

const createPurchaseOrder = async (req, res) => {
  try {
    const { 
      quotationId, 
      deliveryAddress, 
      expectedDeliveryDate,
      termsAndConditions,
      notes 
    } = req.body;

    const quotation = await Quotation.findById(quotationId)
      .populate('rfq')
      .populate('supplier');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    if (quotation.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Can only create PO from accepted quotations'
      });
    }

    // Create PO items from quotation items
    const poItems = quotation.items.map(item => ({
      description: item.description,
      specifications: item.specifications,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      quantityReceived: 0
    }));

    const po = await PurchaseOrder.create({
      quotation: quotation._id,
      rfq: quotation.rfq?._id,
      purchaseRequisition: quotation.rfq?.purchaseRequisition,
      supplier: quotation.supplier._id,
      createdBy: req.user._id,
      items: poItems,
      subtotal: quotation.subtotal,
      vatAmount: quotation.vatAmount,
      totalAmount: quotation.totalAmount,
      deliveryAddress,
      expectedDeliveryDate: new Date(expectedDeliveryDate),
      paymentTerms: quotation.paymentTerms,
      termsAndConditions,
      notes,
      status: 'draft',
      approvalHistory: [{
        action: 'created',
        by: req.user._id,
        role: req.user.role,
        comments: 'Purchase Order created'
      }]
    });

    await createAuditLog({
      action: 'create',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Created PO: ${po.poNumber} from quotation ${quotation.quotationNumber}`,
      newData: { poNumber: po.poNumber, totalAmount: po.totalAmount },
      req
    });

    res.status(201).json({
      success: true,
      data: po
    });
  } catch (error) {
    console.error('Create PO error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = createPurchaseOrder;

