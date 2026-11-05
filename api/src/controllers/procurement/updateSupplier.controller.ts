import type { Request, Response } from 'express';
import { isValidCategoryCode } from '@fossil/shared';
import { User, SupplierProfile, SupplierBankChangeRequest } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifyUsersByRole } from '../../services/notification.service.js';
import { sendEmailNotification } from '../../services/email.service.js';
import { brandSubject, getProductName } from '../../lib/branding.js';
import { emailPaths } from '../../lib/emailLinks.js';
import {
  applySupplierClassification,
  readSupplierClassification
} from '../../services/supplierClassification.service.js';
import {
  contactNumbersOnFile,
  diffBankDetails,
  hasOpenBankChange,
  phoneNumbersDiffer,
  requiresApproval
} from '../../services/bankChange.service.js';

// The values SupplierProfile accepts for the vetting record (Rev 9 clauses 5.5 and 6.2.1).
const VETTING_STATUSES = ['not_started', 'in_progress', 'passed', 'failed'];
const ONBOARDING_METHODS = ['newspaper', 'direct_application', 'referral', 'existing', 'other'];

/**
 * Tell both addresses that a supplier's sign-in email was changed by staff.
 * The old address is the one that matters: if the change was not genuine, it
 * is the only place the real supplier will hear about it.
 */
async function notifySignInEmailChanged(companyName: string, oldEmail: string, newEmail: string, changedBy: any) {
  const product = getProductName();
  const by = [changedBy?.firstName, changedBy?.lastName].filter(Boolean).join(' ') || 'procurement';
  await Promise.allSettled([
    sendEmailNotification({
      emailTo: oldEmail,
      subject: brandSubject('Your sign-in email was changed'),
      headingText: 'Sign-in email changed',
      subText: `The email address used to sign in to ${product} for ${companyName} was changed from ${oldEmail} to ${newEmail} by ${by}. This address will no longer receive sign-in codes or notifications.`,
      subSubText: 'If you did not ask for this change, contact procurement immediately.'
    }),
    sendEmailNotification({
      emailTo: newEmail,
      subject: brandSubject('Your sign-in email was changed'),
      headingText: 'Sign-in email changed',
      subText: `This address is now used to sign in to ${product} for ${companyName}, replacing ${oldEmail}. The change was made by ${by}.`,
      subSubText: 'If you did not expect this, contact procurement.',
      actionButtonText: 'Sign in',
      actionButtonLink: emailPaths.supplierLogin()
    })
  ]);
}

