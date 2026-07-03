import type { Request, Response } from 'express';
import { PO_CANCEL_BY_ROLE, PO_CANCELLATION_REASONS } from '@fossil/shared';

export const getPurchaseOrderCancellationMeta = async (req: Request, res: Response): Promise<any> => {
  const role = req.user!.role;
  const allowedStatuses = PO_CANCEL_BY_ROLE[role] || [];

  res.status(200).json({
    success: true,
    data: {
      reasons: PO_CANCELLATION_REASONS,
      allowedStatuses
    }
  });
};
