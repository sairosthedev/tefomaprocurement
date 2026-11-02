import { SupplierBankChangeRequest } from '../models/index.js';
import type { IBankSnapshot, IBankFieldChange } from '../models/SupplierBankChangeRequest.model.js';

/**
 * Bank-detail change control.
 *
 * Modelled on Oracle Fusion's supplier bank-account change approval and the
 * standard callback protocol: the change is held, payments pause, an
 * out-of-band callback is made to a number already on file, and a SECOND
 * person — not the requester, not the caller — approves before it applies.
 *
 * The controls that matter are that the pause is automatic (so manufactured
 * urgency cannot skip it) and that the callback number can never be one
 * supplied in the request itself.
 */

/** Fields whose change redirects money, and so requires the full workflow. */
export const MONEY_REDIRECTING_FIELDS: readonly (keyof IBankSnapshot)[] = Object.freeze([
  'accountNumber',
  'bankName',
  'branchCode',
  'accountName',
  'accountType'
]);

const FIELD_LABELS: Record<string, string> = {
  accountNumber: 'Account number',
  bankName: 'Bank name',
  branchCode: 'Branch code',
  accountName: 'Account name',
  accountType: 'Account type'
};

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

/** Field-level before/after diff — the audit record that was missing entirely. */
export function diffBankDetails(
  previous: IBankSnapshot | undefined,
  requested: IBankSnapshot
): IBankFieldChange[] {
  const changes: IBankFieldChange[] = [];
  for (const field of MONEY_REDIRECTING_FIELDS) {
    const from = norm(previous?.[field]);
    const to = norm(requested[field]);
    // An omitted field means "unchanged", not "clear it".
    if (requested[field] === undefined) continue;
    if (from !== to) {
      changes.push({ field: FIELD_LABELS[field] || field, from, to });
    }
  }
  return changes;
}

/** True when the proposed details change anything that redirects payment. */
export function requiresApproval(
  previous: IBankSnapshot | undefined,
  requested: IBankSnapshot
): boolean {
  return diffBankDetails(previous, requested).length > 0;
}

/** Is there an open change request holding payments for this supplier? */
export async function hasOpenBankChange(supplierId: any): Promise<boolean> {
  const open = await SupplierBankChangeRequest.exists({
    supplier: supplierId,
    status: { $in: ['pending_verification', 'pending_approval'] }
  });
  return !!open;
}

/** The open request, when one exists — used to explain a paused payment. */
export async function getOpenBankChange(supplierId: any) {
  return SupplierBankChangeRequest.findOne({
    supplier: supplierId,
    status: { $in: ['pending_verification', 'pending_approval'] }
  }).sort({ createdAt: -1 });
}

/**
 * Whether `numberCalled` is a phone number already held for this supplier.
 * A callback to a number supplied in the change request itself verifies
 * nothing — it reaches whoever made the request.
 */
export function isKnownContactNumber(supplier: any, numberCalled: string): boolean {
  const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
  const target = digits(numberCalled);
  if (!target) return false;
  const onFile = [
    ...(supplier.contactPersons || []).map((c: any) => c.phone),
    supplier.user?.phone
  ];
  // Compare on the last 9 digits so local/international formats still match.
  const tail = (s: string) => s.slice(-9);
  return onFile.some((n) => {
    const d = digits(n);
    return d.length > 0 && tail(d) === tail(target);
  });
}

/**
 * Four-eyes check: the approver must be neither the requester nor the person
 * who performed the callback verification.
 */
export function approverIsIndependent(request: any, approverId: any): boolean {
  const id = String(approverId);
  if (String(request.requestedBy) === id) return false;
  if (request.callback?.verifiedBy && String(request.callback.verifiedBy) === id) return false;
  return true;
}
