import type { DocumentBranding } from '../services/sbuSettings.service.js';

const MUTED = '#6b7280';
const LOGO_HEIGHT = 44;

/**
 * The issuing SBU's letterhead: name, address and VAT number on the left,
 * logo on the right. Shared by every printed document so a unit's PO, GRV and
 * issue note carry the same identity. Leaves `doc.y` below the block.
 */
export function drawLetterhead(doc: any, branding: DocumentBranding, x: number, y: number, width: number): void {
  let textWidth = width;

  if (branding.logo) {
    try {
      doc.image(branding.logo, x + width - 140, y, { fit: [140, LOGO_HEIGHT], align: 'right' });
      textWidth = width - 150;
    } catch {
      // An unreadable image must not stop the document printing.
    }
  }

  doc.fontSize(16).fillColor('#111827').text(branding.legalName, x, y, { width: textWidth });

  const details = [branding.address, branding.vatNumber ? `VAT No. ${branding.vatNumber}` : '']
    .filter(Boolean)
    .join('   |   ');
  if (details) {
    doc.fontSize(8).fillColor(MUTED).text(details, x, doc.y + 1, { width: textWidth });
  }

  if (branding.logo) doc.y = Math.max(doc.y, y + LOGO_HEIGHT);
}
