/**
 * Form validators for Stores: receiving goods, inventory items, reorder levels, restocks, bulk import,
 * stock transfers, and store requisitions (ready, rejected, handed over).
 *
 * Built from the helpers in rules.ts; see that file for the conventions.
 */
import { isValidCategoryCode } from '../constants/supplierCategories.js';
import {
  FormErrors,
  TEXT_LIMITS,
  date,
  isBlank,
  lineField,
  maxLength,
  money,
  notFuture,
  number,
  objectId,
  oneOf,
  phone,
  reason,
  required,
  text,
  toNumber,
  type FieldErrors
} from './rules.js';

/** Longest text for the stores fields that TEXT_LIMITS has no kind for. */
export const STORES_TEXT_LIMITS = Object.freeze({
  itemCode: 40,
  itemName: 200,
  unit: 40,
  location: 60,
  documentNumber: 60,
  idNumber: 40,
  vehicle: 30
});

/** Most rows one inventory import may carry. */
export const INVENTORY_IMPORT_MAX_ROWS = 2000;

const DELIVERY_CONDITIONS = ['good', 'damaged', 'defective'];
const DELIVERY_DECISIONS = ['accepted', 'partially_accepted', 'rejected'];
const RESTOCK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/** A number that can be compared: not blank and not NaN. */
function counted(value: unknown): number | null {
  const n = toNumber(value);
  return n === null || Number.isNaN(n) ? null : n;
}

