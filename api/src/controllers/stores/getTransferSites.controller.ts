import type { Request, Response } from 'express';
import { Site } from '../../models/index.js';

/** Active store locations for stock transfer site pickers. */
const getTransferSites = async (_req: Request, res: Response): Promise<any> => {
  try {
    const sites = await Site.find({
      isDeleted: false,
      status: 'active',
      hasLocalStore: true
    })
      .select('code name type hasLocalStore')
      .sort({ type: 1, name: 1 });

    res.status(200).json({ success: true, data: sites });
  } catch (error) {
    console.error('Get transfer sites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getTransferSites;
