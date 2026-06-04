import type { Request, Response } from 'express';

import { StockTransfer } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { userSiteId, canAccessAllSites } from '../../lib/siteScope.js';

const approveStockTransfer = async (req: Request, res: Response): Promise<any> => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    if (!transfer || transfer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending transfers can be approved'
      });
    }

    if (!canAccessAllSites(req.user)) {
      const home = userSiteId(req.user);
      if (home !== transfer.fromSite.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only the sending site can approve this transfer'
        });
      }
    }

    transfer.status = 'approved';
    transfer.approvedBy = req.user!._id;
    transfer.approvedAt = new Date();
    await transfer.save();

    await createAuditLog({
      action: 'update',
      entity: 'StockTransfer',
      entityId: transfer._id,
      user: req.user,
      description: `Approved transfer ${transfer.transferNumber}`,
      req
    });

    res.status(200).json({ success: true, data: transfer });
  } catch (error: any) {
    console.error('Approve stock transfer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default approveStockTransfer;
