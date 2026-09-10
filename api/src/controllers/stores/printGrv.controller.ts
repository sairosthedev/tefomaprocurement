import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';

import { Delivery } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const COMPANY = process.env.COMPANY_NAME || 'Tefoma Construction';
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
/**
 * Signature block with a ruled line for a wet signature.
 * `ruleY` pins the rule to a shared baseline so all three blocks line up
 * regardless of how many detail rows each one carries.
 */
function signatureBlock(
  doc: any,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: Array<[string, string]>,
  ruleY: number
) {
  doc.fontSize(9).fillColor(ACCENT).text(title.toUpperCase(), x, y, { width });
  let cursor = doc.y + 4;

  rows.forEach(([label, value]) => {
    doc.fontSize(8).fillColor(MUTED).text(label, x, cursor, { width, continued: false });
    cursor = doc.y;
    doc.fontSize(9.5).fillColor('#111827').text(value || '—', x, cursor, { width });
    cursor = doc.y + 3;
  });

  const lineY = Math.max(ruleY, cursor + 16);
  doc.moveTo(x, lineY).lineTo(x + width, lineY).strokeColor(LINE).lineWidth(0.8).stroke();
  doc.fontSize(7.5).fillColor(MUTED).text('Signature / Date', x, lineY + 3, { width });

  return doc.y;
}

