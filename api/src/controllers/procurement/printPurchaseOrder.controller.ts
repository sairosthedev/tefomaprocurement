import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';

import { PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { buildPurchaseOrderPdf } from '../../services/purchaseOrderDocument.service.js';

/**
 * Render a purchase order as a PDF (Rev 9 clause 6.3.14).
 *
 * The same document the supplier is emailed, so procurement can see exactly
 * what was sent before sending it.
 */
const printPurchaseOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const po: any = await PurchaseOrder.findById(id)
      .populate('supplier', 'companyName email phone address contactPersons vatNumber registrationNumber')
      .populate('createdBy', 'firstName lastName role')
      .populate('deliverToSite', 'name code address');

    if (!po || po.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase order not found' });
    }

    // A draft has not been approved and must not look like an order the
    // supplier can act on.
    if (po.status === 'draft') {
      return res.status(400).json({
        success: false,
        message: 'This purchase order is still a draft. Approve it before printing.'
      });
    }

    await createAuditLog({
      action: 'view',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: req.user,
      entityLabel: po.poNumber,
      description: `Printed purchase order ${po.poNumber}`,
      req
    });

    const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${po.poNumber}.pdf"`);
    doc.pipe(res);

    buildPurchaseOrderPdf(doc, po);

    doc.end();
  } catch (error: any) {
    console.error('Print purchase order error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Server error' });
    } else {
      res.end();
    }
  }
};

export default printPurchaseOrder;
