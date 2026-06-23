import type { Request, Response } from 'express';
import { isValidCategoryCode } from '@fossil/shared';
import { User, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

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
      user: userUpdates
    } = req.body;

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const previousData = supplier.toObject();

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

    if (bankDetails && typeof bankDetails === 'object') {
      supplier.bankDetails = {
        ...supplier.bankDetails,
        bankName: bankDetails.bankName ?? supplier.bankDetails?.bankName,
        accountName: bankDetails.accountName ?? supplier.bankDetails?.accountName,
        accountNumber: bankDetails.accountNumber ?? supplier.bankDetails?.accountNumber,
        branchCode: bankDetails.branchCode ?? supplier.bankDetails?.branchCode,
        accountType: bankDetails.accountType ?? supplier.bankDetails?.accountType
      };
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
      supplier.contactPersons = contactPersons.map((person: any) => ({
        name: String(person.name || '').trim(),
        position: person.position ? String(person.position).trim() : undefined,
        email: String(person.email || '').trim(),
        phone: String(person.phone || '').trim(),
        isPrimary: Boolean(person.isPrimary)
      }));
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

    await supplier.save();

    if (userUpdates && typeof userUpdates === 'object' && supplier.user) {
      const user = await User.findById(supplier.user);
      if (user) {
        if (userUpdates.email) {
          const normalizedEmail = String(userUpdates.email).toLowerCase().trim();
          const existing = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id },
            isDeleted: { $ne: true }
          });
          if (existing) {
            return res.status(400).json({
              success: false,
              message: `A user with email ${userUpdates.email} already exists`
            });
          }
          user.email = normalizedEmail;
        }
        if (userUpdates.phone !== undefined) user.phone = userUpdates.phone;
        if (userUpdates.firstName !== undefined) user.firstName = String(userUpdates.firstName).trim();
        if (userUpdates.lastName !== undefined) user.lastName = String(userUpdates.lastName).trim();
        await user.save();
      }
    }

    const updated = await SupplierProfile.findById(id)
      .populate('user', 'email firstName lastName phone status')
      .populate('approvedBy', 'firstName lastName')
      .populate('blacklistedBy', 'firstName lastName');

    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Updated supplier profile: ${supplier.companyName}`,
      previousData,
      newData: req.body,
      req
    });

    res.status(200).json({
      success: true,
      message: 'Supplier profile updated',
      data: updated
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
