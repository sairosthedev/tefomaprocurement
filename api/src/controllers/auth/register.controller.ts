import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { isValidCategoryCode, validateSupplierRegistration } from '@fossil/shared';
import { User, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { registrationConflict } from '../../services/supplierEligibility.service.js';
import {
  classificationFields,
  readSupplierClassification
} from '../../services/supplierClassification.service.js';
import { getJwtSecret, getJwtExpiry } from '../../config/secrets.js';
import { refuseInvalid } from '../../lib/validation.js';

const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      companyDetails,
      supplierProfile
    } = req.body;

    const profileData = companyDetails || supplierProfile;

    // Public self-registration creates SUPPLIER accounts only. The role is fixed
    // here and deliberately not read from the request body — accepting a caller-
    // supplied role would let anyone register themselves as an admin. Staff
    // accounts are created by an administrator via POST /admin/users.
    const userRole = 'supplier';

    // The registration screen's own checks (see packages/shared/src/validation/suppliers.ts).
    if (refuseInvalid(res, validateSupplierRegistration(req.body))) return;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required'
      });
    }

    // The profile's primary contact requires a phone number. Checked here,
    // before anything is created: failing at the profile step used to leave a
    // login behind with no supplier attached.
    const contactPhone = typeof phone === 'string' ? phone.trim() : '';
    if (!contactPhone) {
      return res.status(400).json({
        success: false,
        message: 'A contact phone number is required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail, isDeleted: false });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
        errors: { email: 'This email is already registered. Sign in instead, or use another email' }
      });
    }

    if (!profileData?.companyName || !profileData?.registrationNumber) {
      return res.status(400).json({
        success: false,
        message: 'Company name and registration number are required for supplier registration'
      });
    }

    const categoryList: string[] = Array.isArray(profileData.categories) ? profileData.categories : [];
    const invalidCategories = categoryList.filter((c) => !isValidCategoryCode(c));
    if (invalidCategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid supplier category code(s): ${invalidCategories.join(', ')}`
      });
    }

    // Optional, but an unknown value is refused before the login is made.
    const classification = readSupplierClassification(profileData);
    if (classification.error) {
      return res.status(400).json({ success: false, message: classification.error });
    }

    // A company registers once. A blacklisted one gets a neutral refusal
    // rather than a fresh account under a new login; a rejected one is told
    // to sign in or contact procurement, like any company already on file.
    const conflict = await registrationConflict(profileData.registrationNumber);
    if (conflict) {
      return res.status(409).json({
        success: false,
        message: conflict.message,
        errors: { registrationNumber: conflict.message }
      });
    }

    const user = await User.create({
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      role: userRole,
      phone: contactPhone,
      status: 'active'
    });

    const accountName = profileData.bankDetails?.accountName
      || `${firstName} ${lastName}`.trim();

    // If the profile cannot be created, remove the login just made so the
    // person can register again rather than being told the email is taken.
    try {
      await SupplierProfile.create({
        user: user._id,
        companyName: profileData.companyName,
        tradingName: profileData.tradingName,
        registrationNumber: profileData.registrationNumber,
        vatNumber: profileData.vatNumber,
        ...classificationFields(classification),
        address: profileData.address,
        contactPersons: [{
          name: `${firstName} ${lastName}`,
          email: normalizedEmail,
          phone: contactPhone,
          isPrimary: true
        }],
        bankDetails: profileData.bankDetails
          ? {
              bankName: profileData.bankDetails.bankName,
              accountName,
              accountNumber: profileData.bankDetails.accountNumber,
              branchCode: profileData.bankDetails.branchCode,
              accountType: profileData.bankDetails.accountType
            }
          : undefined,
        categories: Array.isArray(profileData.categories) ? profileData.categories : [],
        status: 'pending'
      });
    } catch (profileErr) {
      await User.deleteOne({ _id: user._id });
      throw profileErr;
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: getJwtExpiry() } as SignOptions
    );

    await createAuditLog({
      action: 'create',
      entity: 'User',
      entityId: user._id,
      user,
      description: `New user registered: ${normalizedEmail}`,
      newData: { email: normalizedEmail, firstName, lastName, role: userRole },
      req
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration'
    });
  }
};

export default register;
