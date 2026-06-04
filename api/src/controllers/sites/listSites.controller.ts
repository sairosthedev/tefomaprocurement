import type { Request, Response } from 'express';
import { Site } from '../../models/index.js';
import { canAccessAllSites, userSiteId } from '../../lib/siteScope.js';

const listSites = async (req: Request, res: Response): Promise<any> => {
  try {
    const query: any = { isDeleted: false, status: 'active' };

    if (!canAccessAllSites(req.user)) {
      const home = userSiteId(req.user);
      if (home) {
        query._id = home;
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const sites = await Site.find(query)
      .select('code name type hasLocalStore address parentSite')
      .populate('parentSite', 'code name')
      .sort({ type: 1, name: 1 });

    res.status(200).json({ success: true, data: sites });
  } catch (error) {
    console.error('List sites error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default listSites;
