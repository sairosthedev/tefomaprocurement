import type { Request, Response } from 'express';

import { RFQ, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifySupplier } from '../../services/notification.service.js';

const publishRFQ = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    if (rfq.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft RFQs can be published'
      });
    }

    if (!rfq.invitedSuppliers || rfq.invitedSuppliers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'RFQ must have at least one invited supplier'
      });
    }

    rfq.status = 'open';
    rfq.publishedAt = new Date();
    await rfq.save();

    // Notify all invited suppliers
    for (const invitation of rfq.invitedSuppliers) {
      await notifySupplier(invitation.supplier, {
        type: 'rfq_published',
        title: 'New RFQ Published',
        message: `A new RFQ ${rfq.rfqNumber} has been published. Submission deadline: ${new Date(rfq.submissionDeadline).toLocaleDateString()}`,
        entity: 'RFQ',
        entityId: rfq._id,
        relatedUser: req.user!._id,
        metadata: { 
          deadline: rfq.submissionDeadline,
          rfqNumber: rfq.rfqNumber
        }
      });
    }

    await createAuditLog({
      action: 'status_change',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `Published RFQ: ${rfq.rfqNumber}`,
      previousData: { status: 'draft' },
      newData: { status: 'open' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'RFQ published successfully',
      data: rfq
    });
  } catch (error: any) {
    console.error('Publish RFQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default publishRFQ;
