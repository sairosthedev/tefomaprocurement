import type { Request, Response } from 'express';

import { SupplierProfile } from '../../models/index.js';

const getSuppliers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search, category, categories, kys, page = 1, limit = 20 } = req.query as Record<string, any>;
    
    const query: any = { isDeleted: false };
    
    if (status) query.status = status;
    if (kys === 'pending') {
      query.kysComplete = false;
      query.kysExempt = { $ne: true };
    } else if (kys === 'verified') {
      query.kysComplete = true;
    }
    // `category` matches a single code; `categories` matches any of several codes
    // (comma-separated string or array) — used to find suppliers for an RFQ's items.
    if (categories) {
      const codes = Array.isArray(categories)
        ? categories
        : String(categories).split(',').map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) query.categories = { $in: codes };
    } else if (category) {
      query.categories = category;
    }
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { tradingName: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Parse once: these arrive as query strings, and the arithmetic below
    // previously relied on string coercion to work by accident.
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      SupplierProfile.find(query)
        .populate('user', 'email firstName lastName phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      SupplierProfile.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: suppliers,
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
