import type { Request, Response } from 'express';

import { isValidCategoryCode } from '@fossil/shared';
import { User, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const bulkImportSuppliers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { suppliers } = req.body;

    if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No suppliers data provided'
      });
    }

    const results: { success: any[]; failed: any[] } = {
      success: [],
      failed: []
    };

    for (const supplier of suppliers) {
      try {
        const {
          companyName,
          tradingAs,
          registrationNumber,
          taxNumber,
          vatNumber,
          contactPerson,
          email,
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
        } = supplier;

        // Validate required fields
        if (!companyName || !email || !contactPerson) {
          results.failed.push({
            companyName: companyName || 'Unknown',
            email: email || 'Unknown',
            reason: 'Missing required fields (companyName, email, contactPerson)'
          });
          continue;
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          results.failed.push({
            companyName,
            email,
            reason: 'Email already exists'
          });
          continue;
        }

        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

        // Create user account
        const user = await User.create({
          email: email.toLowerCase(),
          password: tempPassword,
          firstName: contactPerson.split(' ')[0] || contactPerson,
          lastName: contactPerson.split(' ').slice(1).join(' ') || '',
          role: 'supplier',
          phone,
          status: 'active'
        });

        // Parse categories if it's a string
        let parsedCategories: string[] = Array.isArray(categories) ? categories : [];
        if (typeof categories === 'string') {
          parsedCategories = categories.split(',').map(c => c.trim()).filter(c => c);
        }

        // Reject rows referencing unknown category codes
        const invalidCategories = parsedCategories.filter((c) => !isValidCategoryCode(c));
        if (invalidCategories.length > 0) {
          results.failed.push({
            companyName,
            email,
            reason: `Invalid category code(s): ${invalidCategories.join(', ')}`
          });
          continue;
        }

        // Create supplier profile
        const supplierProfile = await SupplierProfile.create({
          user: user._id,
          companyName,
          tradingAs,
          registrationNumber,
          taxNumber,
          vatNumber,
          contactPerson,
          email: email.toLowerCase(),
          phone,
          address: {
            physical: physicalAddress,
            city,
            province,
            postalCode
          },
          categories: parsedCategories,
          bankDetails: {
            bankName,
            accountName: bankAccountName,
            accountNumber: bankAccountNumber,
            branchCode: bankBranchCode
          },
          status: 'approved',
          approvedBy: req.user!._id,
          approvedAt: new Date()
        });

        results.success.push({
          id: supplierProfile._id,
          companyName,
          email,
          tempPassword
        });
      } catch (err: any) {
        results.failed.push({
          companyName: supplier.companyName || 'Unknown',
          email: supplier.email || 'Unknown',
          reason: err.message
        });
      }
    }

    await createAuditLog({
      action: 'bulk_import',
      entity: 'SupplierProfile',
      user: req.user,
      description: `Bulk imported ${results.success.length} suppliers (${results.failed.length} failed)`,
      newData: { successCount: results.success.length, failedCount: results.failed.length },
      req
    });

    res.status(200).json({
      success: true,
      message: `Imported ${results.success.length} suppliers successfully, ${results.failed.length} failed`,
      data: results
    });
  } catch (error: any) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

export default bulkImportSuppliers;
