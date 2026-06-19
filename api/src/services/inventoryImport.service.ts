import { Item, Inventory, StoreTransaction } from '../models/index.js';

const VALID_UNITS = ['each', 'kg', 'litre', 'meter', 'box', 'pack', 'set', 'roll', 'sheet', 'pair'];

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeUnit = (unit?: string): string => {
  const u = (unit || 'each').toString().trim().toLowerCase();
  return VALID_UNITS.includes(u) ? u : 'each';
};

const toNumber = (value: any): number => {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export interface InventoryRowInput {
  code?: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  reorderLevel?: number | string;
  quantity?: number | string;
  unitPrice?: number | string;
  /** Ledger note when an opening-balance transaction is recorded */
  transactionNotes?: string;
}

export interface RowResult {
  row: number;
  name: string;
  itemId?: string;
  status: 'created' | 'updated' | 'failed';
  message?: string;
}

const generateItemCode = async (): Promise<string> => {
  const count = await Item.countDocuments();
  return `ITEM-${String(count + 1).padStart(6, '0')}`;
};

/**
 * Upsert a single inventory row: catalog Item + site Inventory, and record an
 * opening-balance adjustment when a quantity is supplied. Returns the outcome.
 */
export async function processInventoryRow(
  row: InventoryRowInput,
  siteId: any,
  user: any,
  rowNumber: number
): Promise<RowResult> {
  const name = (row.name || '').toString().trim();
  const code = (row.code || '').toString().trim();

  if (!name && !code) {
    return { row: rowNumber, name: name || code, status: 'failed', message: 'Name or item code is required' };
  }

  // Match existing catalog item by code first, then by exact name.
  let item: any = null;
  if (code) {
    item = await Item.findOne({ code: code.toUpperCase(), isDeleted: false });
  }
  if (!item && name) {
    item = await Item.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i'), isDeleted: false });
  }

  const unit = normalizeUnit(row.unit);
  const reorderLevel = toNumber(row.reorderLevel);
  const hasQuantity = row.quantity !== undefined && row.quantity !== null && String(row.quantity).trim() !== '';
  const quantity = toNumber(row.quantity);
  const unitPrice = toNumber(row.unitPrice);

  let created = false;
  if (!item) {
    item = await Item.create({
      code: code ? code.toUpperCase() : await generateItemCode(),
      name: name || code,
      description: (row.description || '').toString().trim() || name || code,
      category: (row.category || '').toString().trim() || 'General',
      unit,
      reorderLevel,
      status: 'active'
    });
    created = true;
  } else {
    if (row.description) item.description = row.description.toString().trim();
    if (row.category) item.category = row.category.toString().trim();
    if (row.unit) item.unit = unit;
    if (row.reorderLevel !== undefined && row.reorderLevel !== '') item.reorderLevel = reorderLevel;
    await item.save();
  }

  // Find or create the site-scoped inventory record (restore soft-deleted rows).
  let inventory = await Inventory.findOne({ item: item._id, site: siteId, isDeleted: false });
  if (!inventory) {
    const deleted = await Inventory.findOne({ item: item._id, site: siteId, isDeleted: true });
    if (deleted) {
      inventory = deleted;
      inventory.isDeleted = false;
      inventory.quantityOnHand = 0;
      inventory.quantityReserved = 0;
    }
  }
  if (!inventory) {
    inventory = await Inventory.create({
      item: item._id,
      site: siteId,
      quantityOnHand: 0,
      quantityReserved: 0,
      unitCost: unitPrice
    });
  } else if (unitPrice > 0) {
    inventory.unitCost = unitPrice;
  }

  // Opening balance: set on-hand to the imported quantity and log the delta.
  if (hasQuantity) {
    const previousQty = inventory.quantityOnHand;
    const delta = quantity - previousQty;
    inventory.quantityOnHand = quantity;
    inventory.lastReceivedDate = new Date();
    await inventory.save();

    if (delta !== 0) {
      await StoreTransaction.create({
        type: delta > 0 ? 'receipt' : 'adjustment',
        site: siteId,
        item: item._id,
        inventory: inventory._id,
        quantity: delta,
        previousQuantity: previousQty,
        newQuantity: quantity,
        unitCost: inventory.unitCost || 0,
        totalValue: Math.abs(delta) * (inventory.unitCost || 0),
        reference: { type: 'adjustment' },
        performedBy: user._id,
        notes: row.transactionNotes || 'Bulk import — opening balance'
      });
    }
  } else {
    await inventory.save();
  }

  return {
    row: rowNumber,
    name: item.name,
    itemId: item._id.toString(),
    status: created ? 'created' : 'updated'
  };
}
