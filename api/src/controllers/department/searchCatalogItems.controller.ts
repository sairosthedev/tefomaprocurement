import type { Request, Response } from 'express';
import { Item, Inventory } from '../../models/index.js';
import { resolveSiteId } from '../../lib/siteScope.js';

/** Search the stock catalog so requisition lines can link to real inventory items. */
const searchCatalogItems = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search = '', limit = 20 } = req.query as Record<string, string>;
    const siteId = await resolveSiteId(req.user);

    const query: any = { isDeleted: false, status: 'active' };
    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { code: regex }, { description: regex }];
    }

    const items = await Item.find(query)
      .select('code name description category unit')
      .sort({ name: 1 })
      .limit(Math.min(parseInt(String(limit), 10) || 20, 50));

    const enriched = await Promise.all(
      items.map(async (item) => {
        const inv = await Inventory.findOne({ item: item._id, site: siteId, isDeleted: false });
        const onHand = inv?.quantityOnHand ?? 0;
        const reserved = inv?.quantityReserved ?? 0;
        const available = Math.max(0, onHand - reserved);
        return {
          _id: item._id,
          code: item.code,
          name: item.name,
          description: item.description,
          category: item.category,
          unit: item.unit,
          quantityAvailable: available
        };
      })
    );

    res.status(200).json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Search catalog items error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default searchCatalogItems;
