import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';
import { maskBankNumbers } from '../../lib/bankMasking.js';
import { escapeRegex } from '../../lib/regex.js';
import { WITHOUT_DOCUMENT_FILES } from '../../services/supplierDocuments.service.js';
import { awaitingActivationFilter } from '../../services/supplierActivation.service.js';

/**
 * A query parameter as a plain string. `?status[$ne]=x` arrives as an object
 * and would otherwise be passed into the Mongo filter as an operator.
 */
const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getSuppliers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { categories, page = 1, limit = 20 } = req.query as Record<string, any>;
    const status = asString(req.query.status);
    const search = asString(req.query.search);
    const category = asString(req.query.category);
    const kys = asString(req.query.kys);
    // `approval=awaiting`: pending suppliers submitted for activation.
    // `approval=awaiting_me`: those the caller may decide — submitted by
    // someone else. The dashboard item and sidebar badge count the latter.
    const approval = asString(req.query.approval);
    // `view=picker`: only what a supplier picker shows (the RFQ form asks for
    // hundreds at once, and the full profile is over a kilobyte each).
    const picker = asString(req.query.view) === 'picker';

    const query: any = { isDeleted: false };

    if (status) query.status = status;
    if (approval === 'awaiting' || approval === 'awaiting_me') {
      Object.assign(query, awaitingActivationFilter(approval === 'awaiting_me' ? req.user!._id : undefined));
    }
    if (kys === 'pending') {
      query.kysComplete = false;
      query.kysExempt = { $ne: true };
    } else if (kys === 'verified') {
      query.kysComplete = true;
    }
    // `category` matches a single code; `categories` matches any of several codes
    // (comma-separated string or array) — used to find suppliers for an RFQ's items.
    if (categories) {
      const codes = (Array.isArray(categories) ? categories : String(categories).split(','))
        .filter((c: unknown) => typeof c === 'string')
        .map((c: string) => c.trim())
        .filter(Boolean);
      if (codes.length > 0) query.categories = { $in: codes };
    } else if (category) {
      query.categories = category;
    }
    if (search) {
      // Escaped: a search for "Smith (Pvt)" is a literal string, not a pattern,
      // and an unbalanced "(" used to fail the whole request.
      const pattern = escapeRegex(search);
      query.$or = [
        { companyName: { $regex: pattern, $options: 'i' } },
        { tradingName: { $regex: pattern, $options: 'i' } },
        { registrationNumber: { $regex: pattern, $options: 'i' } },
        { supplierCode: { $regex: pattern, $options: 'i' } }
      ];
    }

    // Parse once: these arrive as query strings, and the arithmetic below
    // previously relied on string coercion to work by accident.
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      picker
        ? SupplierProfile.find(query)
            .select('companyName tradingName supplierCode contactEmail categories status user')
            .populate('user', 'email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean()
        : SupplierProfile.find(query)
            .select(WITHOUT_DOCUMENT_FILES)
            .populate('user', 'email firstName lastName phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
      SupplierProfile.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      // A list never needs full account numbers; the detail view does.
      data: maskBankNumbers(suppliers),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getSuppliers;
