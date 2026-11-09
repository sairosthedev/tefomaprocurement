import { isValidCategoryCode } from '@fossil/shared';
import { PurchaseRequisition, Item, Inventory, StoreTransaction } from '../models/index.js';
import { createNotification, notifyUsersByRole } from './notification.service.js';
import { resolveSiteId } from '../lib/siteScope.js';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Resolve catalog Item for a requisition line (linked id or name match). */
export async function resolveCatalogItem(line: any): Promise<any> {
  if (line.item) {
    const byRef = await Item.findById(line.item);
    if (byRef && !byRef.isDeleted) return byRef;
  }
  const desc = (line.description || '').trim();
  if (!desc) return null;
  const exact = new RegExp(`^${escapeRegex(desc)}$`, 'i');
  return Item.findOne({
    isDeleted: false,
    status: 'active',
    $or: [{ name: exact }, { description: exact }]
  });
}

const CATALOG_UNITS = ['each', 'kg', 'litre', 'meter', 'box', 'pack', 'set', 'roll', 'sheet', 'pair'];

/**
 * The catalogue item an order line's goods are booked to on receipt: the item
 * named exactly as the line, or a new one.
 *
 * Exact, as everywhere else stores match by name, so the store requisition
 * that later collects the line finds the same item and its stock. A partial
 * match booked "Bolt" to "Bolt cutter", and an unescaped bracket in a
 * description failed the receipt after the GRV had been saved.
 */
export async function catalogItemForOrderLine(poItem: any): Promise<any> {
  const existing = await resolveCatalogItem({ description: poItem.description });
  if (existing) return existing;
  const itemCount = await Item.countDocuments();
  const unit = String(poItem.unit || 'each').toLowerCase();
  return Item.create({
    code: `ITEM-${String(itemCount + 1).padStart(6, '0')}`,
    name: poItem.description,
    description: poItem.description,
    category: 'General',
    unit: CATALOG_UNITS.includes(unit) ? unit : 'each',
    status: 'active'
  });
}

/** How much of a line stores still has to supply. */
const remainingOf = (line: any): number => line.quantity - (line.quantityFulfilledFromStock || 0);

/**
 * Lines that would go to procurement without a category. Requesters no longer
 * choose one; stores sets it during review, and RFQ supplier matching is by
 * category, so none may leave stores without it.
 */
export function uncategorisedLines(lines: any[]): any[] {
  return lines.filter((line) => !isValidCategoryCode(line.category || ''));
}

/** The refusal for `uncategorisedLines`, or null when every line has one. */
export function missingCategoryMessage(lines: any[]): string | null {
  const missing = uncategorisedLines(lines);
  if (missing.length === 0) return null;
  const names = missing.map((line) => `"${line.description}"`).join(', ');
  return `Set a category on ${missing.length === 1 ? 'this line' : 'these lines'} before sending to procurement: ${names}`;
}

/** Lines not yet issued, i.e. everything a forward sends to procurement. */
export function linesStillOpen(requisition: any): any[] {
  return (requisition.items as any[]).filter((line) => remainingOf(line) > 0);
}

/** Lines that stock at the site cannot fully cover, i.e. what auto-process sends to procurement. */
export async function linesShortOfStock(requisition: any, siteId: any): Promise<any[]> {
  const short: any[] = [];
  for (const line of linesStillOpen(requisition)) {
    const catalogItem = siteId ? await resolveCatalogItem(line) : null;
    const inventory = catalogItem
      ? await Inventory.findOne({ item: catalogItem._id, site: siteId, isDeleted: false })
      : null;
    const available = inventory ? Math.max(0, inventory.quantityOnHand - (inventory.quantityReserved || 0)) : 0;
    if (available < remainingOf(line)) short.push(line);
  }
  return short;
}

/** SI-YYYY-NNNNN — assigned when stock is physically issued. */
export async function generateStoresIssueNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await PurchaseRequisition.findOne({
    storesIssueNumber: { $regex: `^SI-${year}-` }
  })
    .sort({ storesIssueNumber: -1 })
    .select('storesIssueNumber');

  let counter = 0;
  if (last?.storesIssueNumber) {
    const match = last.storesIssueNumber.match(/SI-\d+-(\d+)/);
    if (match) counter = parseInt(match[1], 10) || 0;
  }
  return `SI-${year}-${String(counter + 1).padStart(5, '0')}`;
}

export interface ProcessResult {
  requisition: any;
  summary: {
    totalLines: number;
    fullyFromStock: number;
    partial: number;
    notInStock: number;
    issuedLines: Array<{ description: string; issued: number; unit: string }>;
  };
  message: string;
}

/**
 * Check inventory and issue available stock; forward any shortfall to procurement.
 * Mirrors the paper IR "Qty Delivered" column digitally.
 */
