const { StockTransfer, Site } = require('../../models');
const { createAuditLog } = require('../../middleware');
const { resolveSiteId, canAccessAllSites } = require('../../lib/siteScope');

const createStockTransfer = async (req, res) => {
  try {
    const { fromSiteId, toSiteId, items, notes } = req.body;

    if (!fromSiteId || !toSiteId || !items?.length) {
      return res.status(400).json({
        success: false,
        message: 'fromSiteId, toSiteId, and items are required'
      });
    }

    if (fromSiteId.toString() === toSiteId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination sites must differ'
      });
    }

    const [fromSite, toSite] = await Promise.all([
      Site.findOne({ _id: fromSiteId, isDeleted: false, status: 'active' }),
      Site.findOne({ _id: toSiteId, isDeleted: false, status: 'active' })
    ]);

    if (!fromSite || !toSite) {
      return res.status(404).json({ success: false, message: 'Site not found' });
    }

    if (!canAccessAllSites(req.user)) {
      const userSite = await resolveSiteId(req.user);
      const allowed =
        userSite.toString() === toSiteId.toString() ||
        userSite.toString() === fromSiteId.toString();
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You can only create transfers involving your home site'
        });
      }
    }

    const transferItems = items.map((row) => ({
      item: row.itemId || row.item,
      quantityRequested: parseInt(row.quantity, 10),
      notes: row.notes
    }));

    const transfer = await StockTransfer.create({
      fromSite: fromSiteId,
      toSite: toSiteId,
      items: transferItems,
      initiatedBy: req.user._id,
      status: 'pending',
      notes
    });

    await createAuditLog({
      action: 'create',
      entity: 'StockTransfer',
      entityId: transfer._id,
      user: req.user,
      description: `Created stock transfer ${transfer.transferNumber}`,
      req
    });

    const populated = await StockTransfer.findById(transfer._id)
      .populate('fromSite', 'code name')
      .populate('toSite', 'code name')
      .populate('items.item', 'code name unit');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Create stock transfer error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = createStockTransfer;