const printGrv = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const delivery: any = await Delivery.findById(id)
      .populate({ path: 'purchaseOrder', select: 'poNumber currency items orderDate' })
      .populate('supplier', 'companyName email phone address')
      .populate('receivedBy', 'firstName lastName role')
      .populate('inspectedBy', 'firstName lastName role')
      .populate('receivedAtSite', 'name code');

    if (!delivery || delivery.isDeleted) {
      return res.status(404).json({ success: false, message: 'Delivery not found' });
    }

    if (delivery.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'GRV has not been raised yet. Receive the goods before printing.'
      });
    }

    const po = delivery.purchaseOrder;
    const grvNumber = delivery.grvNumber || 'GRV-DRAFT';

    await createAuditLog({
      action: 'view',
      entity: 'Delivery',
      entityId: delivery._id,
      user: req.user,
      description: `Printed GRV ${grvNumber}`,
      req
    });

    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${grvNumber}.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width - MARGIN * 2;
    const colWidth = (pageWidth - 20) / 2;

    // ── Header ──
    doc.fontSize(16).fillColor('#111827').text(COMPANY, MARGIN, MARGIN);
    doc.fontSize(18).fillColor(ACCENT).text('GOODS RECEIVED VOUCHER', MARGIN, doc.y + 2);
    doc.fontSize(9).fillColor(MUTED).text(`GRV No. ${grvNumber}`, MARGIN, doc.y + 2);

    const headerBottom = doc.y + 10;
    doc.moveTo(MARGIN, headerBottom).lineTo(MARGIN + pageWidth, headerBottom)
      .strokeColor(ACCENT).lineWidth(2).stroke();

    // ── Meta panels ──
    doc.y = headerBottom + 12;
    const metaTop = doc.y;

    const leftBottom = metaPanel(doc, MARGIN, colWidth, [
      ['Purchase Order', po?.poNumber || '—'],
      ['Supplier', delivery.supplier?.companyName || '—'],
      ['Supplier Delivery Note', delivery.deliveryNoteNumber || '—']
    ]);

    doc.y = metaTop;
    const rightBottom = metaPanel(doc, MARGIN + colWidth + 20, colWidth, [
      ['Delivery Date', formatDate(delivery.deliveryDate)],
      ['Received At Site', delivery.receivedAtSite?.name || '—'],
      ['Status', String(delivery.status || '').replace(/_/g, ' ').toUpperCase()]
    ]);

    doc.y = Math.max(leftBottom, rightBottom) + 6;

    // ── Items table ──
    doc.fontSize(10).fillColor(ACCENT).text('ITEMS RECEIVED', MARGIN, doc.y);
    doc.y += 4;

    const cols = [
      { label: '#', width: 24 },
      { label: 'Description', width: pageWidth - 24 - 60 - 60 - 60 - 70 },
      { label: 'Ordered', width: 60 },
      { label: 'Received', width: 60 },
      { label: 'Rejected', width: 60 },
      { label: 'Condition', width: 70 }
    ];

    const drawTableHeader = () => {
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

    (delivery.items || []).forEach((item: any, index: number) => {
      // Page break with repeated header
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
        doc.y = MARGIN;
        drawTableHeader();
      }

      const poItem = po?.items?.id ? po.items.id(item.poItem) : null;
      const unit = poItem?.unit ? ` ${poItem.unit}` : '';
      const ordered = item.quantityOrdered ?? poItem?.quantity ?? '—';
      const rowY = doc.y;

      const values = [
        String(index + 1),
        item.description || poItem?.description || '—',
        ordered === '—' ? '—' : `${ordered}${unit}`,
        `${item.quantityReceived ?? 0}${unit}`,
        `${item.quantityRejected ?? 0}${unit}`,
        String(item.condition || 'good').replace(/\b\w/g, (c: string) => c.toUpperCase())
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

      if (item.rejectionReason) {
        doc.fontSize(8).fillColor('#b91c1c')
          .text(`Rejection reason: ${item.rejectionReason}`, MARGIN + 28, doc.y + 3, { width: pageWidth - 32 });
        doc.y += 3;
      }
    });

    // ── Notes ──
    if (delivery.notes) {
      doc.y += 10;
      doc.fontSize(9).fillColor(ACCENT).text('INSPECTION NOTES', MARGIN, doc.y);
      doc.fontSize(9).fillColor('#111827').text(delivery.notes, MARGIN, doc.y + 2, { width: pageWidth });
    }

    // ── Signatories ──
    // Keep the three signature blocks together on one page.
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
    const signWidth = (pageWidth - 30) / 3;
    // Shared baseline for all three signature rules, set below the tallest
    // block (Delivered by, which carries four detail rows).
    const ruleY = signY + 136;

    signatureBlock(doc, MARGIN, signY, signWidth, 'Delivered by', [
      ['Name', delivery.deliveredBy?.name || ''],
      ['ID / Company', delivery.deliveredBy?.idNumber || delivery.deliveredBy?.company || ''],
      ['Vehicle Reg.', delivery.deliveredBy?.vehicleRegistration || ''],
      ['Contact', delivery.deliveredBy?.contactNumber || '']
    ], ruleY);

    signatureBlock(doc, MARGIN + signWidth + 15, signY, signWidth, 'Received by', [
      ['Name', fullName(delivery.receivedBy)],
      ['Designation', formatRole(delivery.receivedBy?.role)],
      ['Date', formatDateTime(delivery.receivedAt || delivery.deliveryDate)]
    ], ruleY);

    // Rev 9 clause 6.6.2 assigns the quality check to a department
    // representative, who is usually not a system user — so a recorded name
    // takes precedence over the accepting user. When neither exists the block
    // prints blank to be signed by hand, rather than naming someone who did not
    // inspect the goods.
    signatureBlock(doc, MARGIN + (signWidth + 15) * 2, signY, signWidth, 'Inspected by', [
      ['Name', delivery.inspectedByName || fullName(delivery.inspectedBy)],
      [
        'Designation',
        delivery.inspectedByName
          ? delivery.inspectedByDepartment || 'Department representative'
          : formatRole(delivery.inspectedBy?.role)
      ],
      ['Date', formatDateTime(delivery.inspectedAt || delivery.receivedAt)]
    ], ruleY);

    // ── Footer on every page ──
    // Capture the count first — the loop must not observe pages it adds itself.
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    const generatedAt = formatDateTime(new Date());

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      // Text drawn below the bottom margin makes pdfkit append a blank page.
      // Drop the margin for the write, then restore it.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(7.5).fillColor(MUTED).text(
        `${COMPANY} — GRV ${grvNumber}   |   Page ${i + 1} of ${totalPages}   |   Generated ${generatedAt}`,
        MARGIN,
        doc.page.height - 32,
        { width: pageWidth, align: 'center', lineBreak: false }
      );
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  } catch (error: any) {
    console.error('Print GRV error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Server error' });
    } else {
      res.end();
    }
  }
};

export default printGrv;
