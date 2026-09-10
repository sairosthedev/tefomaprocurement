import type { Request, Response } from 'express';

import { PurchaseRequisition } from '../../models/index.js';
import { matchSuppliersByCategories } from '../../services/supplierMatch.service.js';

/**
 * GET suppliers matching a set of category codes, for RFQ invitation.
 *
 * Accepts either `categories` (comma-separated codes) or `requisitionId`, in
 * which case the codes are taken from the requisition's line items.
 *
 * Returns exact matches (safe to auto-select) separately from related ones
 * (same section, different code — suggested but left unchecked).
 */
const matchSuppliers = async (req: Request, res: Response): Promise<any> => {
  try {
    const { categories, requisitionId } = req.query as Record<string, any>;

    let codes: string[] = [];

    if (requisitionId) {
      const requisition = await PurchaseRequisition.findById(requisitionId).select('items');
      if (!requisition) {
        return res.status(404).json({ success: false, message: 'Requisition not found' });
      }
      codes = ((requisition as any).items || [])
        .map((i: any) => i.category)
        .filter(Boolean);
    } else if (categories) {
      codes = Array.isArray(categories)
        ? categories
        : String(categories).split(',').map((c) => c.trim()).filter(Boolean);
    }

    if (codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide either categories or a requisitionId with categorised items'
      });
    }

    const result = await matchSuppliersByCategories(codes);

    res.status(200).json({
      success: true,
      data: {
        exact: result.exact,
        related: result.related,
        requestedCategories: result.requestedCategories,
        relatedCategories: result.relatedCategories,
        exactCount: result.exact.length,
        relatedCount: result.related.length
      }
    });
  } catch (error: any) {
    console.error('Match suppliers error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default matchSuppliers;
