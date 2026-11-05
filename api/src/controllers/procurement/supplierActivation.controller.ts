import type { Request, Response } from 'express';
import { SupplierProfile } from '../../models/index.js';
import {
  approveActivationRequest,
  rejectRegistration,
  reopenRegistration,
  returnActivationRequest,
  submitActivationRequest,
  type ActivationResult
} from '../../services/supplierActivation.service.js';

/**
 * Supplier onboarding decisions: submit for activation (maker), approve or
 * return (checker), and reject or reopen a registration. The rules live in
 * supplierActivation.service; these load the supplier and send its answer.
 */
function handler(label: string, run: (supplier: any, req: Request) => Promise<ActivationResult>) {
  return async (req: Request, res: Response): Promise<any> => {
    try {
      const supplier = await SupplierProfile.findById(req.params.id);
      if (!supplier || supplier.isDeleted) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
      }
      const result = await run(supplier, req);
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error(`${label} error:`, error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  };
}

/** PUT /procurement/suppliers/:id/activation/submit — { notes?, kysOverrideReason? } */
export const submitSupplierActivation = handler('Submit supplier for activation', (supplier, req) =>
  submitActivationRequest(supplier, req, {
    notes: req.body?.notes,
    overrideReason: req.body?.kysOverrideReason ?? req.body?.reason
  })
);

/** PUT /procurement/suppliers/:id/activation/approve — { notes? } */
export const approveSupplierActivation = handler('Approve supplier activation', (supplier, req) =>
  approveActivationRequest(supplier, req, { notes: req.body?.notes })
);

/** PUT /procurement/suppliers/:id/activation/return — { reason } */
export const returnSupplierActivation = handler('Return supplier activation', (supplier, req) =>
  returnActivationRequest(supplier, req, { reason: req.body?.reason })
);

/** PUT /procurement/suppliers/:id/registration/reject — { reason } */
export const rejectSupplierRegistration = handler('Reject supplier registration', (supplier, req) =>
  rejectRegistration(supplier, req, { reason: req.body?.reason })
);

/** PUT /procurement/suppliers/:id/registration/reopen — { reason } */
export const reopenSupplierRegistration = handler('Reopen supplier registration', (supplier, req) =>
  reopenRegistration(supplier, req, { reason: req.body?.reason })
);
