import type { Request, Response } from 'express';
import { PO_CANCELLATION_REASONS, poCancelStatusesFor } from '@fossil/shared';

export const getPurchaseOrderCancellationMeta = async (req: Request, res: Response): Promise<any> => {
  const allowedStatuses = poCancelStatusesFor(req.user);

  res.status(200).json({
    success: true,
    data: {
      reasons: PO_CANCELLATION_REASONS,
      allowedStatuses
    }
  });
};
