import type { Request, Response } from 'express';
import { listPendingAuthorizations } from '../../services/pendingAuthorization.service.js';

/** Awards waiting on the Head of Procurement's authorization. */
const getPendingAuthorizations = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = await listPendingAuthorizations(req.user!._id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get pending authorizations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getPendingAuthorizations;
