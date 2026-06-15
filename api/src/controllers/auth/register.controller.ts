import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { isValidCategoryCode } from '@fossil/shared';
import { User, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      department,
      companyDetails,
      supplierProfile
    } = req.body;

    const profileData = companyDetails || supplierProfile;
    const userRole = role || 'supplier';

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required'
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
        message: 'User with this email already exists'
      });
    }

    if (userRole === 'supplier') {
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
    }

    const user = await User.create({
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      role: userRole,
      phone,
      department: userRole === 'end_user' ? department || undefined : undefined,
      status: 'active'
    });

    if (userRole === 'supplier' && profileData) {
      const accountName = profileData.bankDetails?.accountName
        || `${firstName} ${lastName}`.trim();

      await SupplierProfile.create({
        user: user._id,
        companyName: profileData.companyName,
        tradingName: profileData.tradingName,
        registrationNumber: profileData.registrationNumber,
        vatNumber: profileData.vatNumber,
        address: profileData.address,
        contactPersons: [{
          name: `${firstName} ${lastName}`,
          email: normalizedEmail,
          phone: phone || '',
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
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as SignOptions
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
