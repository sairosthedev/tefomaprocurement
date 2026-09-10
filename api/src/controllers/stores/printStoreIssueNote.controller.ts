import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';

import { StoreRequisition } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { buildStoreIssueNotePdf } from '../../services/storeIssueDocument.service.js';

/**
 * Render a Stores Issue Note as a PDF — the document a collector signs for
 * goods leaving the store, and the counterpart to the GRV.
 */
const printStoreIssueNote = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const requisition: any = await StoreRequisition.findById(id)
      .populate('items.item', 'name description itemCode unit')
      .populate('department', 'name code')
      .populate('site', 'name code')
      .populate('requestedBy', 'firstName lastName role')
      .populate('issuedBy', 'firstName lastName role')
      .populate('approvedBy', 'firstName lastName role');

    if (!requisition || requisition.isDeleted) {
      return res.status(404).json({ success: false, message: 'Store requisition not found' });
    }

    // Nothing has left the store until something is issued, so there is no
    // collection to evidence and no note to sign.
    if (!['partially_issued', 'issued'].includes(requisition.status)) {
      return res.status(400).json({
        success: false,
        message: 'No stock has been issued against this requisition yet.'
      });
    }

    const noteNumber = requisition.issueNoteNumber || 'SIN-DRAFT';

    await createAuditLog({
      action: 'view',
      entity: 'StoreRequisition',
      entityId: requisition._id,
      user: req.user,
      entityLabel: requisition.requisitionNumber,
      description: `Printed stores issue note ${noteNumber}`,
      req
    });

    const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${noteNumber}.pdf"`);
    doc.pipe(res);

    buildStoreIssueNotePdf(doc, requisition);

    doc.end();
  } catch (error: any) {
    console.error('Print store issue note error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Server error' });
    } else {
      res.end();
    }
  }
};

export default printStoreIssueNote;
