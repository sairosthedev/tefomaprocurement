import type { Request, Response } from 'express';
import { SupplierBankChangeRequest, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifySupplier, notifyUsersByRole } from '../../services/notification.service.js';
import {
  approverIsIndependent,
  isKnownContactNumber
} from '../../services/bankChange.service.js';
import { maskBankChangeRequest } from '../../lib/bankMasking.js';

/**
 * Bank-detail change workflow: list → callback verification → approval.
 *
 * The sequence exists to defeat payment-redirection fraud: the change is held
 * (payments paused), someone calls a number ALREADY ON FILE to confirm it, and
 * a second person who did neither of those things approves it.
 */

const OPEN_STATUSES = ['pending_verification', 'pending_approval'];
const REQUEST_STATUSES = [...OPEN_STATUSES, 'approved', 'rejected', 'cancelled'];
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;

/** GET open (or filtered) banking change requests. */
export const getBankChangeRequests = async (req: Request, res: Response): Promise<any> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'open';
    const query: any = {};
    if (status === 'open') {
      query.status = { $in: OPEN_STATUSES };
    } else if (status !== 'all') {
      // Only a known status: anything else would reach the query as given.
      if (!REQUEST_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `Unknown status: ${status}` });
      }
      query.status = status;
    }

    const pageN = parseInt(String(req.query.page), 10);
    const limitN = parseInt(String(req.query.limit), 10);
    const page = pageN > 0 ? pageN : 1;
    const limit = limitN > 0 ? Math.min(MAX_LIST_LIMIT, limitN) : DEFAULT_LIST_LIMIT;

    const [requests, total] = await Promise.all([
      SupplierBankChangeRequest.find(query)
        // The supporting document's file is not needed to list the request.
        .select('-supportingDocument.fileData')
        .populate('supplier', 'companyName registrationNumber status')
        .populate('requestedBy', 'firstName lastName email')
        .populate('callback.verifiedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SupplierBankChangeRequest.countDocuments(query)
    ]);

    // An open request shows its account numbers in full: that is what the
    // callback confirms. Once closed, there is nothing left to verify, so the
    // history shows only enough to tell accounts apart.
    const data = requests.map((request) =>
      OPEN_STATUSES.includes(request.status) ? request : maskBankChangeRequest(request)
    );

    res.status(200).json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get bank change requests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Record the out-of-band callback verification.
 *
 * The number called must already be on the supplier's record — calling a
 * number supplied in the change request reaches whoever raised it and
 * verifies nothing.
 */
export const verifyBankChangeCallback = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { numberCalled, confirmedBy, notes, overrideNumberCheck, overrideReason } = req.body;

    if (!numberCalled?.trim() || !confirmedBy?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'numberCalled and confirmedBy are required to record a callback'
      });
    }

    const request = await SupplierBankChangeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }
    if (request.status !== 'pending_verification') {
      return res.status(400).json({
        success: false,
        message: `Request is ${request.status} and is not awaiting callback verification`
      });
    }

    // Whoever raised the change cannot also be the one who confirms it.
    if (String(request.requestedBy) === String(req.user!._id)) {
      return res.status(403).json({
        success: false,
        message: 'You raised this banking change, so someone else must make the callback to verify it.'
      });
    }

    const supplier = await SupplierProfile.findById(request.supplier).populate('user', 'phone');
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Checked against the numbers on file when the change was requested, so
    // a number added with the change, or since, does not count.
    const numberOnFile = isKnownContactNumber(supplier, numberCalled, request.contactNumbersOnFile);
    if (!numberOnFile) {
      // Allowed only as a deliberate, reasoned exception — it is the single
      // most important property of the control.
      if (!overrideNumberCheck || !overrideReason?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'The number called is not on file for this supplier: it must be one held on the supplier record before this change was requested. Call one of those, or supply overrideNumberCheck with an overrideReason.'
        });
      }
    }

    request.callback = {
      numberCalled: numberCalled.trim(),
      confirmedBy: confirmedBy.trim(),
      verifiedBy: req.user!._id,
      verifiedAt: new Date(),
      notes: overrideNumberCheck && overrideReason
        ? `${notes ? notes + ' — ' : ''}Number not on file. Override reason: ${overrideReason.trim()}`
        : notes
    };
    request.status = 'pending_approval';
    await request.save();

    await createAuditLog({
      action: 'update',
      entity: 'SupplierBankChangeRequest',
      entityId: request._id,
      user: req.user,
      description: `Callback verification recorded for ${supplier.companyName} banking change (called ${numberCalled}, confirmed by ${confirmedBy})`,
      newData: { numberCalled, confirmedBy, numberOnFile },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Callback recorded. A second approver must now authorise the change.',
      data: request
    });
  } catch (error: any) {
    console.error('Verify bank change callback error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/** Approve and apply the change — by someone who neither raised nor verified it. */
export const approveBankChange = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const request = await SupplierBankChangeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }
    if (request.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message:
          request.status === 'pending_verification'
            ? 'Callback verification must be recorded before approval'
            : `Request is already ${request.status}`
      });
    }

    if (!approverIsIndependent(request, req.user!._id)) {
      return res.status(403).json({
        success: false,
        message:
          'A banking change must be approved by someone who neither requested it nor performed the callback verification.'
      });
    }

    const supplier = await SupplierProfile.findById(request.supplier);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const previousDetails = { ...(supplier.bankDetails || {}) };
    supplier.bankDetails = {
      ...(supplier.bankDetails || {}),
      ...request.requestedDetails
    } as any;
    await supplier.save();

    request.status = 'approved';
    request.approvedBy = req.user!._id;
    request.approvedAt = new Date();
    request.appliedAt = new Date();
    await request.save();

    await createAuditLog({
      action: 'approve',
      entity: 'SupplierBankChangeRequest',
      entityId: request._id,
      user: req.user,
      description: `Approved banking change for ${supplier.companyName}: ${request.changes
        .map((c) => c.field)
        .join(', ')}`,
      previousData: previousDetails,
      newData: supplier.bankDetails,
      req
    });

    await notifySupplier(supplier._id, {
      type: 'supplier_bank_change_approved',
      title: 'Banking details updated',
      message: `Your banking change was verified and approved. Payments have resumed.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      relatedUser: req.user!._id
    });
    await notifyUsersByRole(['finance'], {
      type: 'supplier_bank_change_approved',
      title: 'Supplier banking change approved',
      message: `${supplier.companyName}'s banking details have changed and payments are no longer on hold.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      relatedUser: req.user!._id
    });

    res.status(200).json({ success: true, message: 'Banking change approved and applied.', data: request });
  } catch (error: any) {
    console.error('Approve bank change error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/** Reject the change; the supplier's banking details stay as they were. */
export const rejectBankChange = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required' });
    }

    const request = await SupplierBankChangeRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Change request not found' });
    }
    if (!['pending_verification', 'pending_approval'].includes(request.status)) {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    request.status = 'rejected';
    request.rejectedBy = req.user!._id;
    request.rejectedAt = new Date();
    request.rejectionReason = reason.trim();
    await request.save();

    const supplier = await SupplierProfile.findById(request.supplier).select('companyName');

    await createAuditLog({
      action: 'reject',
      entity: 'SupplierBankChangeRequest',
      entityId: request._id,
      user: req.user,
      description: `Rejected banking change for ${supplier?.companyName}: ${reason.trim()}`,
      req
    });

    await notifySupplier(request.supplier, {
      type: 'supplier_bank_change_rejected',
      title: 'Banking change rejected',
      message: `Your banking change was not approved. Reason: ${reason.trim()}`,
      entity: 'SupplierProfile',
      entityId: request.supplier,
      relatedUser: req.user!._id
    });

    res.status(200).json({ success: true, message: 'Banking change rejected.', data: request });
  } catch (error: any) {
    console.error('Reject bank change error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
