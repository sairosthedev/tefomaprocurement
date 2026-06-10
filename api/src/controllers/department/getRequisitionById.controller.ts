import type { Request, Response } from 'express';
import { PurchaseRequisition, PurchaseOrder, Quotation, Delivery, StoreRequisition } from '../../models/index.js';

const getRequisitionById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const scope: any = { _id: id, isDeleted: false };
    if (req.user!.role === 'end_user') {
      scope.requestedBy = req.user!._id;
    } else {
      scope.department = req.user!.department;
    }

    const requisition: any = await PurchaseRequisition.findOne(scope)
      .populate('department', 'name code')
      .populate('requestedBy', 'firstName lastName email')
      .populate('hodApprovedBy', 'firstName lastName')
      .populate('storesReviewedBy', 'firstName lastName')
      .populate('processedBy', 'firstName lastName')
      .populate({
        path: 'rfq',
        select: 'rfqNumber status publishedAt closedAt title description items submissionDeadline'
      })
      .lean();

    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // Find PO linked directly or via RFQ
    let po = await PurchaseOrder.findOne({
      purchaseRequisition: id,
      isDeleted: false
    })
      .select('poNumber status financeApproved cooApproved financeApprovedBy cooApprovedBy financeApprovedAt cooApprovedAt purchaseRequisition rfq quotation supplier items totalAmount')
      .populate('supplier', 'companyName')
      .populate('financeApprovedBy', 'firstName lastName')
      .populate('cooApprovedBy', 'firstName lastName')
      .lean();

    // If not found, try via RFQ -> quotation -> PO
    if (!po && requisition.rfq) {
      const rfqId = (requisition.rfq._id || requisition.rfq).toString();
      const quotations = await Quotation.find({
        rfq: rfqId,
        isDeleted: false
      })
        .select('_id rfq')
        .lean();

      const quotationIds = quotations.map(q => q._id);

      if (quotationIds.length > 0) {
        po = await PurchaseOrder.findOne({
          quotation: { $in: quotationIds },
          isDeleted: false
        })
          .select('poNumber status financeApproved cooApproved financeApprovedBy cooApprovedBy financeApprovedAt cooApprovedAt purchaseRequisition rfq quotation supplier items totalAmount')
          .populate('supplier', 'companyName')
          .populate('financeApprovedBy', 'firstName lastName')
          .populate('cooApprovedBy', 'firstName lastName')
          .lean();
      }
    }

    if (po) {
      (requisition as any).purchaseOrder = po;

      // Check deliveries
      const deliveries = await Delivery.find({
        purchaseOrder: po._id,
        status: { $in: ['received', 'accepted', 'partially_accepted'] },
        isDeleted: false
      })
        .select('purchaseOrder status')
        .lean();

      (requisition as any).itemsDeliveredToStores = deliveries.length > 0;

      // Check store requisitions
      const storeRequisitions = await StoreRequisition.find({
        department: req.user!.department,
        isDeleted: false,
        status: { $in: ['issued', 'partially_issued'] }
      })
        .select('_id purpose status')
        .lean();

      const reqNumber = requisition.requisitionNumber || `PR-${requisition._id.toString().slice(-6)}`;
      (requisition as any).itemsCollected = storeRequisitions.some(sr =>
        sr.purpose && sr.purpose.includes(reqNumber)
      );
    }

    res.status(200).json({
      success: true,
      data: requisition
    });
  } catch (error) {
    console.error('Get requisition by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getRequisitionById;
