import type { Request, Response } from 'express';
import crypto from 'crypto';

import { isValidCategoryCode } from '@fossil/shared';
import { User, SupplierProfile, Notification } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { sendNotificationEmail } from '../../services/email.service.js';
import { registrationConflict } from '../../services/supplierEligibility.service.js';
import {
  classificationFields,
  readSupplierClassification
} from '../../services/supplierClassification.service.js';
import { getProductName } from '../../lib/branding.js';

const createSupplier = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      companyName,
      tradingAs,
      tradingName,
      registrationNumber,
      taxNumber,
      vatNumber,
      firstName,
      lastName,
      email,
      password,
      phone,
      physicalAddress,
      city,
      province,
      postalCode,
      categories,
      bankName,
      bankAccountName,
      bankAccountNumber,
      bankBranchCode
    } = req.body;

    // Validate required fields
    if (!companyName || !email || !firstName || !lastName || !registrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, first name, last name, and registration number are required'
      });
    }

    // Validate category codes against the canonical taxonomy
    const categoryList: string[] = Array.isArray(categories) ? categories : [];
    const invalidCategories = categoryList.filter((c) => !isValidCategoryCode(c));
    if (invalidCategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid supplier category code(s): ${invalidCategories.join(', ')}`
      });
    }

    // Optional, but checked before anything is created.
    const classification = readSupplierClassification(req.body);
    if (classification.error) {
      return res.status(400).json({ success: false, message: classification.error });
    }

    // Normalize email
    const normalizedEmail = String(email).toLowerCase().trim();

    // Check if email already exists (excluding deleted users)
    const existingUser = await User.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `A user with email ${email} already exists`
      });
    }

    // The same company must not be registered twice — least of all one that
    // was blacklisted and is coming back under a new login. (This replaces a
    // lookup by `email`, a field the profile does not have, so it never matched.)
    const conflict = await registrationConflict(registrationNumber);
    if (conflict) {
      return res.status(409).json({ success: false, message: conflict.message });
    }

    // Never fall back to a shared, guessable password: when none is given,
    // generate a random one-time credential. It is returned once so the
    // officer can pass it on, and the supplier is told to log in and complete KYS.
    const passwordGenerated = !password;
    const userPassword: string = password || crypto.randomBytes(12).toString('base64url');

    // Validate password length
    if (userPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Create user account for supplier
    const user = await User.create({
      email: normalizedEmail,
      password: userPassword,
      firstName,
      lastName,
      role: 'supplier',
      phone,
      status: 'active'
    });

    // Create the profile with the schema's own field names: `tradingAs`,
    // `contactPerson`, `email`, `phone` and `address.physical` are not on the
    // schema, so strict mode silently dropped them. If this fails, the login
    // created above is removed again rather than left orphaned.
    let supplierProfile;
    try {
      supplierProfile = await SupplierProfile.create({
        user: user._id,
        companyName,
        tradingName: tradingName || tradingAs || undefined,
        registrationNumber,
        taxNumber,
        vatNumber,
        ...classificationFields(classification),
        // A contact person needs a phone number (the sub-schema requires one),
        // and phone is optional on this form, so it is only recorded with one.
        contactPersons: phone
          ? [{ name: `${firstName} ${lastName}`.trim(), email: normalizedEmail, phone, isPrimary: true }]
          : [],
        address: {
          street: physicalAddress,
          city,
          province,
          postalCode
        },
        categories: categoryList,
        bankDetails: {
          bankName,
          accountName: bankAccountName,
          accountNumber: bankAccountNumber,
          branchCode: bankBranchCode
        },
        // Supplier stays pending until KYS documents are
        // collected and verified; only then can they be activated/invited.
        status: 'pending'
      });
    } catch (profileErr) {
      await User.deleteOne({ _id: user._id });
      throw profileErr;
    }

    await createAuditLog({
      action: 'create',
      entity: 'SupplierProfile',
      entityId: supplierProfile._id,
      user: req.user,
      description: `Created new supplier: ${companyName}`,
      newData: { companyName, email: normalizedEmail, categories },
      req
    });

    // Welcome notification. The stored record never holds the password —
    // notifications are readable in the app and kept for months — so the
    // credentials are added only to the copy handed to the email template.
    const metadata = { companyName, email: normalizedEmail };
    const notification = await Notification.create({
      recipient: user._id,
      type: 'supplier_added',
      title: `Welcome to ${getProductName()}`,
      message: `Your supplier account for ${companyName} has been created. Please log in and upload your KYS compliance documents so your account can be verified and activated.`,
      entity: 'SupplierProfile',
      entityId: supplierProfile._id,
      relatedUser: req.user!._id,
      metadata
    }).catch((err: unknown) => {
      console.error('Error creating supplier welcome notification:', err);
      return null;
    });

    const emailCopy = {
      ...(notification ? notification.toObject() : { type: 'supplier_added', entityId: supplierProfile._id }),
      metadata: { ...metadata, password: userPassword }
    };
    // Not awaited, as before: email delivery must not hold up the response.
    sendNotificationEmail(emailCopy, normalizedEmail).catch((err: unknown) => {
      console.error('Failed to send supplier welcome email:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created. Pending KYS verification before activation.',
      data: {
        id: supplierProfile._id,
        companyName: supplierProfile.companyName,
        supplierCode: supplierProfile.supplierCode,
        email: normalizedEmail,
        status: supplierProfile.status,
        // Returned once so the creator can pass it on; it is not stored anywhere readable.
        password: userPassword,
        passwordGenerated
      }
    });
  } catch (error: any) {
    console.error('Create supplier error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default createSupplier;
