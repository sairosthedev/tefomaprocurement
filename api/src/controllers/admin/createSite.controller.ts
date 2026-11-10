import type { Request, Response } from 'express';
import { Site } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';
import { validateSite } from '@fossil/shared';
import { refuseInvalid } from '../../lib/validation.js';

const createSite = async (req: Request, res: Response): Promise<any> => {
  try {
    const { code, name, type, parentSite, address, manager, hasLocalStore, status } = req.body;

    if (refuseInvalid(res, validateSite(req.body, { isNew: true }))) return;

    const existing = await Site.findOne({ code: String(code).trim().toUpperCase(), isDeleted: false });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Site code already exists',
        errors: { code: `${String(code).trim().toUpperCase()} is already used by ${existing.name}` }
      });
    }

    const site = await Site.create({
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
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
