import type { Request, Response } from 'express';
import { validateActivationSubmission, validateSupplierDecision, type FieldErrors } from '@fossil/shared';
import { SupplierProfile } from '../../models/index.js';
import { refuseInvalid } from '../../lib/validation.js';
import {
  approveActivationRequest,
  isAwaitingActivation,
  kysGap,
  rejectRegistration,
  reopenRegistration,
  returnActivationRequest,
  submitActivationRequest,
  type ActivationResult
} from '../../services/supplierActivation.service.js';

/**
 * Supplier onboarding decisions: submit for activation (maker), approve or
 * return (checker), and reject or reopen a registration. The rules live in
 * supplierActivation.service; these load the supplier, check the form with
 * its shared validator, and send the service's answer.
 */
function handler(
  label: string,
  run: (supplier: any, req: Request) => Promise<ActivationResult>,
  validate: (body: any, supplier: any) => FieldErrors
) {
  return async (req: Request, res: Response): Promise<any> => {
    try {
      const supplier = await SupplierProfile.findById(req.params.id);
      if (!supplier || supplier.isDeleted) {
        return res.status(404).json({ success: false, message: 'Supplier not found' });
      }
      if (refuseInvalid(res, validate(req.body || {}, supplier))) return;
      const result = await run(supplier, req);
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error(`${label} error:`, error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  };
}

/**
 * An override reason is needed only where the service would ask for one: a
 * pending supplier, not already awaiting approval, whose KYS is short of its tier.
 */
function overrideRequired(supplier: any): boolean {
  return supplier.status === 'pending' && !isAwaitingActivation(supplier) && !kysGap(supplier).completion.isComplete;
}

/** PUT /procurement/suppliers/:id/activation/submit — { notes?, kysOverrideReason? } */
export const submitSupplierActivation = handler(
  'Submit supplier for activation',
  (supplier, req) =>
    submitActivationRequest(supplier, req, {
      notes: req.body?.notes,
      overrideReason: req.body?.kysOverrideReason ?? req.body?.reason
    }),
  (body, supplier) =>
    validateActivationSubmission(
      { notes: body.notes, kysOverrideReason: body.kysOverrideReason ?? body.reason },
      { overrideRequired: overrideRequired(supplier) }
    )
);

/** PUT /procurement/suppliers/:id/activation/approve — { notes? } */
export const approveSupplierActivation = handler(
  'Approve supplier activation',
  (supplier, req) => approveActivationRequest(supplier, req, { notes: req.body?.notes }),
  (body) => validateSupplierDecision('approveActivation', body)
);

/** PUT /procurement/suppliers/:id/activation/return — { reason } */
export const returnSupplierActivation = handler(
  'Return supplier activation',
  (supplier, req) => returnActivationRequest(supplier, req, { reason: req.body?.reason }),
  (body) => validateSupplierDecision('returnActivation', body)
);

/** PUT /procurement/suppliers/:id/registration/reject — { reason } */
export const rejectSupplierRegistration = handler(
  'Reject supplier registration',
  (supplier, req) => rejectRegistration(supplier, req, { reason: req.body?.reason }),
  (body) => validateSupplierDecision('rejectRegistration', body)
);

/** PUT /procurement/suppliers/:id/registration/reopen — { reason } */
export const reopenSupplierRegistration = handler(
  'Reopen supplier registration',
  (supplier, req) => reopenRegistration(supplier, req, { reason: req.body?.reason }),
  (body) => validateSupplierDecision('reopenRegistration', body)
);
