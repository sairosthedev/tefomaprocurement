import type { Request, Response } from 'express';

import { isValidCategoryCode } from '@fossil/shared';
import { User, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { createNotification } from '../../services/notification.service.js';
import { sendEmailNotification } from '../../services/email.service.js';

const createSupplier = async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      companyName,
      tradingAs,
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

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if email already exists (excluding deleted users)
    const existingUser = await User.findOne({ 
      email: normalizedEmail,
      isDeleted: { $ne: true }
    });
    
    if (existingUser) {
      console.log('Existing user found:', {
        email: existingUser.email,
        id: existingUser._id,
        role: existingUser.role,
        isDeleted: existingUser.isDeleted
      });
      return res.status(400).json({
        success: false,
        message: `A user with email ${email} already exists`
      });
    }

    // Also check if a supplier profile already exists with this email
    const existingSupplier = await SupplierProfile.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true }
    }).populate('user');
    
    if (existingSupplier) {
      console.log('Existing supplier found:', {
        email: (existingSupplier as any).email,
        id: existingSupplier._id,
        userId: existingSupplier.user?._id,
        userDeleted: existingSupplier.user?.isDeleted
      });
      
      // Only block if the associated user exists and is not deleted
      if (existingSupplier.user && !existingSupplier.user.isDeleted) {
        return res.status(400).json({
          success: false,
          message: `A supplier with email ${email} already exists`
        });
      }
    }

    // Use provided password or default to "password"
    const userPassword = password || 'password';

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

    // Create supplier profile
    const supplierProfile = await SupplierProfile.create({
      user: user._id,
      companyName,
      tradingAs,
      registrationNumber,
      taxNumber,
      vatNumber,
      contactPerson: `${firstName} ${lastName}`,
      email: normalizedEmail,
      phone,
      address: {
        physical: physicalAddress,
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
      // FC-HQ-P-07 §6.2.3 — supplier stays pending until KYS documents are
      // collected and verified; only then can they be activated/invited.
      status: 'pending'
    });

    await createAuditLog({
      action: 'create',
      entity: 'SupplierProfile',
      entityId: supplierProfile._id,
      user: req.user,
      description: `Created new supplier: ${companyName}`,
      newData: { companyName, email, categories },
      req
    });

    // Create notification for the supplier
    await createNotification({
      recipient: user._id,
      type: 'supplier_added',
      title: 'Welcome to fossilProcure',
      message: `Your supplier account for ${companyName} has been created. Please log in and upload your KYS compliance documents so your account can be verified and activated.`,
      entity: 'SupplierProfile',
      entityId: supplierProfile._id,
      relatedUser: req.user!._id,
      metadata: { 
        companyName,
        email: normalizedEmail,
        password: userPassword 
      }
    });

    // Send welcome email to supplier - will be sent via notification service automatically
    // The notification service handles the email sending with the proper template

    res.status(201).json({
      success: true,
      message: 'Supplier created. Pending KYS verification before activation.',
      data: {
        id: supplierProfile._id,
        companyName: supplierProfile.companyName,
        email: (supplierProfile as any).email,
        status: supplierProfile.status,
        password: userPassword // Return the password used
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
