import type { Request, Response } from 'express';

import { PurchaseRequisition } from '../../models/index.js';
import { getRfqSourcingProgress } from '../../services/rfqProgress.service.js';
import { requisitionOrderProgress } from '../../lib/requisitionLinks.js';

// The requisition page reads the RFQ's number, title and deadline; where
// sourcing stands comes from `sourcing` below.
const DETAIL_POPULATE = [
  { path: 'department', select: 'name code', options: { lean: true } },
  { path: 'requestedBy', select: 'firstName lastName email', options: { lean: true } },
  { path: 'hodApprovedBy', select: 'firstName lastName', options: { lean: true } },
  { path: 'storesReviewedBy', select: 'firstName lastName', options: { lean: true } },
  { path: 'processedBy', select: 'firstName lastName', options: { lean: true } },
  { path: 'rfq', select: 'rfqNumber title submissionDeadline', options: { lean: true } }
];

const getRequisitionById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const requisition: any = await PurchaseRequisition.findById(id).lean();

    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    // The people and RFQ it references, where sourcing stands, and the PO
    // with its delivery state are independent, so they are fetched together.
    const rfqId = requisition.rfq;
    const populated = PurchaseRequisition.populate(requisition, DETAIL_POPULATE);
    const [, sourcing, order] = await Promise.all([
      populated,
      // Where sourcing stands, so the requester can follow it without access
      // to the RFQ itself.
      rfqId ? getRfqSourcingProgress(rfqId, req.user) : Promise.resolve(null),
      // Procurement sees every department's store requisitions.
      requisitionOrderProgress(requisition, rfqId, populated.then(() => Boolean(requisition.rfq)), {})
    ]);

    if (requisition.rfq) {
      (requisition.rfq as any).sourcing = sourcing;
    }

    if (order) {
      requisition.purchaseOrder = order.purchaseOrder;
      requisition.itemsDeliveredToStores = order.itemsDeliveredToStores;
      requisition.itemsCollected = order.itemsCollected;
    }

    res.status(200).json({
      success: true,
      data: requisition
    });
  } catch (error: any) {
    console.error('Get requisition by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getRequisitionById;
