import type { Request, Response } from 'express';
import { PurchaseRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';

const fulfillRequisitionFromStock = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const requisition = await PurchaseRequisition.findById(id);
    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }

    if (requisition.status !== 'stores_review') {
      return res.status(400).json({
        success: false,
        message: 'Requisition is not in stores review'
      });
    }

    requisition.status = 'fulfilled';
    requisition.storesReviewedBy = req.user!._id;
    requisition.storesReviewedAt = new Date();
    requisition.storesReviewNotes = notes || 'Fulfilled from stock';
    requisition.statusHistory.push({
      action: 'fulfilled_from_stock',
      by: req.user!._id,
      role: req.user!.role,
      comments: notes || 'Issued from stock — no external purchase required (FC-HQ-P-07 §6.3.2)'
    });

    await requisition.save();

    await createAuditLog({
      action: 'status_change',
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      user: req.user,
      description: `Fulfilled PR ${requisition.requisitionNumber} from stock`,
      newData: { status: 'fulfilled' },
      req
    });

    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_accepted',
      title: 'Request fulfilled from stores',
      message: `Your requisition ${requisition.requisitionNumber} was fulfilled from stock.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({
      success: true,
      message: 'Requisition fulfilled from stock',
      data: requisition
    });
  } catch (error) {
    console.error('Fulfill from stock error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default fulfillRequisitionFromStock;
