import type { Request, Response } from 'express';
import { Sbu } from '../../models/index.js';
import { requireSbu } from '../../tenancy/sbuContext.js';
import { unitsPerUsd } from '../../services/fx.service.js';
import { COO_APPROVAL_THRESHOLD_USD } from '@fossil/shared';

/**
 * This SBU's currency, COO limit and document branding, read-only. Changing
 * them is a group decision made with `npm run sbu:settings` and `npm run fx:set`,
 * so an SBU's own admin cannot move the limit their approvals are held to.
 */
const getSbuSettings = async (_req: Request, res: Response): Promise<any> => {
  try {
    const { code } = requireSbu();
    const sbu = await Sbu.findOne({ code }).lean();
    if (!sbu) {
      return res.status(404).json({ success: false, message: 'Business unit not found' });
    }

    const thresholdUsd = sbu.approvalPolicy?.cooThresholdUsd ?? COO_APPROVAL_THRESHOLD_USD;
    const rate = await unitsPerUsd(sbu.baseCurrency);

    res.json({
      success: true,
      data: {
        code: sbu.code,
        name: sbu.name,
        country: sbu.country,
        baseCurrency: sbu.baseCurrency,
        approvalPolicy: {
          cooThresholdUsd: thresholdUsd,
          fxRateToUsd: rate,
          // null when the base currency has no rate: every PO then goes to the COO.
          cooThresholdLocal: rate == null ? null : Math.round(thresholdUsd * rate * 100) / 100
        },
        branding: {
          legalName: sbu.branding?.legalName || sbu.name,
          address: sbu.branding?.address || null,
          vatNumber: sbu.branding?.vatNumber || null,
          logoUrl: sbu.branding?.logoUrl || null
        }
      }
    });
  } catch (error: any) {
    console.error('Get SBU settings error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export default getSbuSettings;
