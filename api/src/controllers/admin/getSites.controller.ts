import type { Request, Response } from 'express';
import { Site } from '../../models/index.js';

const getSites = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, type, includeInactive } = req.query as any;
    const query: any = { isDeleted: false };

    if (status) query.status = status;
    if (type) query.type = type;
    if (includeInactive !== 'true') query.status = 'active';

    const sites = await Site.find(query)
      .populate('parentSite', 'code name type')
      .populate('manager', 'firstName lastName email')
      .sort({ type: 1, name: 1 });

    res.status(200).json({ success: true, data: sites });
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getSites;
