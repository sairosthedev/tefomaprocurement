import type { Request, Response } from 'express';
import { PurchaseRequisition, PurchaseOrder, Quotation, Delivery, StoreRequisition } from '../../models/index.js';
import { buildDepartmentFilter } from '../../lib/departmentScope.js';
import { escapeRegex } from '../../lib/regex.js';

// This feeds the requisitions table, so it returns only what a row shows or
// acts on. Everything else comes from GET /requisitions/:id.
const ROW_FIELDS = 'requisitionNumber title priority status createdAt requestedBy rfq items._id budgetCheck';
const PO_FIELDS = 'poNumber status financeApproved cooApproved supplier purchaseRequisition rfq quotation';

const idOf = (value: any): string | null => value?._id?.toString() || value?.toString() || null;

const getRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search, page = 1, limit = 20, view = 'all' } = req.query as any;

    const query: any = { isDeleted: false };

    // End users only see their own requisitions; HOD/admin see the department's
    if (req.user!.role === 'end_user') {
      query.requestedBy = req.user!._id;
    } else {
      Object.assign(query, await buildDepartmentFilter(req.user));
      if (view === 'mine') {
        query.requestedBy = req.user!._id;
      } else if (view === 'team') {
        query.requestedBy = { $ne: req.user!._id };
      }
    }

    if (status) query.status = status;

    if (search && String(search).trim()) {
      const pattern = escapeRegex(String(search).trim());
      query.$or = [
        { requisitionNumber: { $regex: pattern, $options: 'i' } },
        { title: { $regex: pattern, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);

    const [requisitions, total] = await Promise.all([
      PurchaseRequisition.find(query)
        .select(ROW_FIELDS)
        .populate('rfq', 'rfqNumber')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      PurchaseRequisition.countDocuments(query)
    ]);

    // A requisition's PO may be linked directly, through its RFQ, or through
    // a quotation on that RFQ, so all three are looked up.
    const requisitionIds = requisitions.map((r: any) => r._id);
    const rfqIds = requisitions.filter((r: any) => r.rfq).map((r: any) => r.rfq._id);

    const quotations = rfqIds.length > 0
      ? await Quotation.find({ rfq: { $in: rfqIds }, isDeleted: false }).select('_id rfq').lean()
      : [];
    const rfqToQuotationIds: Record<string, string[]> = {};
    quotations.forEach((q: any) => {
      const rfqId = q.rfq.toString();
      (rfqToQuotationIds[rfqId] ||= []).push(q._id.toString());
    });

    const poLinks: any[] = [{ purchaseRequisition: { $in: requisitionIds } }];
    if (rfqIds.length > 0) poLinks.push({ rfq: { $in: rfqIds } });
    if (quotations.length > 0) poLinks.push({ quotation: { $in: quotations.map((q: any) => q._id) } });

    const allPOs: any[] = await PurchaseOrder.find({ $or: poLinks, isDeleted: false })
      .select(PO_FIELDS)
      .populate('supplier', 'companyName')
      .populate('rfq', 'purchaseRequisition')
      .lean();

    const findPO = (reqId: string, rfqId: string | null) =>
      // Direct link via purchaseRequisition on the PO
      allPOs.find((p) => idOf(p.purchaseRequisition) === reqId) ||
      // Via the PO's RFQ pointing back at this requisition
      allPOs.find((p) => p.rfq?.purchaseRequisition && idOf(p.rfq.purchaseRequisition) === reqId) ||
      (rfqId
        ? // Via this requisition's RFQ, then via a quotation on it
          allPOs.find((p) => idOf(p.rfq) === rfqId) ||
          allPOs.find((p) => p.quotation && (rfqToQuotationIds[rfqId] || []).includes(idOf(p.quotation)!))
        : undefined);

    const poByRequisition = new Map<string, any>();
    requisitions.forEach((r: any) => {
      const po = findPO(r._id.toString(), r.rfq ? r.rfq._id.toString() : null);
      if (po) poByRequisition.set(r._id.toString(), po);
    });

    // Delivery and collection state only matter for rows that have a PO.
    let poWithDeliveries = new Set<string>();
    let collectedPurposes: string[] = [];
    if (poByRequisition.size > 0) {
      const [deliveries, storeRequisitions] = await Promise.all([
        Delivery.find({
          purchaseOrder: { $in: Array.from(poByRequisition.values()).map((po) => po._id) },
          status: { $in: ['received', 'accepted', 'partially_accepted'] },
          isDeleted: false
        })
          .select('purchaseOrder')
          .lean(),
        // A store requisition raised for these items names the purchase
        // requisition in its purpose, which is how collection is detected.
        StoreRequisition.find({
          ...(await buildDepartmentFilter(req.user)),
          isDeleted: false,
          status: { $in: ['issued', 'partially_issued'] }
        })
          .select('purpose')
          .lean()
      ]);
      poWithDeliveries = new Set(deliveries.map((d: any) => d.purchaseOrder.toString()));
      collectedPurposes = storeRequisitions.map((sr: any) => sr.purpose).filter(Boolean);
    }

    const rows = requisitions.map((r: any) => {
      const row: any = {
        _id: r._id,
        requisitionNumber: r.requisitionNumber,
        title: r.title,
        priority: r.priority,
        status: r.status,
        createdAt: r.createdAt,
        requestedBy: r.requestedBy,
        itemCount: r.items?.length || 0,
        rfq: r.rfq ? { _id: r.rfq._id, rfqNumber: r.rfq.rfqNumber } : null
      };

      // The approver is shown the overrun before approving.
      if (r.budgetCheck?.exceedsBudget) {
        const { fiscalYear, requestAmount, availableBefore, availableAfter, exceedsBudget } = r.budgetCheck;
        row.budgetCheck = { fiscalYear, requestAmount, availableBefore, availableAfter, exceedsBudget };
      }

      const po = poByRequisition.get(r._id.toString());
      if (po) {
        row.purchaseOrder = {
          _id: po._id,
          poNumber: po.poNumber,
          status: po.status,
          financeApproved: po.financeApproved,
          cooApproved: po.cooApproved,
          supplier: po.supplier ? { companyName: po.supplier.companyName } : null
        };
        row.itemsDeliveredToStores = poWithDeliveries.has(po._id.toString());
        const reqNumber = r.requisitionNumber || `PR-${r._id.toString().slice(-6)}`;
        row.itemsCollected = collectedPurposes.some((purpose) => purpose.includes(reqNumber));

        // A PO means the requisition is ordered, even if its status lags
        if (row.status !== 'ordered' && row.status !== 'completed') {
          row.status = 'ordered';
        }
      }

      return row;
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getRequisitions;
