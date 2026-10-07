import { Router, type Request, type Response } from 'express';
import Sbu, { type ISbu } from '../models/Sbu.model.js';

/**
 * The list of business units a person can sign in to.
 *
 * Mounted ahead of the SBU context middleware, because it is what the login
 * page calls *before* an SBU has been chosen — there is no context to resolve
 * yet. It returns only what a login screen needs: nothing about databases,
 * domains or configuration.
 */
const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const sbus = await Sbu.find({ status: { $ne: 'suspended' } })
    .select('code name country')
    .sort({ name: 1 })
    .lean<Array<Pick<ISbu, 'code' | 'name' | 'country'>>>();

  res.json({
    success: true,
    data: sbus.map((sbu) => ({ code: sbu.code, name: sbu.name, country: sbu.country }))
  });
});

export default router;
