/**
 * The Stores Issue Note.
 *
 * The counterpart to the GRV: a GRV evidences goods arriving, this evidences
 * goods leaving. Rev 9 lists "Collection Of Materials — Stores/HODs — Daily" as
 * a process step and clause 6.4.4 prohibits "any collection of products done
 * without procurement authorization or an order", so a collection needs a
 * document the collector signs, naming what left and who took it.
 *
 * Layout deliberately follows printGrv so Tefoma's stores paperwork reads as a
 * set rather than as unrelated one-offs.
 */

import PDFDocument from 'pdfkit';

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

/**
 * Draw the issue note onto an existing document.
 *
 * Takes the doc rather than creating one so the HTTP handler can stream
 * straight to the response.
 */
export function buildStoreIssueNotePdf(doc: any, requisition: any): void {
  const pageWidth = doc.page.width - MARGIN * 2;
  const colWidth = (pageWidth - 20) / 2;
  const noteNumber = requisition.issueNoteNumber || 'SIN-DRAFT';

  // ── Header ──
  doc.fontSize(16).fillColor('#111827').text(COMPANY, MARGIN, MARGIN);
  doc.fontSize(18).fillColor(ACCENT).text('STORES ISSUE NOTE', MARGIN, doc.y + 2);
  doc.fontSize(9).fillColor(MUTED).text(`Issue Note No. ${noteNumber}`, MARGIN, doc.y + 2);

  const headerBottom = doc.y + 10;
  doc.moveTo(MARGIN, headerBottom).lineTo(MARGIN + pageWidth, headerBottom)
    .strokeColor(ACCENT).lineWidth(2).stroke();

  // ── Meta panels ──
  doc.y = headerBottom + 12;
  const metaTop = doc.y;

  const leftBottom = metaPanel(doc, MARGIN, colWidth, [
    ['Store Requisition', requisition.requisitionNumber || '—'],
    ['Department', requisition.department?.name || '—'],
    ['Requested By', fullName(requisition.requestedBy) || '—']
  ]);

  doc.y = metaTop;
  const rightBottom = metaPanel(doc, MARGIN + colWidth + 20, colWidth, [
    ['Issued From', requisition.site?.name || '—'],
    ['Date Issued', formatDate(requisition.issuedAt)],
    ['Status', String(requisition.status || '').replace(/_/g, ' ').toUpperCase()]
  ]);

  doc.y = Math.max(leftBottom, rightBottom) + 6;

  if (requisition.purpose) {
    doc.fontSize(8).fillColor(MUTED).text('PURPOSE', MARGIN, doc.y);
    doc.fontSize(10).fillColor('#111827').text(requisition.purpose, MARGIN, doc.y, { width: pageWidth });
    doc.y += 6;
  }

  // ── Items table ──
  doc.fontSize(10).fillColor(ACCENT).text('ITEMS ISSUED', MARGIN, doc.y);
  doc.y += 4;

  const cols = [
    { label: '#', width: 24 },
    { label: 'Item', width: pageWidth - 24 - 70 - 70 - 70 },
    { label: 'Requested', width: 70 },
    { label: 'Issued', width: 70 },
    { label: 'Outstanding', width: 70 }
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

  (requisition.items || []).forEach((line: any, index: number) => {
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
      doc.y = MARGIN;
      drawTableHeader();
    }

    const requested = line.quantityRequested ?? 0;
    const issued = line.quantityIssued ?? 0;
    const unit = line.item?.unit ? ` ${line.item.unit}` : '';
    const rowY = doc.y;

    const values = [
      String(index + 1),
      line.item?.name || line.item?.description || line.item?.itemCode || '—',
      `${requested}${unit}`,
      `${issued}${unit}`,
      // Outstanding matters on a partial issue: the collector is signing for
      // what they actually received, not for what was asked.
      `${Math.max(requested - issued, 0)}${unit}`
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

    if (line.notes) {
      doc.fontSize(8).fillColor(MUTED).text(line.notes, MARGIN + 28, doc.y + 3, { width: pageWidth - 32 });
      doc.y += 3;
    }
  });

  // ── Notes ──
  if (requisition.notes) {
    doc.y += 10;
    doc.fontSize(9).fillColor(ACCENT).text('NOTES', MARGIN, doc.y);
    doc.fontSize(9).fillColor('#111827').text(requisition.notes, MARGIN, doc.y + 2, { width: pageWidth });
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
  const signWidth = (pageWidth - 30) / 3;
  const ruleY = signY + 110;

  signatureBlock(doc, MARGIN, signY, signWidth, 'Issued by', [
    ['Name', fullName(requisition.issuedBy)],
    ['Designation', formatRole(requisition.issuedBy?.role)],
    ['Date', formatDateTime(requisition.issuedAt)]
  ], ruleY);

  // Blank when nobody was recorded, so the note is signed by hand rather than
  // naming a collector the system never captured.
  signatureBlock(doc, MARGIN + signWidth + 15, signY, signWidth, 'Collected by', [
    ['Name', requisition.collectedBy?.name || ''],
    ['ID / Employee No.', requisition.collectedBy?.idNumber || ''],
    ['Department', requisition.collectedBy?.department || requisition.department?.name || '']
  ], ruleY);

  signatureBlock(doc, MARGIN + (signWidth + 15) * 2, signY, signWidth, 'Authorized by', [
    ['Name', fullName(requisition.approvedBy)],
    ['Designation', formatRole(requisition.approvedBy?.role)],
    ['Date', formatDateTime(requisition.approvedAt)]
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
      `${COMPANY} — Issue Note ${noteNumber}   |   Page ${i + 1} of ${totalPages}   |   Generated ${generatedAt}`,
      MARGIN,
      doc.page.height - 32,
      { width: pageWidth, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = bottomMargin;
  }
}

/** Render the issue note to a buffer, for attaching or storing. */
export function renderStoreIssueNotePdfBuffer(requisition: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      buildStoreIssueNotePdf(doc, requisition);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
