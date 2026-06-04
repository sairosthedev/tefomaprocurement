import type { Request, Response } from 'express';
import { Site } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const createSite = async (req: Request, res: Response): Promise<any> => {
  try {
    const { code, name, type, parentSite, address, manager, hasLocalStore, status } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Site code and name are required'
      });
    }

    const existing = await Site.findOne({ code: code.toUpperCase(), isDeleted: false });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Site code already exists'
      });
    }

    const site = await Site.create({
      code: code.toUpperCase(),
      name,
      type: type || 'site',
      parentSite: parentSite || null,
      address,
      manager: manager || null,
      hasLocalStore: hasLocalStore !== false,
      status: status || 'active'
    });

    await createAuditLog({
      action: 'create',
      entity: 'Site',
      entityId: site._id,
      user: req.user,
      description: `Created site ${site.code}`,
      newData: { code: site.code, name: site.name, type: site.type },
      req
    });

    res.status(201).json({ success: true, data: site });
  } catch (error: any) {
    console.error('Create site error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default createSite;
