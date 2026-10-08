import { Router, type Request, type Response } from 'express';
import Sbu, { type ISbu } from '../models/Sbu.model.js';
import { sbuByDomain } from '../tenancy/registry.js';

/**
 * What the login page needs before anyone has signed in.
 *
 * Mounted ahead of the SBU context middleware, because it is read *before* an
 * SBU has been chosen — there is no context to resolve yet. It returns only
 * what a login screen needs: nothing about databases or configuration.
 *
 * `current` is the SBU this hostname belongs to. Once each SBU answers on its
 * own domain that is always set, and the login page shows no chooser at all —
 * the address someone typed has already said which business unit they want.
 * It is null only while SBUs still share one address, and then the page falls
 * back to asking.
 */
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const current = (await sbuByDomain(req.headers.origin)) || (await sbuByDomain(req.headers.host));

  const sbus = await Sbu.find({ status: { $ne: 'suspended' } })
    .select('code name country')
    .sort({ name: 1 })
    .lean<Array<Pick<ISbu, 'code' | 'name' | 'country'>>>();

  res.json({
    success: true,
    current: current ? { code: current.code, name: current.name } : null,
    data: sbus.map((sbu) => ({ code: sbu.code, name: sbu.name, country: sbu.country }))
  });
});

export default router;
