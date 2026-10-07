/**
 * The purchase order document.
 *
 * Rev 9 clause 6.3.14: "The procurement officer sends the purchase order to the
 * supplier via email." That means the supplier needs a formal document, not a
 * portal notification — so the same rendering is used for both the on-screen
 * print and the emailed attachment, and a supplier can never receive a PDF that
 * differs from what procurement reviewed.
 *
 * Layout follows the GRV (printGrv.controller.ts) so the business's documents look
 * like a set rather than a collection of one-offs.
 */

import PDFDocument from 'pdfkit';
import { getCompanyName } from '../lib/branding.js';

const COMPANY = getCompanyName();
const MARGIN = 45;
const ACCENT = '#b45309';
const MUTED = '#6b7280';
const LINE = '#d1d5db';

const fullName = (user: any): string =>
  user && (user.firstName || user.lastName)
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : '';

const formatRole = (role?: string): string =>
  role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

const formatDate = (value?: Date | string | null): string =>
  value ? new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const formatDateTime = (value?: Date | string | null): string =>
  value
    ? `${formatDate(value)} ${new Date(value).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
    : '';

/** Money, rendered with thousands separators and two decimals. */
const money = (value?: number | null): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

/** Two-column key/value block used for the header meta panels. */
function metaPanel(doc: any, x: number, width: number, rows: Array<[string, string]>): number {
  const startY = doc.y;
  let y = startY;
  rows.forEach(([label, value]) => {
    doc.fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y, { width });
    y = doc.y;
    doc.fontSize(10).fillColor('#111827').text(value || '—', x, y, { width });
    y = doc.y + 6;
  });
  return y;
}

/** Signature block with a ruled line for a wet signature. */
function signatureBlock(
  doc: any,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: Array<[string, string]>,
  ruleY: number
): number {
  doc.fontSize(9).fillColor(ACCENT).text(title.toUpperCase(), x, y, { width });
  let cursor = doc.y + 4;

  rows.forEach(([label, value]) => {
    doc.fontSize(8).fillColor(MUTED).text(label, x, cursor, { width });
    cursor = doc.y;
    doc.fontSize(9.5).fillColor('#111827').text(value || '—', x, cursor, { width });
    cursor = doc.y + 3;
  });

  const lineY = Math.max(ruleY, cursor + 16);
  doc.moveTo(x, lineY).lineTo(x + width, lineY).strokeColor(LINE).lineWidth(0.8).stroke();
  doc.fontSize(7.5).fillColor(MUTED).text('Signature / Date', x, lineY + 3, { width });

  return doc.y;
}

/** A supplier address, flattened to one line. */
function addressLine(address: any): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.street, address.suburb, address.city, address.country]
    .filter(Boolean)
    .join(', ');
}

/**
 * Draw the whole purchase order onto an existing document.
 *
 * Takes the doc rather than creating one so the HTTP handler can stream
 * straight to the response while the mailer renders to a buffer.
 */
export function buildPurchaseOrderPdf(doc: any, po: any): void {
  const pageWidth = doc.page.width - MARGIN * 2;
  const colWidth = (pageWidth - 20) / 2;
  const supplier = po.supplier || {};
  const currency = po.currency || 'USD';

  // ── Header ──
  doc.fontSize(16).fillColor('#111827').text(COMPANY, MARGIN, MARGIN);
  doc.fontSize(18).fillColor(ACCENT).text('PURCHASE ORDER', MARGIN, doc.y + 2);
  doc.fontSize(9).fillColor(MUTED).text(`PO No. ${po.poNumber || '—'}`, MARGIN, doc.y + 2);

  const headerBottom = doc.y + 10;
  doc.moveTo(MARGIN, headerBottom).lineTo(MARGIN + pageWidth, headerBottom)
    .strokeColor(ACCENT).lineWidth(2).stroke();

  // ── Meta panels ──
  doc.y = headerBottom + 12;
  const metaTop = doc.y;

  const leftBottom = metaPanel(doc, MARGIN, colWidth, [
    ['Supplier', supplier.companyName || '—'],
    ['Contact', supplier.email || supplier.contactPersons?.[0]?.email || '—'],
    ['Address', addressLine(supplier.address) || '—']
  ]);

  doc.y = metaTop;
  const rightBottom = metaPanel(doc, MARGIN + colWidth + 20, colWidth, [
    ['Order Date', formatDate(po.orderDate || po.issuedAt || po.createdAt)],
    ['Required By', formatDate(po.expectedDeliveryDate || po.requiredDate)],
    ['Status', String(po.status || '').replace(/_/g, ' ').toUpperCase()]
  ]);

  doc.y = Math.max(leftBottom, rightBottom) + 6;

  // Deliver-to, so the supplier knows where the goods go.
  // The PO model's path is deliverToSite; `site` would silently be undefined
  // and drop the deliver-to line from the document.
  const deliverTo = addressLine(po.deliveryAddress) || po.deliverToSite?.name || '';
  if (deliverTo) {
    doc.fontSize(8).fillColor(MUTED).text('DELIVER TO', MARGIN, doc.y);
    doc.fontSize(10).fillColor('#111827').text(deliverTo, MARGIN, doc.y, { width: pageWidth });
    doc.y += 6;
  }

  // ── Items table ──
  doc.fontSize(10).fillColor(ACCENT).text('ORDERED ITEMS', MARGIN, doc.y);
  doc.y += 4;

  const cols = [
    { label: '#', width: 24 },
    { label: 'Description', width: pageWidth - 24 - 55 - 80 - 85 },
    { label: 'Qty', width: 55 },
    { label: 'Unit Price', width: 80 },
    { label: 'Total', width: 85 }
  ];

  const drawTableHeader = (): void => {
    const y = doc.y;
    doc.rect(MARGIN, y, pageWidth, 18).fillColor('#fef3c7').fill();
    let x = MARGIN;
    cols.forEach((col) => {
      doc.fontSize(8).fillColor('#78350f').text(col.label.toUpperCase(), x + 4, y + 5, {
        width: col.width - 8
      });
      x += col.width;
    });
    doc.y = y + 18;
  };

  drawTableHeader();

  (po.items || []).forEach((item: any, index: number) => {
    // Page break with repeated header.
    if (doc.y > doc.page.height - 220) {
      doc.addPage();
      doc.y = MARGIN;
      drawTableHeader();
    }

    const unit = item.unit ? ` ${item.unit}` : '';
    const rowY = doc.y;

    const values = [
      String(index + 1),
      item.description || '—',
      `${item.quantity ?? 0}${unit}`,
      money(item.unitPrice),
      money(item.totalPrice)
    ];

    let x = MARGIN;
    let maxY = rowY;
    cols.forEach((col, i) => {
      doc.fontSize(9).fillColor('#111827').text(values[i], x + 4, rowY + 5, { width: col.width - 8 });
      maxY = Math.max(maxY, doc.y);
      x += col.width;
    });

    const rowBottom = maxY + 5;
    doc.moveTo(MARGIN, rowBottom).lineTo(MARGIN + pageWidth, rowBottom)
      .strokeColor(LINE).lineWidth(0.5).stroke();
    doc.y = rowBottom;

    if (item.specifications) {
      doc.fontSize(8).fillColor(MUTED)
        .text(item.specifications, MARGIN + 28, doc.y + 3, { width: pageWidth - 32 });
      doc.y += 3;
    }
  });

  // ── Totals ──
  doc.y += 8;
  const totalsWidth = 200;
  const totalsX = MARGIN + pageWidth - totalsWidth;
  const totalRow = (label: string, value: string, bold = false): void => {
    const y = doc.y;
    doc.fontSize(bold ? 10 : 9).fillColor(bold ? '#111827' : MUTED)
      .text(label, totalsX, y, { width: totalsWidth - 90 });
    doc.fontSize(bold ? 11 : 9).fillColor('#111827')
      .text(`${currency} ${value}`, totalsX + totalsWidth - 90, y, { width: 90, align: 'right' });
    doc.y = Math.max(doc.y, y + (bold ? 15 : 13));
  };

  totalRow('Subtotal', money(po.subtotal));
  if (po.vatAmount) totalRow('VAT', money(po.vatAmount));
  doc.moveTo(totalsX, doc.y + 2).lineTo(MARGIN + pageWidth, doc.y + 2)
    .strokeColor(LINE).lineWidth(0.8).stroke();
  doc.y += 6;
  totalRow('Total', money(po.totalAmount), true);

  // ── Terms ──
  if (po.paymentTerms || po.notes) {
    doc.y += 10;
    if (po.paymentTerms) {
      doc.fontSize(9).fillColor(ACCENT).text('PAYMENT TERMS', MARGIN, doc.y);
      doc.fontSize(9).fillColor('#111827').text(po.paymentTerms, MARGIN, doc.y + 2, { width: pageWidth });
    }
    if (po.notes) {
      doc.y += 6;
      doc.fontSize(9).fillColor(ACCENT).text('NOTES', MARGIN, doc.y);
      doc.fontSize(9).fillColor('#111827').text(po.notes, MARGIN, doc.y + 2, { width: pageWidth });
    }
  }

  // ── Signatories ──
  const SIGN_BLOCK_HEIGHT = 150;
  if (doc.y > doc.page.height - SIGN_BLOCK_HEIGHT - MARGIN) {
    doc.addPage();
    doc.y = MARGIN;
  } else {
    doc.y += 20;
  }

  const signTop = doc.y;
  doc.moveTo(MARGIN, signTop).lineTo(MARGIN + pageWidth, signTop)
    .strokeColor(LINE).lineWidth(1).stroke();

  const signY = signTop + 12;
  const signWidth = (pageWidth - 15) / 2;
  const ruleY = signY + 96;

  signatureBlock(doc, MARGIN, signY, signWidth, 'Issued by', [
    ['Name', fullName(po.createdBy)],
    ['Designation', formatRole(po.createdBy?.role)],
    ['Date', formatDateTime(po.issuedAt || po.orderDate || po.createdAt)]
  ], ruleY);

  signatureBlock(doc, MARGIN + signWidth + 15, signY, signWidth, 'Acknowledged by supplier', [
    ['Name', ''],
    ['Designation', ''],
    ['Date', '']
  ], ruleY);

  // ── Footer on every page ──
  // Capture the count first — the loop must not observe pages it adds itself.
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  const generatedAt = formatDateTime(new Date());

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(range.start + i);
    // Text drawn below the bottom margin makes pdfkit append a blank page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(7.5).fillColor(MUTED).text(
      `${COMPANY} — PO ${po.poNumber}   |   Page ${i + 1} of ${totalPages}   |   Generated ${generatedAt}`,
      MARGIN,
      doc.page.height - 32,
      { width: pageWidth, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = bottomMargin;
  }
}

/**
 * Send the approved purchase order to the supplier (Rev 9 clause 6.3.14).
 *
 * Called from the approval controllers rather than from PO creation: a PO is
 * created as a draft and only becomes an order the supplier may act on once the
 * last required approval lands. Sending at creation would put an unapproved
 * order in a supplier's inbox, and Finance or the COO could still reject it.
 *
 * There are two terminal approval paths — Finance for orders below the COO
 * threshold, and the COO above it — so this lives here and both call it.
 *
 * Never throws. A mail failure must not roll back an approval that has
 * legitimately happened, so the outcome is written to the audit log either way
 * and the caller carries on.
 */
export async function emailApprovedPurchaseOrderToSupplier(
  purchaseOrderId: unknown,
  actor: any,
  req?: unknown
): Promise<void> {
  // Imported here rather than at module scope: the document service is pulled
  // in by the PDF route, and a top-level import of the mailer would drag the
  // Resend client into that path for no reason.
  const [{ PurchaseOrder }, { createAuditLog }, { sendPurchaseOrderEmail }] = await Promise.all([
    import('../models/index.js'),
    import('../middleware/index.js'),
    import('./email.service.js')
  ]);

  try {
    const po: any = await PurchaseOrder.findById(purchaseOrderId as any)
      .populate('supplier', 'companyName email phone address contactPersons')
      .populate('createdBy', 'firstName lastName role')
      .populate('deliverToSite', 'name code address');

    if (!po) return;

    const supplierEmail =
      po.supplier?.email ||
      po.supplier?.contactPersons?.find((c: any) => c.isPrimary)?.email ||
      po.supplier?.contactPersons?.[0]?.email ||
      null;

    const pdf = await renderPurchaseOrderPdfBuffer(po);
    const sent = await sendPurchaseOrderEmail(po, pdf, supplierEmail);

    await createAuditLog({
      action: 'update',
      entity: 'PurchaseOrder',
      entityId: po._id,
      user: actor,
      entityLabel: po.poNumber,
      description: sent
        ? `Emailed purchase order ${po.poNumber} to ${supplierEmail}`
        : `Could not email purchase order ${po.poNumber} to the supplier`,
      req
    } as any);
  } catch (error) {
    console.error(`Failed to email PO ${String(purchaseOrderId)} to supplier:`, error);
  }
}

/**
 * Render the purchase order to a buffer, for attaching to an email.
 *
 * Resolves only once pdfkit has flushed every page, so the attachment is never
 * a truncated file.
 */
export function renderPurchaseOrderPdfBuffer(po: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      buildPurchaseOrderPdf(doc, po);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
