import { SupplierProfile } from '../models/index.js';

/**
 * Is a supplier eligible to transact right now?
 *
 * Supplier status was previously checked only at RFQ creation, so a supplier
 * blacklisted or suspended afterwards could still be published to, have their
 * quotation accepted, and be issued a purchase order. This is the single gate
 * the whole sourcing chain calls, re-checked at each step that commits the
 * company to a supplier.
 *
 * The bar rises with the stage. Invitation is deliberately the widest gate: a
 * `pending` supplier may be invited to quote, because asking for a price
 * commits nothing and narrow sourcing is how you end up with one bid. Award
 * and purchase-order both require an `active`, spend-authorized supplier with
 * KYS complete (or explicitly exempt).
 *
 * KYS and transactability are checked directly rather than trusting status as
 * a proxy: activation normally requires `kysComplete || kysExempt`, but
 * `secApproveEvaluation` could once flip a supplier to active without it.
 */

export type EligibilityStage = 'invite' | 'award' | 'order';

export interface EligibilityResult {
  eligible: boolean;
  /** Human-readable reason, suitable for an API error message. */
  reason?: string;
  supplier?: any;
}

const STATUS_REASON: Record<string, string> = {
  pending: 'is still pending KYS verification',
  suspended: 'is suspended',
  blacklisted: 'is blacklisted',
  dormant: 'is marked dormant'
};

const STAGE_VERB: Record<EligibilityStage, string> = {
  invite: 'invited to an RFQ',
  award: 'awarded a quotation',
  order: 'issued a purchase order'
};

/** Evaluate an already-loaded supplier document. */
export function checkSupplierEligibility(
  supplier: any,
  stage: EligibilityStage
): EligibilityResult {
  if (!supplier || supplier.isDeleted) {
    return { eligible: false, reason: 'Supplier not found' };
  }

  const name = supplier.companyName || 'Supplier';

  // A pending supplier may be invited to quote: sourcing widely is how you get
  // competitive prices, and nothing is committed by asking for a quotation.
  // Every later stage still requires full activation.
  const invitable = supplier.status === 'active' || (stage === 'invite' && supplier.status === 'pending');

  if (!invitable) {
    const detail = STATUS_REASON[supplier.status] || `has status '${supplier.status}'`;
    return {
      eligible: false,
      reason: `${name} ${detail} and cannot be ${STAGE_VERB[stage]}.`,
      supplier
    };
  }

  // KYS gates award and payment, not invitation — an invited supplier can
  // complete their KYS while the RFQ is open.
  if (stage !== 'invite' && !supplier.kysComplete && !supplier.kysExempt) {
    const expired = supplier.expiredDocumentTypes?.length
      ? ` Expired document(s): ${supplier.expiredDocumentTypes.join(', ')}.`
      : '';
    return {
      eligible: false,
      reason: `${name} has not completed KYS verification and cannot be ${STAGE_VERB[stage]}.${expired}`,
      supplier
    };
  }

  // Transactability is tracked separately from lifecycle status: a prospective
  // supplier may be invited to quote, but only a spend-authorized one may be
  // awarded or issued a purchase order.
  //
  // A missing value counts as NOT authorized. This gate controls whether money
  // can be committed, so it fails closed: a legacy record, or a query whose
  // projection drops the field, must not be read as permission to pay.
  if (stage !== 'invite' && supplier.transactability !== 'spend_authorized') {
    return {
      eligible: false,
      reason: `${name} is not spend-authorized and cannot be ${STAGE_VERB[stage]}.`,
      supplier
    };
  }

  return { eligible: true, supplier };
}

/** Load a supplier by id and evaluate eligibility. */
export async function checkSupplierIdEligibility(
  supplierId: any,
  stage: EligibilityStage
): Promise<EligibilityResult> {
  const supplier = await SupplierProfile.findById(supplierId).select(
    'companyName status kysComplete kysExempt isDeleted transactability expiredDocumentTypes'
  );
  return checkSupplierEligibility(supplier, stage);
}

/**
 * Partition a list of supplier ids into those that may transact and those that
 * may not. Used when publishing an RFQ, where some invitees may have been
 * blacklisted since the draft was created.
 */
export async function partitionEligibleSuppliers(
  supplierIds: any[],
  stage: EligibilityStage
): Promise<{ eligible: any[]; ineligible: { supplierId: any; reason: string }[] }> {
  const suppliers = await SupplierProfile.find({
    _id: { $in: supplierIds }
  }).select('companyName status kysComplete kysExempt isDeleted transactability expiredDocumentTypes');

  const byId = new Map(suppliers.map((s) => [String(s._id), s]));
  const eligible: any[] = [];
  const ineligible: { supplierId: any; reason: string }[] = [];

  for (const id of supplierIds) {
    const result = checkSupplierEligibility(byId.get(String(id)), stage);
    if (result.eligible) {
      eligible.push(id);
    } else {
      ineligible.push({ supplierId: id, reason: result.reason || 'Not eligible' });
    }
  }

  return { eligible, ineligible };
}
