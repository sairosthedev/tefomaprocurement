import type { Request, Response } from 'express';
import { RFQ } from '../../models/index.js';
import { QUOTATION_WAIVER_TYPES } from '../../models/RFQ.model.js';
import { createAuditLog } from '../../middleware/index.js';
import { isProcurementHead } from '@fossil/shared';

/** Waiver when fewer than 3 quotations */
const approveQuotationWaiver = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason, waiverType, approve = true } = req.body;

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Waiver reason is required' });
    }

    // Validate waiverType up front so a bad value returns a clear 400 rather than
    // an opaque 500 from the Mongoose enum validator at save time.
    if (waiverType !== undefined && !QUOTATION_WAIVER_TYPES.includes(waiverType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid waiver type. Allowed: ${QUOTATION_WAIVER_TYPES.join(', ')}`
      });
    }

    // The head of the Procurement department carries procurement-officer authority
    // across the app, so they may approve a waiver just like a procurement officer.
    const role = req.user!.role;
    const isAuthorized =
      role === 'coo' ||
      role === 'admin' ||
      role === 'procurement_officer' ||
      isProcurementHead(req.user);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Waiver approval requires COO or Procurement Manager'
      });
    }

    rfq.quotationWaiver = {
      waived: approve !== false,
      reason: reason.trim(),
      waiverType: waiverType || 'other',
      approvedBy: req.user!._id,
      approvedAt: new Date()
    };
    await rfq.save();

    await createAuditLog({
      action: approve !== false ? 'approve' : 'reject',
      entity: 'RFQ',
      entityId: rfq._id,
      user: req.user,
      description: `${approve !== false ? 'Approved' : 'Revoked'} quotation waiver for RFQ ${rfq.rfqNumber}`,
      req
    });

    res.status(200).json({
      success: true,
      message: approve !== false ? 'Quotation waiver approved' : 'Quotation waiver revoked',
      data: rfq
    });
  } catch (error) {
    console.error('Approve waiver error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default approveQuotationWaiver;
