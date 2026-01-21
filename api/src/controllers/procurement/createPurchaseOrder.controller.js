const { PurchaseOrder, Quotation, RFQ, PurchaseRequisition } = require('../../models');
const { createAuditLog } = require('../../middleware');
const { notifySupplier, notifyUsersByRole } = require('../../services/notification.service');

const createPurchaseOrder = async (req, res) => {
  try {
    const { 
      quotationId, 
      deliveryAddress, 
      expectedDeliveryDate,
      termsAndConditions,
      notes 
    } = req.body;

    if (!quotationId) {
      return res.status(400).json({
        success: false,
        message: 'Quotation ID is required'
      });
    }

    const quotation = await Quotation.findById(quotationId)
      .populate({
        path: 'rfq',
        populate: {
          path: 'purchaseRequisition',
          select: '_id requisitionNumber'
        }
      })
      .populate('supplier');

    if (!quotation || quotation.isDeleted) {
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

    // Check if a PO already exists for this quotation
    const existingPO = await PurchaseOrder.findOne({
      quotation: quotationId,
      isDeleted: false
    });

    if (existingPO) {
      return res.status(400).json({
        success: false,
        message: `A Purchase Order already exists for this quotation. PO Number: ${existingPO.poNumber}`,
        data: existingPO
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

    // Generate PO number
    const count = await PurchaseOrder.countDocuments();
    const year = new Date().getFullYear();
    const poNumber = `PO-${year}-${String(count + 1).padStart(5, '0')}`;

    // Get purchaseRequisition from RFQ - fetch RFQ separately if needed
    let purchaseRequisitionId = null;
    if (quotation.rfq) {
      const rfqId = quotation.rfq._id || quotation.rfq;
      // Fetch RFQ to get purchaseRequisition (in case it wasn't populated)
      const rfq = await RFQ.findById(rfqId).select('purchaseRequisition').lean();
      purchaseRequisitionId = rfq?.purchaseRequisition || null;
    }
    
    const po = await PurchaseOrder.create({
      poNumber,
      quotation: quotation._id,
      rfq: quotation.rfq?._id || quotation.rfq,
      purchaseRequisition: purchaseRequisitionId,
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

    // Update Purchase Requisition status to 'ordered' if it exists
    if (po.purchaseRequisition) {
      const requisition = await PurchaseRequisition.findById(po.purchaseRequisition);
      if (requisition && requisition.status !== 'ordered' && requisition.status !== 'completed') {
        const previousStatus = requisition.status;
        requisition.status = 'ordered';
        requisition.statusHistory.push({
          action: 'po_created',
          by: req.user._id,
          role: req.user.role,
          comments: `Purchase order ${po.poNumber} created`
        });
        await requisition.save();

        await createAuditLog({
          action: 'status_change',
          entity: 'PurchaseRequisition',
          entityId: requisition._id,
          user: req.user,
          description: `Requisition ${requisition.requisitionNumber} status updated to ordered`,
          previousData: { status: previousStatus },
          newData: { status: 'ordered' },
          req
        });
      }
    }

    await createAuditLog({
      action: 'create',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      description: `Created PO: ${po.poNumber} from quotation ${quotation.quotationNumber}`,
      newData: { poNumber: po.poNumber, totalAmount: po.totalAmount },
      req
    });

    // Notify supplier
    await notifySupplier(quotation.supplier._id || quotation.supplier, {
      type: 'po_created',
      title: 'New Purchase Order Created',
      message: `A new Purchase Order ${po.poNumber} has been created and requires your acknowledgement.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user._id,
      metadata: { poNumber: po.poNumber, totalAmount: po.totalAmount, isSupplier: true }
    });

    // Notify finance and COO for approval
    await notifyUsersByRole(['finance', 'coo'], {
      type: 'po_created',
      title: 'New Purchase Order Created',
      message: `Purchase Order ${po.poNumber} has been created and requires approval.`,
      entity: 'PurchaseOrder',
      entityId: po._id,
      relatedUser: req.user._id,
      metadata: { poNumber: po.poNumber, totalAmount: po.totalAmount }
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

