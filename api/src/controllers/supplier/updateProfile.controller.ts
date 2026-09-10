import type { Request, Response } from 'express';
import { isValidCategoryCode } from '@fossil/shared';
import { SupplierProfile, SupplierBankChangeRequest } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';
import {
  diffBankDetails,
  requiresApproval,
  hasOpenBankChange
} from '../../services/bankChange.service.js';

/**
 * Supplier self-service profile update.
 *
 * Banking details are deliberately NOT editable in place here. A change is
 * raised as a request that pauses payments and requires an out-of-band
 * callback plus a second approver — the payment-redirection control. Every
 * other field is applied directly, with a field-level audit diff.
 */
const updateProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { tradingName, address, contactPersons, bankDetails, categories } = req.body;

    const profile = await SupplierProfile.findOne({ user: req.user!._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Supplier profile not found'
      });
    }

    // A blacklisted or suspended supplier should not be editing their record.
    if (profile.status === 'blacklisted' || profile.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${profile.status} and cannot be edited. Contact procurement.`
      });
    }

    // Validate category codes — this check existed in every other write path
    // but not here, letting a supplier self-assign categories they were never
    // vetted for and so appear in RFQ matching for them.
    if (categories !== undefined) {
      if (!Array.isArray(categories)) {
        return res.status(400).json({ success: false, message: 'categories must be an array' });
      }
      const invalid = categories.filter((c: string) => !isValidCategoryCode(c));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid supplier category code(s): ${invalid.join(', ')}`
        });
      }
    }

    if (contactPersons !== undefined && !Array.isArray(contactPersons)) {
      return res.status(400).json({ success: false, message: 'contactPersons must be an array' });
    }

    const previousData = { ...profile.toObject() };
    const changes: { field: string; from?: string; to?: string }[] = [];

    if (tradingName !== undefined && tradingName !== profile.tradingName) {
      changes.push({ field: 'Trading name', from: profile.tradingName, to: tradingName });
      profile.tradingName = tradingName;
    }
    if (address) {
      // Merge rather than replace: a wholesale assignment dropped `street`
      // whenever the client sent the legacy `physical` alias.
      profile.address = {
        ...(profile.address || {}),
        ...address,
        street: address.street ?? address.physical ?? profile.address?.street
      } as any;
      changes.push({ field: 'Address', from: 'previous', to: 'updated' });
    }
    if (contactPersons !== undefined) {
      profile.contactPersons = contactPersons;
      changes.push({ field: 'Contact persons', from: 'previous', to: 'updated' });
    }
    if (categories !== undefined) {
      changes.push({
        field: 'Categories',
        from: (profile.categories || []).join(', '),
        to: categories.join(', ')
      });
      profile.categories = categories;
    }

    // --- Banking: a request, never a direct write ---
    let bankChangeRequest = null;
    if (bankDetails && typeof bankDetails === 'object') {
      if (requiresApproval(profile.bankDetails, bankDetails)) {
        if (await hasOpenBankChange(profile._id)) {
          return res.status(409).json({
            success: false,
            message:
              'A banking change is already awaiting verification and approval. Contact procurement to amend or withdraw it.'
          });
        }

        const bankFieldChanges = diffBankDetails(profile.bankDetails, bankDetails);

        bankChangeRequest = await SupplierBankChangeRequest.create({
          supplier: profile._id,
          requestedBy: req.user!._id,
          requestedVia: 'supplier_portal',
          previousDetails: profile.bankDetails || {},
          requestedDetails: bankDetails,
          changes: bankFieldChanges,
          status: 'pending_verification'
        });

        await createAuditLog({
          action: 'create',
          entity: 'SupplierBankChangeRequest',
          entityId: bankChangeRequest._id,
          user: req.user,
          description: `Supplier ${profile.companyName} requested a banking change: ${bankFieldChanges
            .map((c) => c.field)
            .join(', ')}`,
          previousData: profile.bankDetails,
          newData: bankDetails,
          req
        });

        await notifyUsersByRole(['procurement_officer', 'finance', 'admin'], {
          type: 'supplier_bank_change_requested',
          title: 'Supplier banking change requested',
          message: `${profile.companyName} requested a change to ${bankFieldChanges
            .map((c) => c.field.toLowerCase())
            .join(', ')}. Payments are on hold until this is verified by callback and approved.`,
          entity: 'SupplierBankChangeRequest',
          entityId: bankChangeRequest._id,
          relatedUser: req.user!._id,
          metadata: { companyName: profile.companyName, changedFields: bankFieldChanges.map((c) => c.field) }
        });
      }
    }

    await profile.save();

    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: profile._id,
      user: req.user,
      description:
        changes.length > 0
          ? `Supplier updated their profile: ${changes.map((c) => c.field).join(', ')}`
          : 'Supplier submitted a profile update with no changes',
      previousData,
      newData: req.body,
      req
    });

    res.status(200).json({
      success: true,
      data: profile,
      message: bankChangeRequest
        ? 'Profile updated. Your banking change needs verification and approval before it takes effect.'
        : undefined,
      bankChangePending: Boolean(bankChangeRequest)
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default updateProfile;
