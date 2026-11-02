import type { Request, Response } from 'express';
import { PurchaseRequisition, RFQ, PurchaseOrder } from '../../models/index.js';

/**
 * Requisitions stores has already dealt with — forwarded to procurement or
 * fulfilled from stock — and where each one has got to since.
 *
 * The review queue only holds `stores_review`, so without this a requisition
 * vanished from stores' view the moment it was forwarded, even though the goods
 * will come back through stores as a delivery. Each row carries the RFQ and
 * POs raised from it, so stores can see what is on its way.
 *
 * `?stage=` narrows the list: `with_procurement` (still being sourced),
 * `ordered` (a PO exists), `closed` (fulfilled, completed or cancelled).
 */
const STAGE_STATUSES: Record<string, string[]> = {
  with_procurement: ['pending_acceptance', 'accepted', 'sourcing', 'quoted'],
  ordered: ['ordered'],
  closed: ['fulfilled', 'completed', 'cancelled', 'rejected']
};

const getReviewedPurchaseRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { page = 1, limit = 20, stage, search } = req.query as Record<string, any>;
    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { storesReviewedAt: { $exists: true, $ne: null }, isDeleted: false };
    if (stage && STAGE_STATUSES[stage]) filter.status = { $in: STAGE_STATUSES[stage] };
    if (search && String(search).trim()) {
      const pattern = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ requisitionNumber: pattern }, { title: pattern }];
    }

    const [total, requisitions] = await Promise.all([
      PurchaseRequisition.countDocuments(filter),
      PurchaseRequisition.find(filter)
        .select('requisitionNumber title status estimatedTotal currency department site requestedBy storesReviewedBy storesReviewedAt storesReviewNotes requiredDate items.description items.quantity items.unit items.quantityFulfilledFromStock')
        .populate('requestedBy', 'firstName lastName')
        .populate('department', 'name code')
        .populate('site', 'code name')
        .populate('storesReviewedBy', 'firstName lastName')
        .sort({ storesReviewedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    const ids = requisitions.map((pr: any) => pr._id);
    const [rfqs, orders] = await Promise.all([
      RFQ.find({ purchaseRequisition: { $in: ids }, isDeleted: { $ne: true } })
        .select('rfqNumber status purchaseRequisition')
        .lean(),
      PurchaseOrder.find({ purchaseRequisition: { $in: ids }, isDeleted: { $ne: true } })
        .select('poNumber status totalAmount currency expectedDeliveryDate supplier purchaseRequisition')
        .populate('supplier', 'companyName')
        .lean()
    ]);

    const byPr = (rows: any[]) => {
      const map = new Map<string, any[]>();
      for (const row of rows) {
        const key = String(row.purchaseRequisition);
        map.set(key, [...(map.get(key) || []), row]);
      }
      return map;
    };
    const rfqsByPr = byPr(rfqs);
    const ordersByPr = byPr(orders);

    const data = requisitions.map((pr: any) => ({
      ...pr,
      rfqs: (rfqsByPr.get(String(pr._id)) || []).map(({ purchaseRequisition, ...rfq }) => rfq),
      purchaseOrders: (ordersByPr.get(String(pr._id)) || []).map(({ purchaseRequisition, ...po }) => po)
    }));

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get stores reviewed PRs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getReviewedPurchaseRequisitions;
