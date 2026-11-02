import type { Request, Response } from 'express';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { processInventoryRow, type RowResult } from '../../services/inventoryImport.service.js';

const MAX_ROWS = 2000;

/**
 * Bulk import inventory from a parsed spreadsheet.
 * Body: { items: InventoryRowInput[], siteId?: string }
 * Each row upserts a catalog Item + site Inventory and an opening-balance entry.
 */
const bulkImportInventory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { items, siteId: bodySiteId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to import' });
    }
    if (items.length > MAX_ROWS) {
      return res.status(400).json({ success: false, message: `Too many rows (max ${MAX_ROWS} per import)` });
    }

    const siteId = await resolveSiteId(req.user, bodySiteId);

    const results: RowResult[] = [];
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await processInventoryRow(items[i], siteId, req.user, i + 2); // +2: header row + 1-indexed
        results.push(result);
        if (result.status === 'created') created++;
        else if (result.status === 'updated') updated++;
        else failed++;
      } catch (err: any) {
        failed++;
        results.push({
          row: i + 2,
          name: items[i]?.name || items[i]?.code || `Row ${i + 2}`,
          status: 'failed',
          message: err.message || 'Failed to process row'
        });
      }
    }

    await createAuditLog({
      action: 'create',
      entity: 'Inventory',
      user: req.user,
      description: `Bulk inventory import: ${created} created, ${updated} updated, ${failed} failed`,
      newData: { created, updated, failed, total: items.length },
      req
    });

    res.status(200).json({
      success: true,
      message: `Import complete: ${created} created, ${updated} updated${failed ? `, ${failed} failed` : ''}`,
      summary: { total: items.length, created, updated, failed },
      results
    });
  } catch (error: any) {
    console.error('Bulk import inventory error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default bulkImportInventory;
