import type { Request, Response } from 'express';

import { PurchaseRequisition, PurchaseOrder, Quotation, Delivery } from '../../models/index.js';
import { isProcurementHead } from '@fossil/shared';
import { resolveUserDepartmentIds } from '../../lib/departmentScope.js';
import { DELIVERED_TO_STORES, collectionState, storeRequisitionsByRequisition, unitsReceivedOn, type LinkedStoreRequisition } from '../../lib/requisitionLinks.js';

// Statuses procurement works with, across every department.
const PROCUREMENT_STATUSES = ['pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered', 'completed'];

// This feeds the requisitions table, so a row carries only what the table
// shows or acts on; everything else comes from GET /requisitions/:id.
// `items._id` is read for the line count only.
const ROW_FIELDS = 'requisitionNumber title priority status createdAt department requestedBy rfq items._id budgetCheck';
// The RFQ form raises an RFQ from an accepted row of this list
// (?status=accepted) and copies its lines and justification, so accepted rows
// keep those in full.
const RFQ_SOURCE_FIELDS = 'items justification';
const PO_FIELDS = 'poNumber status financeApproved cooApproved supplier purchaseRequisition quotation items.quantityReceived';

const getPendingRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query as Record<string, any>;

    const query: any = { isDeleted: false };

    // The Head of Procurement works from this list but is still the head of
    // their own department, so its requisitions show here at every stage —
    // including drafts and pending_hod, which they raise and approve. Other
    // departments' requisitions stay limited to the procurement stages.
    const ownDeptIds = isProcurementHead(req.user) ? await resolveUserDepartmentIds(req.user) : [];
    const ownDept = ownDeptIds.length ? { department: { $in: ownDeptIds } } : null;

    if (status) {
      query.status = status;
      if (ownDept && !PROCUREMENT_STATUSES.includes(String(status)) && status !== 'rejected') {
        Object.assign(query, ownDept);
      }
    } else if (ownDept) {
      query.$and = [{ $or: [{ status: { $in: PROCUREMENT_STATUSES } }, ownDept] }];
    } else {
      // Show pending_acceptance by default, or all non-draft (including completed to show delivered items)
      query.status = { $in: PROCUREMENT_STATUSES };
    }

    if (search) {
      query.$or = [
        { requisitionNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [total, requisitions] = await Promise.all([
      PurchaseRequisition.countDocuments(query),
      PurchaseRequisition.find(query)
        .select(ROW_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    const requisitionIds = requisitions.map((r: any) => r._id);
    const rfqIds = requisitions.filter((r: any) => r.rfq).map((r: any) => r.rfq);
    const acceptedIds = requisitions.filter((r: any) => r.status === 'accepted').map((r: any) => r._id);

    // Everything below needs only the page's own ids, so it goes out at once
    // rather than one lookup after another.
    const [, quotations, directPOs, rfqSources] = await Promise.all([
      PurchaseRequisition.populate(requisitions, [
        { path: 'department', select: 'name code', options: { lean: true } },
        { path: 'requestedBy', select: 'firstName lastName', options: { lean: true } },
        { path: 'rfq', select: 'rfqNumber', options: { lean: true } }
      ]),
      rfqIds.length > 0
        ? Quotation.find({ rfq: { $in: rfqIds }, isDeleted: false }).select('_id rfq').lean()
        : Promise.resolve([] as any[]),
      // POs linked directly to the requisitions
      PurchaseOrder.find({ purchaseRequisition: { $in: requisitionIds }, isDeleted: false })
        .select(PO_FIELDS)
        .lean(),
      acceptedIds.length > 0
        ? PurchaseRequisition.find({ _id: { $in: acceptedIds } }).select(RFQ_SOURCE_FIELDS).lean()
        : Promise.resolve([] as any[])
    ]);

    const rfqToQuotationIds: Record<string, string[]> = {};
    quotations.forEach((q: any) => {
      (rfqToQuotationIds[q.rfq.toString()] ||= []).push(q._id.toString());
    });

    const directPoFor = (reqId: string) => directPOs.find((p: any) => p.purchaseRequisition?.toString() === reqId);

    // Requisitions with no direct PO may still have one through their RFQ's
    // quotations. Only those need the second lookup.
    const viaQuotationIds = requisitions
      .filter((r: any) => r.rfq && !directPoFor(r._id.toString()))
      .flatMap((r: any) => rfqToQuotationIds[(r.rfq._id || r.rfq).toString()] || []);
    const rfqLinkedPOs: any[] = viaQuotationIds.length > 0
      ? await PurchaseOrder.find({ quotation: { $in: viaQuotationIds }, isDeleted: false })
        .select(PO_FIELDS)
        .lean()
      : [];

    // Direct links first, then the RFQ-linked ones, without duplicates
    const allPOs: any[] = [...directPOs];
    rfqLinkedPOs.forEach((po) => {
      if (!allPOs.find((p) => p._id.toString() === po._id.toString())) allPOs.push(po);
    });

    const poByRequisition = new Map<string, any>();
    requisitions.forEach((r: any) => {
      const reqId = r._id.toString();
      // First the direct link via purchaseRequisition, then via RFQ -> quotation -> PO
      let po = allPOs.find((p) => p.purchaseRequisition?.toString() === reqId);
      if (!po && r.rfq) {
        const quotationIds = rfqToQuotationIds[(r.rfq._id || r.rfq).toString()] || [];
        if (quotationIds.length > 0) {
          po = allPOs.find((p) => quotationIds.includes(p.quotation?._id ? p.quotation._id.toString() : p.quotation?.toString()));
        }
      }
      if (po) poByRequisition.set(reqId, po);
    });

    // Delivery and collection state only matter for rows that have a PO.
    const matchedPOs = Array.from(new Set(poByRequisition.values()));
    let poWithDeliveries = new Set<string>();
    let storeRequisitions = new Map<string, LinkedStoreRequisition[]>();
    if (matchedPOs.length > 0) {
      const [, deliveries, linked] = await Promise.all([
        PurchaseOrder.populate(matchedPOs, { path: 'supplier', select: 'companyName', options: { lean: true } }),
        // received counts too: receiveGoods auto-accepts
        Delivery.find({
          purchaseOrder: { $in: matchedPOs.map((po) => po._id) },
          status: { $in: DELIVERED_TO_STORES },
          isDeleted: false
        })
          .select('purchaseOrder')
          .lean(),
        // Procurement sees every department's store requisitions.
        storeRequisitionsByRequisition(requisitions.filter((r: any) => poByRequisition.has(r._id.toString())))
      ]);
      poWithDeliveries = new Set(deliveries.map((d: any) => d.purchaseOrder.toString()));
      storeRequisitions = linked;
    }

    const sourceById = new Map<string, any>(rfqSources.map((s: any) => [s._id.toString(), s]));

    const rows = requisitions.map((r: any) => {
      const row: any = {
        _id: r._id,
        requisitionNumber: r.requisitionNumber,
        title: r.title,
        priority: r.priority,
        status: r.status,
        createdAt: r.createdAt,
        department: r.department,
        requestedBy: r.requestedBy,
        itemCount: r.items?.length || 0,
        rfq: r.rfq
      };

      const source = sourceById.get(r._id.toString());
      if (source) {
        row.items = source.items;
        row.justification = source.justification;
      }

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
        const collection = collectionState(storeRequisitions.get(r._id.toString()), unitsReceivedOn(po));
        row.itemsCollected = collection.itemsCollected;
        row.storeRequisition = collection.storeRequisition;

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
  } catch (error: any) {
    console.error('Get pending requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getPendingRequisitions;
