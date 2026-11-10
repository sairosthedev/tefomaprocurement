import type { Request, Response } from 'express';
import crypto from 'crypto';

import { isValidCategoryCode, mapLegacyCategory, validateSupplierImportRow } from '@fossil/shared';
import { User, SupplierProfile } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { registrationConflict } from '../../services/supplierEligibility.service.js';
import {
  classificationFields,
  readSupplierClassification
} from '../../services/supplierClassification.service.js';

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

        // The same row checks the import screen runs (see
        // packages/shared/src/validation/suppliers.ts): companyName,
        // registrationNumber, contactPerson, email and phone are required (the
        // schema and ContactPersonSchema need them), and every value must be
        // the right shape. A failed row says what to fix, field by field.
        const rowErrors = validateSupplierImportRow(supplier);
        if (Object.keys(rowErrors).length > 0) {
          results.failed.push({
            companyName: companyName || 'Unknown',
            email: email || 'Unknown',
            reason: Object.values(rowErrors).join('; '),
            errors: rowErrors
          });
          continue;
        }

        // Parse categories if it's a string
        let parsedCategories: string[] = Array.isArray(categories) ? categories : [];
        if (typeof categories === 'string') {
          parsedCategories = categories.split(',').map(c => c.trim()).filter(c => c);
        }

        // Resolve categories BEFORE creating the user — validating afterwards
        // left orphaned logins behind.
        //
        // Spreadsheets in use predate the code taxonomy and hold free text
        // like "VEHICLE REPAIRS AND SPARES", so legacy values are translated
        // rather than rejected; only genuinely unrecognisable ones fail the row.
        const resolvedCategories: string[] = [];
        const translated: string[] = [];
        const unrecognised: string[] = [];

        for (const value of parsedCategories) {
          if (isValidCategoryCode(value)) {
            resolvedCategories.push(value);
            continue;
          }
          const mapped = mapLegacyCategory(value);
          if (mapped.length > 0) {
            resolvedCategories.push(...mapped);
            translated.push(`${value} -> ${mapped.join(', ')}`);
          } else {
            unrecognised.push(value);
          }
        }

        if (unrecognised.length > 0) {
          results.failed.push({
            companyName,
            email,
            reason: `Unrecognised category value(s): ${unrecognised.join(', ')}. Use a canonical code, or omit the column and set categories after import.`
          });
          continue;
        }

        const finalCategories = Array.from(new Set(resolvedCategories));

        // Optional columns. An unknown value fails the row, as an unknown
        // category does, rather than being dropped without a word.
        const classification = readSupplierClassification(supplier);
        if (classification.error) {
          results.failed.push({
            companyName,
            email,
            reason: `${classification.error}, or leave the column empty.`
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

        // One company, one record: refuse a registration number already on
        // the register, blacklisted or not. Rows run in order, so a company
        // listed twice in the same file is caught by its own first row.
        const conflict = await registrationConflict(registrationNumber);
        if (conflict) {
          results.failed.push({ companyName, email, reason: conflict.message });
          continue;
        }

        // Temporary password from a cryptographic source, not Math.random.
        const tempPassword = crypto.randomBytes(12).toString('base64url');

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

        // Create supplier profile. If this throws, the user created just above
        // is removed again so a failed row leaves nothing behind.
        let supplierProfile;
        try {
          supplierProfile = await SupplierProfile.create({
            user: user._id,
            companyName,
            registrationNumber,
            taxNumber,
            vatNumber,
            tradingName: tradingAs,
            ...classificationFields(classification),
            contactPersons: [{
              name: contactPerson,
              email: email.toLowerCase(),
              phone,
              isPrimary: true
            }],
            address: {
              street: physicalAddress,
              city,
              province,
              postalCode
            },
            categories: finalCategories,
            bankDetails: {
              bankName,
              accountName: bankAccountName,
              accountNumber: bankAccountNumber,
              branchCode: bankBranchCode
            },
            // Imported suppliers are NOT pre-approved: KYS still has to be
            // collected and verified before they can be invited or awarded.
            status: 'pending'
          });
        } catch (profileErr: any) {
          await User.deleteOne({ _id: user._id });
          throw profileErr;
        }

        results.success.push({
          id: supplierProfile._id,
          supplierCode: supplierProfile.supplierCode,
          companyName,
          email,
          tempPassword,
          categories: finalCategories,
          // Surfaced so the importer can see what their free text became,
          // rather than discovering it later in RFQ matching.
          ...(translated.length > 0 ? { translatedCategories: translated } : {})
        });
      } catch (err: any) {
        results.failed.push({
          companyName: supplier.companyName || 'Unknown',
          email: supplier.email || 'Unknown',
          reason: err.message
        });
      }
    }

    // 'create' — 'bulk_import' is not in the AuditLog action enum, and the
    // validation failure was swallowed, so imports left no audit record at all.
    await createAuditLog({
      action: 'create',
      entity: 'SupplierProfile',
      user: req.user,
      description: `Bulk import: created ${results.success.length} supplier(s), ${results.failed.length} row(s) failed`,
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