export async function processRequisitionAgainstStock(
  requisition: any,
  user: any,
  notes?: string
): Promise<ProcessResult> {
  const siteId = requisition.site || (await resolveSiteId(user));

  const issuedLines: Array<{ description: string; issued: number; unit: string }> = [];
  const shortfallItems: any[] = [];
  const summary = {
    totalLines: requisition.items.length,
    fullyFromStock: 0,
    partial: 0,
    notInStock: 0,
    issuedLines: [] as Array<{ description: string; issued: number; unit: string }>
  };

  for (const line of requisition.items as any[]) {
    // Only what is still owed: stores may have issued part of it by hand.
    const alreadyIssued = line.quantityFulfilledFromStock || 0;
    const requested = remainingOf(line);
    if (requested <= 0) {
      summary.fullyFromStock += 1;
      continue;
    }
    const catalogItem = await resolveCatalogItem(line);

    let issueQty = 0;
    let inventory: any = null;

    if (catalogItem) {
      inventory = await Inventory.findOne({ item: catalogItem._id, site: siteId, isDeleted: false });
      if (inventory) {
        const available = Math.max(0, inventory.quantityOnHand - (inventory.quantityReserved || 0));
        issueQty = Math.min(available, requested);
      }
    }

    if (issueQty > 0 && inventory && catalogItem) {
      const previousQty = inventory.quantityOnHand;
      inventory.quantityOnHand -= issueQty;
      inventory.lastIssuedDate = new Date();
      await inventory.save();

      await StoreTransaction.create({
        type: 'issue',
        site: siteId,
        item: catalogItem._id,
        inventory: inventory._id,
        quantity: -issueQty,
        previousQuantity: previousQty,
        newQuantity: inventory.quantityOnHand,
        unitCost: inventory.unitCost || line.estimatedUnitPrice || 0,
        reference: { type: 'purchase_requisition', document: requisition._id },
        department: requisition.department,
        performedBy: user._id,
        notes: notes || `Issued for requisition ${requisition.requisitionNumber}`
      });

      issuedLines.push({ description: line.description, issued: issueQty, unit: line.unit });
    }

    const shortfall = requested - issueQty;
    if (shortfall > 0) {
      if (issueQty > 0 || alreadyIssued > 0) summary.partial += 1;
      else summary.notInStock += 1;
      shortfallItems.push({
        item: catalogItem?._id || line.item,
        package: line.package,
        description: line.description,
        category: line.category,
        specification: line.specification,
        specifications: line.specifications,
        // The data-plate photos are what lets a supplier quote the right spare.
        equipment: line.equipment,
        attachments: line.attachments,
        quantity: shortfall,
        unit: line.unit,
        estimatedUnitPrice: line.estimatedUnitPrice,
        estimatedTotalPrice: line.estimatedUnitPrice ? line.estimatedUnitPrice * shortfall : 0,
        quantityFulfilledFromStock: alreadyIssued + issueQty
      });
    } else {
      summary.fullyFromStock += 1;
    }
  }

  summary.issuedLines = issuedLines;

  const issuedSummary = issuedLines.length
    ? issuedLines.map((l) => `${l.issued} ${l.unit} ${l.description}`).join('; ')
    : 'nothing';

  requisition.storesReviewedBy = user._id;
  requisition.storesReviewedAt = new Date();

  if (issuedLines.length > 0 && !requisition.storesIssueNumber) {
    requisition.storesIssueNumber = await generateStoresIssueNumber();
  }

  if (shortfallItems.length === 0) {
    (requisition.items as any[]).forEach((line) => {
      line.quantityFulfilledFromStock = line.quantity;
    });
    requisition.status = 'fulfilled';
    requisition.storesReviewNotes =
      notes || `Issued from stock (${issuedSummary}). Stores Issue ${requisition.storesIssueNumber || '—'}.`;
    requisition.statusHistory.push({
      action: 'fulfilled_from_stock',
      by: user._id,
      role: user.role,
      comments: `Issued from stock: ${issuedSummary}`
    });
  } else {
    requisition.items = shortfallItems as any;
    requisition.status = 'pending_acceptance';
    requisition.storesReviewNotes = issuedLines.length
      ? `${notes || 'Auto-processed'}: issued (${issuedSummary}); balance to procurement.`
      : notes || 'No matching stock — forwarded to procurement.';

    if (issuedLines.length) {
      requisition.statusHistory.push({
        action: 'fulfilled_from_stock',
        by: user._id,
        role: user.role,
        comments: `Partial issue from stock: ${issuedSummary}`
      });
    }
    requisition.statusHistory.push({
      action: 'forwarded_to_procurement',
      by: user._id,
      role: user.role,
      comments: `${shortfallItems.length} line(s) forwarded to procurement`
    });
  }

  await requisition.save();

  await createNotification({
    recipient: requisition.requestedBy,
    type: requisition.status === 'fulfilled' ? 'requisition_accepted' : 'requisition_updated',
    title:
      requisition.status === 'fulfilled'
        ? 'Request fulfilled from stores'
        : 'Request partially fulfilled from stores',
    message:
      requisition.status === 'fulfilled'
        ? `Your requisition ${requisition.requisitionNumber} was fully issued from stock (Issue No. ${requisition.storesIssueNumber || '—'}).`
        : `Stores issued available stock for ${requisition.requisitionNumber}; remaining items forwarded to procurement.`,
    entity: 'PurchaseRequisition',
    entityId: requisition._id,
    relatedUser: user._id
  });

  if (requisition.status === 'pending_acceptance') {
    await notifyUsersByRole('procurement_officer', {
      type: 'requisition_submitted',
      title: 'Requisition ready for procurement',
      message: `Requisition ${requisition.requisitionNumber} passed stores review and needs acceptance.`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  }

  const message =
    requisition.status === 'fulfilled'
      ? 'Requisition fully fulfilled from stock'
      : issuedLines.length
      ? 'Available stock issued; balance forwarded to procurement'
      : 'No matching stock — requisition forwarded to procurement';

  return { requisition, summary, message };
}

interface LineIssueResult {
  requisition: any;
  issueQty: number;
  lineDescription: string;
  allLinesFulfilled: boolean;
  storesIssueNumber?: string;
}

/**
 * Manually issue stock for a single requisition line after stores verifies inventory.
 * When itemId is supplied, stock is taken from that catalog item (user-selected row).
 */
export async function issueRequisitionLine(
  requisition: any,
  lineIndex: number,
  user: any,
  notes?: string,
  itemId?: string
): Promise<LineIssueResult> {
  if (requisition.status !== 'stores_review') {
    throw new Error('Requisition is not in stores review');
  }

  const line = requisition.items[lineIndex];
  if (!line) {
    throw new Error('Line not found');
  }

  const alreadyIssued = line.quantityFulfilledFromStock || 0;
  const remaining = line.quantity - alreadyIssued;
  if (remaining <= 0) {
    throw new Error('This line is already fully issued');
  }

  const catalogItem = itemId
    ? await Item.findOne({ _id: itemId, isDeleted: false, status: 'active' })
    : await resolveCatalogItem(line);
  if (!catalogItem) {
    throw new Error(
      itemId
        ? 'Selected item not found in catalog'
        : 'No matching catalog item. Search inventory, add the item if needed, then issue again.'
    );
  }

  const siteId = requisition.site || (await resolveSiteId(user));
  const inventory = await Inventory.findOne({ item: catalogItem._id, site: siteId, isDeleted: false });
  if (!inventory) {
    throw new Error('Item is not in site inventory');
  }

  const available = Math.max(0, inventory.quantityOnHand - (inventory.quantityReserved || 0));
  if (available < remaining) {
    throw new Error(
      `Insufficient stock for "${line.description}". Available: ${available} ${line.unit}, required: ${remaining} ${line.unit}`
    );
  }

  const issueQty = remaining;
  const previousQty = inventory.quantityOnHand;
  inventory.quantityOnHand -= issueQty;
  inventory.lastIssuedDate = new Date();
  await inventory.save();

  await StoreTransaction.create({
    type: 'issue',
    site: siteId,
    item: catalogItem._id,
    inventory: inventory._id,
    quantity: -issueQty,
    previousQuantity: previousQty,
    newQuantity: inventory.quantityOnHand,
    unitCost: inventory.unitCost || line.estimatedUnitPrice || 0,
    reference: { type: 'purchase_requisition', document: requisition._id },
    department: requisition.department,
    performedBy: user._id,
    notes: notes || `Issued for requisition ${requisition.requisitionNumber}: ${line.description}`
  });

  line.quantityFulfilledFromStock = alreadyIssued + issueQty;

  if (!requisition.storesIssueNumber) {
    requisition.storesIssueNumber = await generateStoresIssueNumber();
  }

  requisition.storesReviewedBy = user._id;
  requisition.storesReviewedAt = new Date();

  const allLinesFulfilled = (requisition.items as any[]).every(
    (l) => (l.quantityFulfilledFromStock || 0) >= l.quantity
  );

  if (allLinesFulfilled) {
    requisition.status = 'fulfilled';
    requisition.storesReviewNotes =
      notes ||
      `Issued from stock. Stores Issue ${requisition.storesIssueNumber}.`;
    requisition.statusHistory.push({
      action: 'fulfilled_from_stock',
      by: user._id,
      role: user.role,
      comments: `All lines issued from stock (Issue No. ${requisition.storesIssueNumber})`
    });

    await createNotification({
      recipient: requisition.requestedBy,
      type: 'requisition_accepted',
      title: 'Request fulfilled from stores',
      message: `Your requisition ${requisition.requisitionNumber} was fully issued from stock (Issue No. ${requisition.storesIssueNumber}).`,
      entity: 'PurchaseRequisition',
      entityId: requisition._id,
      relatedUser: user._id
    });
  }

  await requisition.save();

  return {
    requisition,
    issueQty,
    lineDescription: line.description,
    allLinesFulfilled,
    storesIssueNumber: requisition.storesIssueNumber
  };
}

/** True when every line can be fully covered from stock at the requisition site. */
export async function canFullyFulfillFromStock(requisition: any): Promise<boolean> {
  if (!requisition.site || requisition.items.length === 0) return false;
  return (await linesShortOfStock(requisition, requisition.site)).length === 0;
}
