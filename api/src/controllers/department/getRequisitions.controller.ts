import type { Request, Response } from 'express';
import { PurchaseRequisition, PurchaseOrder, Quotation, Delivery } from '../../models/index.js';
import { buildDepartmentFilter } from '../../lib/departmentScope.js';
import { escapeRegex } from '../../lib/regex.js';
import { DELIVERED_TO_STORES, collectedRequisitionRefs, requisitionRef } from '../../lib/requisitionLinks.js';

// This feeds the requisitions table, so it returns only what a row shows or
// acts on. Everything else comes from GET /requisitions/:id.
const ROW_FIELDS = 'requisitionNumber title priority status createdAt requestedBy rfq items._id budgetCheck';
const PO_FIELDS = 'poNumber status financeApproved cooApproved supplier purchaseRequisition rfq quotation';

const idOf = (value: any): string | null => value?._id?.toString() || value?.toString() || null;

const getRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search, page = 1, limit = 20, view = 'all' } = req.query as any;

    const query: any = { isDeleted: false };

    // The department scope also bounds the store requisitions checked for
    // collection below, so it is resolved once. End users are scoped to their
    // own requisitions instead, and need it only for that check, so theirs is
    // started alongside the main query rather than after it.
    const departmentScope = buildDepartmentFilter(req.user);
    departmentScope.catch(() => undefined); // awaited below; never left unhandled

    // End users only see their own requisitions; HOD/admin see the department's
    if (req.user!.role === 'end_user') {
      query.requestedBy = req.user!._id;
    } else {
      Object.assign(query, await departmentScope);
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
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      PurchaseRequisition.countDocuments(query)
    ]);

    // A requisition's PO may be linked directly, through its RFQ, or through
    // a quotation on that RFQ, so all three are looked up. The PO lookup
    // starts as soon as the quotations are in, while the row's own references
    // are filled in alongside.
    const requisitionIds = requisitions.map((r: any) => r._id);
    const rfqIds = requisitions.filter((r: any) => r.rfq).map((r: any) => r.rfq);

    // exec(): one promise, awaited twice below, must not run the query twice.
    const quotationsReady: Promise<any[]> = rfqIds.length > 0
      ? Quotation.find({ rfq: { $in: rfqIds }, isDeleted: false }).select('_id rfq').lean().exec()
      : Promise.resolve([]);

    const [, quotations, allPOs] = await Promise.all([
      PurchaseRequisition.populate(requisitions, [
        { path: 'rfq', select: 'rfqNumber', options: { lean: true } },
        // A department head's list mixes their own requisitions with their
        // team's, and the table names whose each one is.
        { path: 'requestedBy', select: 'firstName lastName', options: { lean: true } }
      ]),
      quotationsReady,
      quotationsReady.then((found) => {
        const poLinks: any[] = [{ purchaseRequisition: { $in: requisitionIds } }];
        if (rfqIds.length > 0) poLinks.push({ rfq: { $in: rfqIds } });
        if (found.length > 0) poLinks.push({ quotation: { $in: found.map((q: any) => q._id) } });
        return PurchaseOrder.find({ $or: poLinks, isDeleted: false }).select(PO_FIELDS).lean();
      })
    ]);

    const rfqToQuotationIds: Record<string, string[]> = {};
    quotations.forEach((q: any) => {
      const rfqId = q.rfq.toString();
      (rfqToQuotationIds[rfqId] ||= []).push(q._id.toString());
    });

    // Delivery and collection state only matter for rows that have a PO, and
    // are fetched for every candidate PO at once, alongside the PO's own
    // references, since which PO belongs to which row needs those references.
    let poWithDeliveries = new Set<string>();
    let collectedRefs = new Set<string>();
    if (allPOs.length > 0) {
      const [, deliveries, collected] = await Promise.all([
        PurchaseOrder.populate(allPOs, [
          { path: 'supplier', select: 'companyName', options: { lean: true } },
          { path: 'rfq', select: 'purchaseRequisition', options: { lean: true } }
        ]),
        Delivery.find({
          purchaseOrder: { $in: allPOs.map((po: any) => po._id) },
          status: { $in: DELIVERED_TO_STORES },
          isDeleted: false
        })
          .select('purchaseOrder')
          .lean(),
        // A store requisition raised for these items names the purchase
        // requisition in its purpose, which is how collection is detected.
        departmentScope.then((scope) => collectedRequisitionRefs(requisitions.map(requisitionRef), scope))
      ]);
      poWithDeliveries = new Set(deliveries.map((d: any) => d.purchaseOrder.toString()));
      collectedRefs = collected;
    }

    const findPO = (reqId: string, rfqId: string | null) =>
      // Direct link via purchaseRequisition on the PO
      allPOs.find((p: any) => idOf(p.purchaseRequisition) === reqId) ||
      // Via the PO's RFQ pointing back at this requisition
      allPOs.find((p: any) => p.rfq?.purchaseRequisition && idOf(p.rfq.purchaseRequisition) === reqId) ||
      (rfqId
        ? // Via this requisition's RFQ, then via a quotation on it
          allPOs.find((p: any) => idOf(p.rfq) === rfqId) ||
          allPOs.find((p: any) => p.quotation && (rfqToQuotationIds[rfqId] || []).includes(idOf(p.quotation)!))
        : undefined);

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

      const po = findPO(r._id.toString(), r.rfq ? r.rfq._id.toString() : null);
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
        row.itemsCollected = collectedRefs.has(requisitionRef(r));

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