const updateSupplier = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const {
      companyName,
      tradingName,
      tradingAs,
      registrationNumber,
      taxNumber,
      vatNumber,
      address,
      bankDetails,
      categories,
      contactPersons,
      clientReferrals,
      notes,
      website,
      incorporationDate,
      proposedBusiness,
      tradeVolume,
      tradeProducts,
      user: userUpdates,
      vettingStatus,
      siteVisitDate,
      siteVisitBy,
      siteVisitNotes,
      onboardingMethod,
      onboardingMethodNotes
    } = req.body;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // `supplierCode` is deliberately not read from the body: it is assigned
    // once and is permanent.
    const classification = readSupplierClassification(req.body);
    if (classification.error) {
      return res.status(400).json({ success: false, message: classification.error });
    }

    // Without the document bodies: they are megabytes of base64 each, and the
    // audit entry is about the profile fields.
    const { complianceDocuments: _documents, ...previousData } = supplier.toObject();

    // The supplier's login, read up front: a clashing email or a held phone
    // change is refused before anything is saved, and its phone is one of the
    // numbers a banking-change callback may be made to.
    const supplierUser = supplier.user ? await User.findById(supplier.user) : null;
    const userEdit = userUpdates && typeof userUpdates === 'object' && supplierUser ? userUpdates : null;
    const numbersBefore = contactNumbersOnFile(supplier.contactPersons, supplierUser?.phone);

    let normalizedEmail: string | undefined;
    if (userEdit?.email) {
      normalizedEmail = String(userEdit.email).toLowerCase().trim();
      const existing = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: supplierUser!._id },
        isDeleted: { $ne: true }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `A user with email ${userEdit.email} already exists`
        });
      }
    }

    if (companyName !== undefined) supplier.companyName = String(companyName).trim();
    if (tradingName !== undefined) supplier.tradingName = String(tradingName).trim();
    if (tradingAs !== undefined && tradingName === undefined) {
      supplier.tradingName = String(tradingAs).trim();
    }
    if (registrationNumber !== undefined) supplier.registrationNumber = String(registrationNumber).trim();
    if (taxNumber !== undefined) supplier.taxNumber = taxNumber ? String(taxNumber).trim() : undefined;
    if (vatNumber !== undefined) supplier.vatNumber = vatNumber ? String(vatNumber).trim() : undefined;
    if (notes !== undefined) supplier.notes = notes ? String(notes).trim() : undefined;
    if (website !== undefined) supplier.website = website ? String(website).trim() : undefined;
    if (proposedBusiness !== undefined) {
      supplier.proposedBusiness = proposedBusiness ? String(proposedBusiness).trim() : undefined;
    }
    if (tradeVolume !== undefined) {
      supplier.tradeVolume = tradeVolume ? String(tradeVolume).trim() : undefined;
    }
    if (incorporationDate !== undefined) {
      supplier.incorporationDate = incorporationDate ? new Date(incorporationDate) : undefined;
    }
    applySupplierClassification(supplier, classification);

    if (address && typeof address === 'object') {
      supplier.address = {
        ...supplier.address,
        street: address.street ?? address.physical ?? supplier.address?.street,
        city: address.city ?? supplier.address?.city,
        province: address.province ?? supplier.address?.province,
        postalCode: address.postalCode ?? supplier.address?.postalCode,
        country: address.country ?? supplier.address?.country ?? 'Zimbabwe'
      };
    }

    // Banking is never written here. A staff edit was the one path that still
    // overwrote an account in place, skipping the callback and the second
    // approver — so an insider could redirect payments alone. It now raises the
    // same held request as a supplier-portal change.
    const wantsBankChange =
      bankDetails && typeof bankDetails === 'object' && requiresApproval(supplier.bankDetails, bankDetails);
    if (wantsBankChange && (await hasOpenBankChange(supplier._id))) {
      return res.status(409).json({
        success: false,
        message:
          'A banking change for this supplier is already awaiting verification and approval. Resolve it under Bank changes first.'
      });
    }

    if (categories !== undefined) {
      const categoryList: string[] = Array.isArray(categories) ? categories : [];
      const invalidCategories = categoryList.filter((c) => !isValidCategoryCode(c));
      if (invalidCategories.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid supplier category code(s): ${invalidCategories.join(', ')}`
        });
      }
      supplier.categories = categoryList;
    }

    if (tradeProducts !== undefined) {
      supplier.tradeProducts = Array.isArray(tradeProducts)
        ? tradeProducts.map((item) => String(item).trim()).filter(Boolean)
        : [];
    }

    if (contactPersons !== undefined) {
      if (!Array.isArray(contactPersons)) {
        return res.status(400).json({ success: false, message: 'contactPersons must be an array' });
      }
      // Validate before assigning: empty required fields previously reached
      // the sub-schema and surfaced as a 500 rather than a clear 400.
      const mapped = contactPersons.map((person: any) => ({
        name: String(person.name || '').trim(),
        position: person.position ? String(person.position).trim() : undefined,
        email: String(person.email || '').trim(),
        phone: String(person.phone || '').trim(),
        isPrimary: Boolean(person.isPrimary)
      }));
      const incomplete = mapped.findIndex((p) => !p.name || !p.email || !p.phone);
      if (incomplete !== -1) {
        return res.status(400).json({
          success: false,
          message: `Contact person ${incomplete + 1} needs a name, email and phone`
        });
      }
      supplier.contactPersons = mapped;
    }

    // While a banking change awaits its callback, the numbers that callback
    // will be made to stay as they are.
    const numbersAfter = contactNumbersOnFile(
      supplier.contactPersons,
      userEdit && userEdit.phone !== undefined ? userEdit.phone : supplierUser?.phone
    );
    if (phoneNumbersDiffer(numbersBefore, numbersAfter) && (await hasOpenBankChange(supplier._id))) {
      return res.status(409).json({
        success: false,
        message:
          'Contact phone numbers cannot be changed while a banking change for this supplier is awaiting verification and approval. Resolve it under Bank changes first.'
      });
    }

    if (clientReferrals !== undefined) {
      if (!Array.isArray(clientReferrals)) {
        return res.status(400).json({ success: false, message: 'clientReferrals must be an array' });
      }
      supplier.clientReferrals = clientReferrals.map((ref: any) => ({
        clientName: String(ref.clientName || ref.name || '').trim(),
        contactPerson: ref.contactPerson ? String(ref.contactPerson).trim() : undefined,
        contactEmail: ref.contactEmail || ref.email ? String(ref.contactEmail || ref.email).trim() : undefined,
        contactPhone: ref.contactPhone || ref.phone ? String(ref.contactPhone || ref.phone).trim() : undefined,
        projectDescription: ref.projectDescription ? String(ref.projectDescription).trim() : undefined
      }));

      if (supplier.clientReferrals.length >= 3) {
        supplier.kysChecklist = {
          ...supplier.kysChecklist,
          clientReferrals: true
        };
      }
    }

    // Checked here so a bad value is a 400, not a validation error on save.
    if (vettingStatus && !VETTING_STATUSES.includes(vettingStatus)) {
      return res.status(400).json({ success: false, message: `Vetting status must be one of: ${VETTING_STATUSES.join(', ')}` });
    }
    if (onboardingMethod && !ONBOARDING_METHODS.includes(onboardingMethod)) {
      return res.status(400).json({ success: false, message: `Onboarding method must be one of: ${ONBOARDING_METHODS.join(', ')}` });
    }
    if (vettingStatus !== undefined) supplier.vettingStatus = vettingStatus || 'not_started';
    if (siteVisitDate !== undefined) supplier.siteVisitDate = siteVisitDate ? new Date(siteVisitDate) : undefined;
    if (siteVisitBy !== undefined) supplier.siteVisitBy = siteVisitBy ? String(siteVisitBy).trim() : undefined;
    if (siteVisitNotes !== undefined) supplier.siteVisitNotes = siteVisitNotes ? String(siteVisitNotes).trim() : undefined;
    if (onboardingMethod !== undefined) supplier.onboardingMethod = onboardingMethod || undefined;
    if (onboardingMethodNotes !== undefined) supplier.onboardingMethodNotes = onboardingMethodNotes ? String(onboardingMethodNotes).trim() : undefined;

    await supplier.save();

    let bankChangeRequest = null;
    if (wantsBankChange) {
      const bankFieldChanges = diffBankDetails(supplier.bankDetails, bankDetails);
      bankChangeRequest = await SupplierBankChangeRequest.create({
        supplier: supplier._id,
        requestedBy: req.user!._id,
        requestedVia: 'procurement',
        previousDetails: supplier.bankDetails || {},
        requestedDetails: bankDetails,
        changes: bankFieldChanges,
        // Before this save: a number added in it does not count for the callback.
        contactNumbersOnFile: numbersBefore,
        status: 'pending_verification'
      });

      await createAuditLog({
        action: 'create',
        entity: 'SupplierBankChangeRequest',
        entityId: bankChangeRequest._id,
        user: req.user,
        description: `Banking change raised by staff for ${supplier.companyName}: ${bankFieldChanges
          .map((c) => c.field)
          .join(', ')}`,
        previousData: supplier.bankDetails,
        newData: bankDetails,
        req
      });

      await notifyUsersByRole(['procurement_officer', 'finance', 'admin'], {
        type: 'supplier_bank_change_requested',
        title: 'Supplier banking change requested',
        message: `A banking change was raised for ${supplier.companyName}. Payments are on hold until it is verified by callback and approved by someone else.`,
        entity: 'SupplierBankChangeRequest',
        entityId: bankChangeRequest._id,
        relatedUser: req.user!._id,
        metadata: { companyName: supplier.companyName, changedFields: bankFieldChanges.map((c) => c.field) }
      });
    }

    if (userEdit && supplierUser) {
      const previousEmail = supplierUser.email;
      if (normalizedEmail) supplierUser.email = normalizedEmail;
      if (userEdit.phone !== undefined) supplierUser.phone = userEdit.phone;
      if (userEdit.firstName !== undefined) supplierUser.firstName = String(userEdit.firstName).trim();
      if (userEdit.lastName !== undefined) supplierUser.lastName = String(userEdit.lastName).trim();
      await supplierUser.save();

      // The sign-in email decides where OTP codes go, so a staff change to it
      // is told to both addresses and recorded on its own, naming both.
      if (normalizedEmail && normalizedEmail !== previousEmail) {
        await createAuditLog({
          action: 'update',
          entity: 'User',
          entityId: supplierUser._id,
          entityLabel: supplier.companyName,
          user: req.user,
          description: `Changed the sign-in email for supplier ${supplier.companyName} from ${previousEmail} to ${normalizedEmail}`,
          previousData: { email: previousEmail },
          newData: { email: normalizedEmail },
          req
        });
        await notifySignInEmailChanged(supplier.companyName, previousEmail, normalizedEmail, req.user);
      }
    }

    const updated = await SupplierProfile.findById(id)
      .select('-complianceDocuments.filePath')
      .populate('user', 'email firstName lastName phone status')
      .populate('approvedBy', 'firstName lastName')
      .populate('blacklistedBy', 'firstName lastName')
      .populate('activationRequest.requestedBy', 'firstName lastName')
      .populate('rejectedBy', 'firstName lastName');

    const { bankDetails: _bank, ...profileChanges } = req.body;
    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Updated supplier profile: ${supplier.companyName}`,
      previousData,
      // The banking part of the body is recorded on the change request instead.
      newData: profileChanges,
      req
    });

    res.status(200).json({
      success: true,
      message: bankChangeRequest
        ? 'Banking change submitted. It applies once verified by callback and approved by a second person; payments are on hold until then.'
        : 'Supplier profile updated',
      data: updated,
      bankChangeRequest
    });
  } catch (error: any) {
    console.error('Update supplier error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default updateSupplier;
