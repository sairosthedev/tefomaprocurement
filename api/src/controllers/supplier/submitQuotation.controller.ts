import type { Request, Response } from 'express';

import { Quotation, RFQ, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { currentBaseCurrency } from '../../tenancy/sbuContext.js';
import { notifyUsersByRole } from '../../services/notification.service.js';
import { sanitiseAttachments } from '../../services/lineAttachments.service.js';
import { refuseInvalid } from '../../lib/validation.js';
import { validateQuotation } from '@fossil/shared';

/** A JSON number, or a numeric string from a form field; anything else is NaN. */
const toNumber = (value: any): number =>
  typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

/** A term in whole days, at least one, or null when it is not one. */
const toDays = (value: any): number | null => {
  const n = toNumber(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

const optionalText = (value: any): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const isBlank = (value: any) => value === undefined || value === null || value === '';

/** Supplier statuses that may quote. A pending supplier is invited deliberately
 *  and completes KYS while the RFQ is open; award and PO still require active
 *  (see supplierEligibility). A rejected registration may not quote, even on
 *  an RFQ it was invited to while still pending. */
const QUOTING_STATUSES = ['active', 'pending'];

const submitQuotation = async (req: Request, res: Response): Promise<any> => {
  try {
    // The same checks as the quotation form: terms, and a price on every line sent.
    if (refuseInvalid(res, validateQuotation(req.body))) return;

    const { 
      rfqId, 
      items, 
      validityPeriod, 
      deliveryPeriod, 
      paymentTerms,
      currency,
      notes 
    } = req.body;

    const profile = await SupplierProfile.findOne({ user: req.user!._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    if (!QUOTING_STATUSES.includes(profile.status)) {
      return res.status(403).json({
        success: false,
        message:
          profile.status === 'rejected'
            ? 'Your supplier registration was not approved, so you cannot submit quotations. Contact procurement.'
            : 'Your supplier account is not active'
      });
    }

    const rfq = await RFQ.findById(rfqId);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'RFQ not found'
      });
    }

    // A prior quotation for this RFQ+supplier blocks resubmission UNLESS it is a
    // revision that procurement asked for — then the new quote supersedes it.
    const existingQuotation = await Quotation.findOne({
      rfq: rfqId,
      supplier: profile._id,
      isDeleted: false,
      status: { $nin: ['superseded'] }
    });
    const isRevision = existingQuotation?.status === 'revision_requested';

    // A revision resubmission is allowed after close/deadline (procurement
    // explicitly re-opened it). A fresh submission still requires an open RFQ
    // within the deadline.
    if (!isRevision) {
      if (rfq.status !== 'open') {
        return res.status(400).json({
          success: false,
          message: 'RFQ is not open for submissions'
        });
      }
      if (new Date() > new Date(rfq.submissionDeadline)) {
        return res.status(400).json({
          success: false,
          message: 'Submission deadline has passed'
        });
      }
    }

    // Check if supplier was invited
    const isInvited = rfq.invitedSuppliers.some(
      inv => inv.supplier.toString() === profile._id.toString()
    );
    if (!isInvited) {
      return res.status(403).json({
        success: false,
        message: 'You are not invited to this RFQ'
      });
    }

    if (existingQuotation && !isRevision) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a quotation for this RFQ'
      });
    }

    const deliveryDays = toDays(deliveryPeriod);
    if (deliveryDays === null) {
      return res.status(400).json({
        success: false,
        message: 'Delivery period must be a whole number of days, at least 1'
      });
    }
    const validityDays = isBlank(validityPeriod) ? 30 : toDays(validityPeriod);
    if (validityDays === null) {
      return res.status(400).json({
        success: false,
        message: 'Validity period must be a whole number of days, at least 1'
      });
    }

    // A quote may price some of the RFQ's lines, but not none of them.
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Price at least one line of the RFQ' });
    }

    // Each stored line is built from the RFQ line it answers, taking from the
    // request only what the supplier decides: price, VAT treatment, brand,
    // notes and any alternative offered. The total is worked out here, never
    // taken from the client. Lines are bound by rfqLineId, falling back to a
    // description match when the client did not send one (legacy quote forms).
    const normalize = (s: string) => (s || '').toLowerCase().trim();
    const rfqLines = new Map((rfq.items as any[]).map((rl) => [String(rl._id), rl]));
    const quotedLines = new Set<string>();
    const boundItems: any[] = [];
    for (const [index, item] of (items as any[]).entries()) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({ success: false, message: `Line ${index + 1} is not a valid quote line` });
      }

      let rfqLine: any;
      if (item.rfqLineId) {
        rfqLine = rfqLines.get(String(item.rfqLineId));
        if (!rfqLine) {
          return res.status(400).json({ success: false, message: `Line ${index + 1} is not a line of this RFQ` });
        }
      } else {
        // Two RFQ lines may share a description; take the first not yet quoted.
        const matches = (rfq.items as any[]).filter(
          (rl) => normalize(rl.description) === normalize(item.description)
        );
        rfqLine = matches.find((rl) => !quotedLines.has(String(rl._id))) || matches[0];
      }
      if (rfqLine) {
        // Two prices for one line would leave the award to guess which one stands.
        const key = String(rfqLine._id);
        if (quotedLines.has(key)) {
          return res.status(400).json({ success: false, message: `"${rfqLine.description}" is quoted more than once` });
        }
        quotedLines.add(key);
      }

      const description: string | undefined = rfqLine ? rfqLine.description : optionalText(item.description);
      if (!description) {
        return res.status(400).json({ success: false, message: `Line ${index + 1} needs a description` });
      }

      // Quantity is the RFQ's: a supplier prices what was asked for. Sending it
      // is optional, but if sent it must match.
      let quantity: number;
      if (rfqLine) {
        quantity = Number(rfqLine.quantity);
        if (!isBlank(item.quantity) && toNumber(item.quantity) !== quantity) {
          return res.status(400).json({
            success: false,
            message: `"${description}" must be quoted for the requested quantity of ${quantity}`
          });
        }
      } else {
        quantity = toNumber(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return res.status(400).json({ success: false, message: `"${description}" needs a quantity greater than 0` });
        }
      }

      const unitPrice = toNumber(item.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({ success: false, message: `"${description}" needs a unit price greater than 0` });
      }

      // A supplier may offer an equivalent part — validate any data plate they attach.
      const attachments = sanitiseAttachments(item.attachments, req.user!._id);
      if (!attachments.ok) {
        return res.status(400).json({ success: false, message: attachments.message });
      }

      boundItems.push({
        rfqLineId: rfqLine?._id,
        description,
        specifications: rfqLine ? rfqLine.specifications : optionalText(item.specifications),
        quantity,
        unit: rfqLine ? rfqLine.unit : optionalText(item.unit),
        unitPrice,
        totalPrice: quantity * unitPrice,
        vatIncluded: item.vatIncluded === true,
        brand: optionalText(item.brand),
        notes: optionalText(item.notes),
        isAlternative: Boolean(item.isAlternative),
        alternativeDescription: optionalText(item.alternativeDescription),
        alternativePartNumber: optionalText(item.alternativePartNumber),
        attachments: attachments.value
      });
    }

    // VAT at 15% on VAT-exclusive lines only. A VAT-inclusive price already
    // carries its VAT; taxing the whole subtotal charged those lines twice.
    const subtotal = boundItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    const vatableSubtotal = boundItems.reduce(
      (sum: number, item: any) => (item.vatIncluded ? sum : sum + item.totalPrice),
      0
    );
    const vatAmount = vatableSubtotal * 0.15;
    const totalAmount = subtotal + vatAmount;

    // The number comes from the model's counter hook (SBU-prefixed, atomic), as
    // for purchase orders: a count-based number raced into duplicate keys.
    const quotation = await Quotation.create({
      rfq: rfqId,
      site: rfq.site,
      supplier: profile._id,
      submittedBy: req.user!._id,
      items: boundItems,
      subtotal,
      vatAmount,
      totalAmount,
      validityPeriod: validityDays,
      deliveryPeriod: deliveryDays,
      paymentTerms,
      currency: currency || currentBaseCurrency(),
      notes,
      status: 'submitted',
      isLocked: true,
      lockedAt: new Date(),
      submittedAt: new Date(),
      validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
      revisionOf: isRevision ? existingQuotation!._id : undefined,
      revisionRound: isRevision ? (existingQuotation!.revisionRound || 0) + 1 : 0
    });

    // Archive the superseded quotation and link it forward.
    if (isRevision && existingQuotation) {
      existingQuotation.status = 'superseded';
      existingQuotation.supersededBy = quotation._id;
      await existingQuotation.save();
    }

    // Update RFQ invitation status
    await RFQ.updateOne(
      { _id: rfqId, 'invitedSuppliers.supplier': profile._id },
      { 
        $set: { 
          'invitedSuppliers.$.responded': true,
          'invitedSuppliers.$.respondedAt': new Date(),
          'invitedSuppliers.$.quotation': quotation._id
        }
      }
    );

    await createAuditLog({
      action: 'submit',
      entity: 'Quotation',
      entityId: quotation._id,
      user: req.user,
      description: `Submitted quotation ${quotation.quotationNumber} for RFQ ${rfq.rfqNumber}`,
      newData: { totalAmount, deliveryPeriod: deliveryDays },
      req
    });

    // Notify procurement officers
    await notifyUsersByRole('procurement_officer', {
      type: 'quotation_submitted',
      title: 'New Quotation Received',
      message: `${profile.companyName || 'A supplier'} has submitted a quotation ${quotation.quotationNumber} for RFQ ${rfq.rfqNumber}.`,
      entity: 'Quotation',
      entityId: quotation._id,
      relatedUser: req.user!._id,
      metadata: { rfqNumber: rfq.rfqNumber, supplierName: profile.companyName }
    });

    res.status(201).json({
      success: true,
      message: 'Quotation submitted successfully',
      data: quotation
    });
  } catch (error: any) {
    console.error('Submit quotation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default submitQuotation;
