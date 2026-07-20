import type { Request, Response } from 'express';
import { PurchaseOrder, Quotation, RFQ, PurchaseRequisition, Site } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { notifySupplier, notifyUsersByRole } from '../../services/notification.service.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { collectLineBids, lineFullyAuthorized, lineIdStr } from '../../services/lineAward.service.js';

/**
 * Generate one Purchase Order per winning supplier from an RFQ's per-line award
 * map. Only lines that are fully authorized (HOD selected + PM authorized, with
 * the min-3/waiver rule met on that line) and not yet turned into a PO are
 * included. Each PO enters the normal approval chain independently.
 */
const generateLineAwardPOs = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { expectedDeliveryDate, deliverToSiteId } = req.body;

    const rfq = await RFQ.findById(id);
    if (!rfq || rfq.isDeleted) {
      return res.status(404).json({ success: false, message: 'RFQ not found' });
    }
    if (!rfq.splitAward || !rfq.lineAwards?.length) {
      return res.status(400).json({ success: false, message: 'This RFQ has no per-line awards to generate POs from' });
    }

    const bids = await collectLineBids(rfq);

    // Eligible lines: awarded, fully authorized, not already turned into a PO.
    const eligible = (rfq.lineAwards as any[]).filter((la) => {
      const count = bids.get(lineIdStr(la.rfqLineId))?.length || 0;
      return la.status === 'awarded' && !la.poGenerated && lineFullyAuthorized(la, count);
    });

    if (!eligible.length) {
      return res.status(400).json({
        success: false,
        message: 'No fully-authorized, un-generated awarded lines were found. Complete HOD selection and PM authorization first.'
      });
    }

    // Group eligible lines by winning quotation (so each PO reflects one supplier's quote).
    const byQuotation = new Map<string, any[]>();
    for (const la of eligible) {
      const key = lineIdStr(la.awardedQuotation);
      if (!byQuotation.has(key)) byQuotation.set(key, []);
      byQuotation.get(key)!.push(la);
    }

    // Resolve requisition + delivery site once.
    let purchaseRequisitionId: any = rfq.purchaseRequisition || null;
    let requisitionSiteId: any = null;
    if (purchaseRequisitionId) {
      const pr = await PurchaseRequisition.findById(purchaseRequisitionId).select('site');
      requisitionSiteId = pr?.site || null;
    }
    const deliverToSite = await resolveSiteId(req.user, deliverToSiteId || requisitionSiteId);
    let resolvedAddress: any;
    if (deliverToSite) {
      const site = await Site.findById(deliverToSite);
      resolvedAddress = site?.address;
    }

    const created: any[] = [];
    for (const [quotationId, lines] of byQuotation.entries()) {
      const quotation = await Quotation.findById(quotationId).populate('supplier');
      if (!quotation) continue;

      // Build PO items from the awarded lines, matching each to this quote's line.
      const poItems = lines.map((la: any) => {
        const qItem = (quotation.items as any[]).find(
          (qi) => lineIdStr(qi.rfqLineId) === lineIdStr(la.rfqLineId)
        );
        const unitPrice = la.awardedUnitPrice ?? qItem?.unitPrice ?? 0;
        const quantity = la.quantity ?? qItem?.quantity ?? 0;
        return {
          description: la.description || qItem?.description,
          specifications: qItem?.specifications,
          quantity,
          unit: qItem?.unit,
          unitPrice,
          totalPrice: unitPrice * quantity,
          quantityReceived: 0
        };
      });

      const subtotal = poItems.reduce((s, it) => s + it.totalPrice, 0);
      const vatAmount = Math.round(subtotal * 0.15 * 100) / 100;
      const totalAmount = subtotal + vatAmount;

      const count = await PurchaseOrder.countDocuments();
      const year = new Date().getFullYear();
      const poNumber = `PO-${year}-${String(count + 1).padStart(5, '0')}`;

      const po = await PurchaseOrder.create({
        poNumber,
        quotation: quotation._id,
        rfq: rfq._id,
        purchaseRequisition: purchaseRequisitionId,
        supplier: quotation.supplier._id || quotation.supplier,
        createdBy: req.user!._id,
        items: poItems,
        subtotal,
        vatAmount,
        totalAmount,
        deliverToSite,
        deliveryAddress: resolvedAddress,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
        paymentTerms: quotation.paymentTerms,
        status: 'draft',
        approvalHistory: [{
          action: 'created', by: req.user!._id, role: req.user!.role,
          comments: `Created from split award on RFQ ${rfq.rfqNumber}`
        }]
      });

      // Mark the awarded lines as PO-generated and link them.
      for (const la of lines) {
        la.poGenerated = true;
        la.purchaseOrder = po._id;
      }

      await notifySupplier(quotation.supplier._id || quotation.supplier, {
        type: 'po_created',
        title: 'New Purchase Order Created',
        message: `Purchase Order ${po.poNumber} has been created from RFQ ${rfq.rfqNumber} and requires your acknowledgement.`,
        entity: 'PurchaseOrder', entityId: po._id, relatedUser: req.user!._id,
        metadata: { poNumber: po.poNumber, totalAmount: po.totalAmount, isSupplier: true }
      });

      created.push({ poId: po._id, poNumber: po.poNumber, supplier: quotation.supplier.companyName, totalAmount });
    }

    // If every line is now resolved (awarded+generated, or unquoted/unawarded),
    // mark the RFQ awarded. Otherwise leave it open for the remaining lines.
    const allResolved = (rfq.lineAwards as any[]).every(
      (la) => la.poGenerated || la.status === 'unquoted' || la.status === 'unawarded'
    );
    if (allResolved) rfq.status = 'awarded';
    await rfq.save();

    // Move the requisition toward 'ordered' (kept simple; full per-line
    // fulfilment tracking is refined in the requisition itself).
    if (purchaseRequisitionId) {
      const requisition = await PurchaseRequisition.findById(purchaseRequisitionId);
      if (requisition && !['ordered', 'completed'].includes(requisition.status)) {
        (requisition as any).status = 'ordered';
        (requisition as any).statusHistory.push({
          action: 'po_created', by: req.user!._id, role: req.user!.role,
          comments: `${created.length} PO(s) created from split award on RFQ ${rfq.rfqNumber}`
        });
        await requisition.save();
      }
    }

    await createAuditLog({
      action: 'create', entity: 'PurchaseOrder', user: req.user,
      description: `Generated ${created.length} PO(s) from split award on RFQ ${rfq.rfqNumber}`,
      newData: { rfqId: rfq._id, pos: created.map((c) => c.poNumber) }, req
    });

    await notifyUsersByRole(['finance', 'coo'], {
      type: 'po_created', title: 'New Purchase Orders Created',
      message: `${created.length} purchase order(s) were created from RFQ ${rfq.rfqNumber}.`,
      entity: 'RFQ', entityId: rfq._id, relatedUser: req.user!._id
    });

    res.status(201).json({
      success: true,
      message: `Generated ${created.length} purchase order(s) across ${byQuotation.size} supplier(s).`,
      data: { rfqId: rfq._id, rfqStatus: rfq.status, purchaseOrders: created }
    });
  } catch (error: any) {
    console.error('Generate line-award POs error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default generateLineAwardPOs;