/** A quantity for a message, without floating-point dust. */
function shown(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function has(map: Record<string, number>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function asList(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** A person's details on a hand-over (driver, collector). Only checked when the block was sent. */
function personErrors(
  v: FormErrors,
  prefix: string,
  person: any,
  nameMessage: string,
  extra: { field: string; label: string; max: number }[]
): void {
  if (person === undefined || person === null) return;
  const p = typeof person === 'object' ? person : {};
  v.add(`${prefix}.name`, required(p.name, nameMessage), maxLength(p.name, TEXT_LIMITS.name, 'Name'));
  for (const { field, label, max } of extra) {
    v.add(`${prefix}.${field}`, maxLength(p[field], max, label));
  }
  v.add(`${prefix}.contactNumber`, phone(p.contactNumber), maxLength(p.contactNumber, TEXT_LIMITS.phone, 'Contact number'));
}

/**
 * Quantities sent against lines of a record that is already known (a transfer
 * being shipped or received, a store requisition being handed over): each line
 * names one of the record's lines, and no line takes more than is left on it.
 */
function movementLineErrors(
  v: FormErrors,
  items: unknown,
  remaining: Record<string, number> | undefined,
  options: { integer: boolean; allowZero: boolean; notOnRecord: string; tooMany: (left: number) => string }
): void {
  if (!Array.isArray(items)) return;
  const totals = new Map<string, { sum: number; lines: number[] }>();
  items.forEach((line: any, i: number) => {
    const l = line && typeof line === 'object' ? line : {};
    const idField = lineField('items', i, 'itemId');
    const qtyField = lineField('items', i, 'quantity');
    v.add(idField, required(l.itemId, 'Choose a line'), objectId(l.itemId, 'Choose a line'));
    v.add(
      qtyField,
      number(l.quantity, {
        label: 'Quantity',
        integer: options.integer,
        ...(options.allowZero ? { min: 0 } : { greaterThan: 0 })
      })
    );
    if (!remaining || isBlank(l.itemId)) return;
    const key = text(l.itemId);
    if (!has(remaining, key)) {
      v.add(idField, options.notOnRecord);
      return;
    }
    const n = counted(l.quantity);
    if (n === null) return;
    const entry = totals.get(key) || { sum: 0, lines: [] };
    entry.sum += n;
    entry.lines.push(i);
    totals.set(key, entry);
  });
  for (const [key, { sum, lines }] of totals) {
    const left = Math.max(0, remaining![key]);
    if (sum > left + 1e-9) {
      for (const i of lines) v.add(lineField('items', i, 'quantity'), options.tooMany(shown(left)));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Receiving goods (GRV)                                               */
/* ------------------------------------------------------------------ */

export interface GoodsReceiptLineInput {
  poItem?: unknown;
  description?: unknown;
  quantityOrdered?: unknown;
  quantityReceived?: unknown;
  quantityRejected?: unknown;
  rejectionReason?: unknown;
  condition?: unknown;
  notes?: unknown;
}

export interface GoodsReceiptInput {
  purchaseOrderId?: unknown;
  deliveryNoteNumber?: unknown;
  deliveryDate?: unknown;
  items?: GoodsReceiptLineInput[] | unknown;
  deliveredBy?: {
    name?: unknown;
    idNumber?: unknown;
    company?: unknown;
    vehicleRegistration?: unknown;
    contactNumber?: unknown;
  } | null;
  inspectedByName?: unknown;
  inspectedByDepartment?: unknown;
  witnesses?: { mt?: unknown; security?: unknown; sheq?: unknown } | null;
  msdsReference?: unknown;
  notes?: unknown;
}

export interface GoodsReceiptContext {
  /**
   * What is still due on each order line, by the line's id. Given once the
   * order is known; a line may not receive more than is still due.
   */
  outstanding?: Record<string, number>;
}

/**
 * Receive goods against a purchase order. A rejected quantity is part of what
 * was received, so it cannot be more than was received, and it needs a reason
 * unless the line's condition (damaged, defective) already says why. The driver
 * block, when sent, needs the driver's name.
 */
export function validateGoodsReceipt(input: GoodsReceiptInput, context: GoodsReceiptContext = {}): FieldErrors {
  const v = new FormErrors();
  v.add('purchaseOrderId', required(input.purchaseOrderId, 'Choose a purchase order'), objectId(input.purchaseOrderId, 'Choose a purchase order'));
  v.add(
    'deliveryNoteNumber',
    required(input.deliveryNoteNumber, 'Enter the delivery note number'),
    maxLength(input.deliveryNoteNumber, STORES_TEXT_LIMITS.documentNumber, 'Delivery note number')
  );
  v.add(
    'deliveryDate',
    required(input.deliveryDate, 'Enter the delivery date'),
    date(input.deliveryDate, 'Delivery date'),
    notFuture(input.deliveryDate, 'Delivery date')
  );

  const items = asList(input.items);
  if (items.length === 0) {
    v.add('items', 'Add at least one item');
  } else if (!items.some((line: any) => (counted(line?.quantityReceived) ?? 0) > 0)) {
    v.add('items', 'Enter the quantity received for at least one item');
  }

  items.forEach((line: any, i: number) => {
    const l = line && typeof line === 'object' ? line : {};
    const field = (name: string) => lineField('items', i, name);
    const received = counted(l.quantityReceived);
    const rejected = counted(l.quantityRejected);
    v.add(field('poItem'), objectId(l.poItem, 'Choose an item from the order'));
    v.add(
      field('quantityReceived'),
      required(l.quantityReceived, 'Enter the quantity received'),
      number(l.quantityReceived, { label: 'Quantity received', min: 0 })
    );
    v.add(
      field('quantityRejected'),
      number(l.quantityRejected, { label: 'Quantity rejected', min: 0 }),
      received !== null && rejected !== null && rejected > received ? 'Rejected cannot be more than received' : ''
    );
    v.add(field('condition'), oneOf(l.condition, DELIVERY_CONDITIONS, 'Choose good, damaged or defective'));
    const explainedByCondition = l.condition === 'damaged' || l.condition === 'defective';
    v.add(
      field('rejectionReason'),
      rejected !== null && rejected > 0 && !explainedByCondition
        ? reason(l.rejectionReason, 'Give a reason for rejecting this item', TEXT_LIMITS.short)
        : maxLength(l.rejectionReason, TEXT_LIMITS.short, 'Reason')
    );
    v.add(field('notes'), maxLength(l.notes, TEXT_LIMITS.long, 'Notes'));
  });

  if (context.outstanding) {
    const outstanding = context.outstanding;
    const totals = new Map<string, { sum: number; lines: number[] }>();
    items.forEach((line: any, i: number) => {
      if (!line || isBlank(line.poItem)) return;
      const key = text(line.poItem);
      if (!has(outstanding, key)) {
        v.add(lineField('items', i, 'poItem'), 'This item is not on the purchase order');
        return;
      }
      const n = counted(line.quantityReceived);
      if (n === null) return;
      const entry = totals.get(key) || { sum: 0, lines: [] };
      entry.sum += n;
      entry.lines.push(i);
      totals.set(key, entry);
    });
    for (const [key, { sum, lines }] of totals) {
      const due = Math.max(0, outstanding[key]);
      if (sum > due + 1e-9) {
        const message = due > 0 ? `Only ${shown(due)} still due on this order` : 'Nothing more is due on this order line';
        for (const i of lines) v.add(lineField('items', i, 'quantityReceived'), message);
      }
    }
  }

  personErrors(v, 'deliveredBy', input.deliveredBy, 'Enter the name of whoever delivered the goods', [
    { field: 'idNumber', label: 'ID number', max: STORES_TEXT_LIMITS.idNumber },
    { field: 'company', label: 'Company', max: TEXT_LIMITS.name },
    { field: 'vehicleRegistration', label: 'Vehicle registration', max: STORES_TEXT_LIMITS.vehicle }
  ]);

  v.add('inspectedByName', maxLength(input.inspectedByName, TEXT_LIMITS.name, 'Name'));
  v.add('inspectedByDepartment', maxLength(input.inspectedByDepartment, TEXT_LIMITS.name, 'Department'));
  const witnesses: any = input.witnesses && typeof input.witnesses === 'object' ? input.witnesses : {};
  v.add('witnesses.mt', maxLength(witnesses.mt, TEXT_LIMITS.name, 'Name'));
  v.add('witnesses.security', maxLength(witnesses.security, TEXT_LIMITS.name, 'Name'));
  v.add('witnesses.sheq', maxLength(witnesses.sheq, TEXT_LIMITS.name, 'Name'));
  v.add('msdsReference', maxLength(input.msdsReference, STORES_TEXT_LIMITS.documentNumber, 'MSDS reference'));
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

/** Accept, partly accept or reject a received delivery into stock. */
export function validateDeliveryAcceptance(input: { status?: unknown; notes?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add(
    'status',
    required(input.status, 'Choose a decision'),
    oneOf(input.status, DELIVERY_DECISIONS, 'Choose accept, partially accept or reject')
  );
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));
  return v.errors;
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export interface InventoryItemInput {
  itemCode?: unknown;
  code?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  unit?: unknown;
  reorderLevel?: unknown;
  currentQuantity?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  location?: unknown;
}

/** The checks an item gets whether it is added by hand or imported. */
function inventoryFieldErrors(v: FormErrors, row: InventoryItemInput, prefix = ''): void {
  const f = (name: string) => (prefix ? `${prefix}.${name}` : name);
  v.add(f('itemCode'), maxLength(row.itemCode, STORES_TEXT_LIMITS.itemCode, 'Item code'));
  v.add(f('code'), maxLength(row.code, STORES_TEXT_LIMITS.itemCode, 'Item code'));
  v.add(f('name'), maxLength(row.name, STORES_TEXT_LIMITS.itemName, 'Name'));
  v.add(f('description'), maxLength(row.description, TEXT_LIMITS.long, 'Description'));
  v.add(f('unit'), maxLength(row.unit, STORES_TEXT_LIMITS.unit, 'Unit'));
  v.add(f('unitPrice'), money(row.unitPrice, 'Unit price'));
  v.add(f('currentQuantity'), number(row.currentQuantity, { label: 'Quantity', min: 0 }));
  v.add(f('quantity'), number(row.quantity, { label: 'Quantity', min: 0 }));
  v.add(f('reorderLevel'), number(row.reorderLevel, { label: 'Reorder level', min: 0, integer: true }));
  v.add(f('location'), maxLength(row.location, STORES_TEXT_LIMITS.location, 'Bin location'));
}

/** Add an item to inventory by hand, with its opening quantity. */
export function validateInventoryItem(input: InventoryItemInput): FieldErrors {
  const v = new FormErrors();
  v.add('name', required(input.name, 'Enter the item name'));
  v.add(
    'category',
    required(input.category, 'Choose a category'),
    isBlank(input.category) || isValidCategoryCode(text(input.category)) ? '' : 'Choose a category from the list'
  );
  inventoryFieldErrors(v, input);
  return v.errors;
}

/**
 * Import inventory from a spreadsheet. Each row needs a name or an item code;
 * its category is free text, as spreadsheets name categories in their own words.
 */
export function validateInventoryImport(input: { items?: unknown }): FieldErrors {
  const v = new FormErrors();
  const rows = asList(input.items);
  if (rows.length === 0) {
    v.add('items', 'Add at least one row to import');
    return v.errors;
  }
  if (rows.length > INVENTORY_IMPORT_MAX_ROWS) {
    v.add('items', `Import ${INVENTORY_IMPORT_MAX_ROWS} rows or fewer at a time`);
    return v.errors;
  }
  rows.forEach((raw: any, i: number) => {
    const row: InventoryItemInput = raw && typeof raw === 'object' ? raw : {};
    const prefix = `items.${i}`;
    v.add(`${prefix}.name`, isBlank(row.name) && isBlank(row.code) ? 'Enter a name or item code' : '');
    v.add(`${prefix}.category`, maxLength(row.category, TEXT_LIMITS.name, 'Category'));
    inventoryFieldErrors(v, row, prefix);
  });
  return v.errors;
}

/**
 * One site's own reorder level and quantity for an item. Blank clears a level,
 * so the catalogue's applies again; only the fields sent are checked.
 */
export function validateInventoryLevels(input: {
  reorderLevel?: unknown;
  reorderQuantity?: unknown;
  location?: unknown;
}): FieldErrors {
  const v = new FormErrors();
  v.add('reorderLevel', number(input.reorderLevel, { label: 'Reorder level', min: 0, integer: true }));
  v.add('reorderQuantity', number(input.reorderQuantity, { label: 'Reorder quantity', min: 0, integer: true }));
  v.add('location', maxLength(input.location, STORES_TEXT_LIMITS.location, 'Bin location'));
  return v.errors;
}

export interface RestockInput {
  inventoryId?: unknown;
  quantity?: unknown;
  category?: unknown;
  justification?: unknown;
  priority?: unknown;
}

/**
 * Stores asks for its own shelf to be refilled. The screen always names the
 * category; the API may leave it blank when the item's own category maps to
 * one (`categoryFromItem`), and checks that once the item is loaded.
 */
export function validateRestock(input: RestockInput, { categoryFromItem = false }: { categoryFromItem?: boolean } = {}): FieldErrors {
  const v = new FormErrors();
  v.add('inventoryId', required(input.inventoryId, 'Choose the stock item to restock'), objectId(input.inventoryId, 'Choose the stock item to restock'));
  v.add(
    'quantity',
    required(input.quantity, 'Enter the quantity to order'),
    number(input.quantity, { label: 'Quantity', greaterThan: 0, integer: true })
  );
  v.add(
    'category',
    categoryFromItem ? '' : required(input.category, 'Choose a category so procurement can find suppliers'),
    isBlank(input.category) || isValidCategoryCode(text(input.category)) ? '' : 'Choose a category from the list'
  );
  v.add('justification', maxLength(input.justification, TEXT_LIMITS.long, 'Note'));
  v.add('priority', oneOf(input.priority, RESTOCK_PRIORITIES, 'Choose low, medium, high or urgent'));
  return v.errors;
}

/* ------------------------------------------------------------------ */
/* Stock transfers                                                     */
/* ------------------------------------------------------------------ */

export interface StockTransferInput {
  fromSiteId?: unknown;
  toSiteId?: unknown;
  notes?: unknown;
  items?: { itemId?: unknown; item?: unknown; quantity?: unknown; notes?: unknown }[] | unknown;
}

/**
 * Move stock from one site to another. `available` is what the sending site
 * can spare of each item (on hand less what is held for collection), by item
 * id, when known; lines for the same item are added up.
 */
export function validateStockTransfer(
  input: StockTransferInput,
  { available }: { available?: Record<string, number> } = {}
): FieldErrors {
  const v = new FormErrors();
  v.add('fromSiteId', required(input.fromSiteId, 'Choose the site the stock comes from'), objectId(input.fromSiteId, 'Choose the site the stock comes from'));
  v.add(
    'toSiteId',
    required(input.toSiteId, 'Choose the site the stock goes to'),
    objectId(input.toSiteId, 'Choose the site the stock goes to'),
    !isBlank(input.fromSiteId) && text(input.fromSiteId) === text(input.toSiteId) ? 'Choose a different site from the one it comes from' : ''
  );
  v.add('notes', maxLength(input.notes, TEXT_LIMITS.long, 'Notes'));

  const items = asList(input.items);
  if (items.length === 0) v.add('items', 'Add at least one item');

  const totals = new Map<string, { sum: number; lines: number[] }>();
  items.forEach((line: any, i: number) => {
    const l = line && typeof line === 'object' ? line : {};
    const itemId = l.itemId ?? l.item;
    v.add(lineField('items', i, 'itemId'), required(itemId, 'Choose an item'), objectId(itemId, 'Choose an item'));
    v.add(
      lineField('items', i, 'quantity'),
      required(l.quantity, 'Enter a quantity'),
      number(l.quantity, { label: 'Quantity', greaterThan: 0, integer: true })
    );
    v.add(lineField('items', i, 'notes'), maxLength(l.notes, TEXT_LIMITS.short, 'Notes'));
    const n = counted(l.quantity);
    if (!available || isBlank(itemId) || n === null) return;
    const key = text(itemId);
    if (!has(available, key)) return;
    const entry = totals.get(key) || { sum: 0, lines: [] };
    entry.sum += n;
    entry.lines.push(i);
    totals.set(key, entry);
  });
  for (const [key, { sum, lines }] of totals) {
    const spare = Math.max(0, available![key]);
    if (sum > spare + 1e-9) {
      const message = spare > 0 ? `Only ${shown(spare)} available at the sending site` : 'None available at the sending site';
      for (const i of lines) v.add(lineField('items', i, 'quantity'), message);
    }
  }
  return v.errors;
}

/**
 * Ship or receive a transfer. Both take no lines (everything left moves) or
 * lines naming the transfer's own lines; `remaining` is what is left to ship
 * or receive on each, by line id, once the transfer is loaded.
 */
export function validateTransferQuantities(
  input: { items?: unknown },
  { remaining, action = 'ship' }: { remaining?: Record<string, number>; action?: 'ship' | 'receive' } = {}
): FieldErrors {
  const v = new FormErrors();
  movementLineErrors(v, input.items, remaining, {
    integer: true,
    allowZero: true,
    notOnRecord: 'This line is not on the transfer',
    tooMany: (left) =>
      left > 0
        ? `Only ${left} left to ${action}`
        : `Nothing left to ${action} on this line`
  });
  return v.errors;
}

/* ------------------------------------------------------------------ */
/* Store requisitions                                                  */
/* ------------------------------------------------------------------ */

/** Mark a store requisition ready for collection, with an optional note. */
export function validateStoreRequisitionApproval(input: { comments?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('comments', maxLength(input.comments, TEXT_LIMITS.long, 'Note'));
  return v.errors;
}

/** Reject a store requisition: the requester is told why. */
export function validateStoreRequisitionRejection(input: { comments?: unknown }): FieldErrors {
  const v = new FormErrors();
  v.add('comments', reason(input.comments, 'Give a reason for rejecting this requisition'));
  return v.errors;
}

export interface StockIssueInput {
  items?: { itemId?: unknown; quantity?: unknown }[] | unknown;
  collectedBy?: { name?: unknown; idNumber?: unknown; department?: unknown; contactNumber?: unknown } | null;
}

/**
 * Hand over a store requisition. Who collected is optional, but once any of it
 * is given the name is needed, so the issue note says who signed. Lines, when
 * sent, name the requisition's own lines; `remaining` is what is still to hand
 * over on each, by line id, once the requisition is loaded.
 */
export function validateStockIssue(
  input: StockIssueInput,
  { remaining }: { remaining?: Record<string, number> } = {}
): FieldErrors {
  const v = new FormErrors();
  personErrors(v, 'collectedBy', input.collectedBy, 'Enter the name of whoever is collecting', [
    { field: 'idNumber', label: 'ID number', max: STORES_TEXT_LIMITS.idNumber },
    { field: 'department', label: 'Department', max: TEXT_LIMITS.name }
  ]);
  movementLineErrors(v, input.items, remaining, {
    integer: false,
    allowZero: false,
    notOnRecord: 'This line is not on the requisition',
    tooMany: (left) => (left > 0 ? `Only ${left} still to hand over` : 'Nothing left to hand over on this line')
  });
  return v.errors;
}
