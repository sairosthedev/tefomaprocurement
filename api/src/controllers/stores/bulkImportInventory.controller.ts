import type { Request, Response } from 'express';
import { validateInventoryImport } from '@fossil/shared';
import { createAuditLog } from '../../middleware/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';
import { refuseInvalid } from '../../lib/validation.js';
import { processInventoryRow, type RowResult } from '../../services/inventoryImport.service.js';

/**
 * Bulk import inventory from a parsed spreadsheet.
 * Body: { items: InventoryRowInput[], siteId?: string }
 * Each row upserts a catalog Item + site Inventory and an opening-balance entry.
 * The rows are checked first (at most INVENTORY_IMPORT_MAX_ROWS, each with a
 * name or code and numbers that are numbers); a sheet with a bad row is
 * refused whole, naming each row's fields, so nothing half-imports.
 */
const bulkImportInventory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { items, siteId: bodySiteId } = req.body;

    if (refuseInvalid(res, validateInventoryImport(req.body))) return;

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
