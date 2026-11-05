import type { Request } from 'express';
import { KYS_CHECKLIST_ITEMS, computeKysCompletionForTier, isProcurementHead } from '@fossil/shared';
import { User } from '../models/index.js';
import { createAuditLog } from '../middleware/index.js';
import { createNotification, createNotifications } from './notification.service.js';
import { transitionSupplierStatus } from './supplierEligibility.service.js';
import { withoutDocumentFiles } from './supplierDocuments.service.js';

/**
 * Onboarding: how a pending supplier becomes active, or is turned away.
 *
 * Activation takes two people. A procurement officer (or the Head of
 * Procurement) submits the supplier; the Head of Procurement or the COO,
 * never the submitter, approves it. Activation is what grants spend
 * authorisation, and one officer could once take a supplier from pending to
 * paid alone, KYS override included, with an exemption that never lapsed.
 *
 * The request lives on the supplier (`activationRequest`) while it is open;
 * the status stays `pending` until it is approved, so a supplier awaiting
 * approval may still be invited to quote, exactly as before.
 *
 * Every function here returns the HTTP status and body to send, so the legacy
 * activation routes (verifyKys, approveSupplier) answer a pending supplier
 * with the same validation and response as the new submit endpoint.
 */

export const ACTIVATION_APPROVERS = 'the Head of Procurement or the COO';

export interface ActivationResult {
  status: number;
  body: Record<string, unknown>;
}

const fail = (status: number, message: string, data?: Record<string, unknown>): ActivationResult => ({
  status,
  body: { success: false, message, ...(data ? { data } : {}) }
});

const idOf = (value: any): string => String(value?._id ?? value ?? '');
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const nameOf = (user: any): string =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'A colleague';
const day = (value: unknown): string => (value ? new Date(value as string).toISOString().slice(0, 10) : 'an unknown date');

/** Approve, return and reject belong to the Head of Procurement and the COO. */
export function canDecideActivation(user: any): boolean {
  return user?.role === 'coo' || isProcurementHead(user);
}

export function isAwaitingActivation(supplier: any): boolean {
  return supplier?.status === 'pending' && !!supplier?.activationRequest?.requestedBy;
}

/**
 * Suppliers awaiting activation approval. With `excludeRequester`, only those
 * someone else submitted — the ones that user may decide. The supplier list,
 * the dashboard item and the sidebar badge all read this, so they agree.
 */
export function awaitingActivationFilter(excludeRequester?: unknown): Record<string, unknown> {
  return {
    status: 'pending',
    isDeleted: false,
    'activationRequest.requestedBy': excludeRequester ? { $exists: true, $ne: excludeRequester } : { $exists: true }
  };
}

/** The supplier's KYS against its tier, with the missing checks by name. */
export function kysGap(supplier: any) {
  const completion = computeKysCompletionForTier(
    (supplier.kysChecklist || {}) as Record<string, boolean>,
    supplier.tier
  );
  const missing = completion.missingKeys.map(
    (key) => KYS_CHECKLIST_ITEMS.find((item) => item.key === key)?.label || key
  );
  return { completion, missing };
}

/** Active Heads of Procurement and COOs, less `exclude`. */
async function activationDeciders(exclude?: unknown): Promise<any[]> {
  const users = await User.find({ role: { $in: ['coo', 'department_head'] }, status: 'active', isDeleted: false })
    .select('_id email firstName lastName role department')
    .populate('department', 'name code');
  return users.filter((u: any) => canDecideActivation(u) && idOf(u._id) !== idOf(exclude));
}

/** Staff notices use the supplier lifecycle type; `audience` points the email at the record. */
function staffNotice(supplier: any, actor: any, title: string, message: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'supplier_status_change',
    title,
    message,
    entity: 'SupplierProfile',
    entityId: supplier._id,
    relatedUser: actor._id,
    metadata: { companyName: supplier.companyName, audience: 'staff', ...extra }
  };
}

// ─── Maker ───────────────────────────────────────────────────────────────

export async function submitActivationRequest(
  supplier: any,
  req: Request,
  input: { notes?: unknown; overrideReason?: unknown; successMessage?: string }
): Promise<ActivationResult> {
  const user = req.user!;

  if (supplier.status !== 'pending') {
    return fail(400, `Only a pending supplier can be submitted for activation (this one is ${supplier.status}).`);
  }
  if (isAwaitingActivation(supplier)) {
    const by = await User.findById(idOf(supplier.activationRequest.requestedBy)).select('firstName lastName email').lean();
    return fail(
      409,
      `${supplier.companyName} is already awaiting activation approval — submitted by ${nameOf(by)} on ${day(supplier.activationRequest.requestedAt)}.`
    );
  }

  const notes = text(input.notes);
  const overrideReason = text(input.overrideReason);
  // Judged against the tier, as activation always was. KYS short of it goes
  // forward only as a stated override, which the approver sees and accepts.
  const { completion, missing } = kysGap(supplier);
  const kysOverride = !completion.isComplete;
  if (kysOverride && !overrideReason) {
    return fail(
      400,
      `KYS is incomplete for this supplier's tier (${completion.requiredComplete}/${completion.requiredTotal} required checks). ` +
        `Missing: ${missing.join('; ')}. Give a KYS override reason to submit it anyway.`,
      { requiresKys: true, completion, missingChecks: missing }
    );
  }

  supplier.activationRequest = {
    requestedBy: user._id,
    requestedAt: new Date(),
    notes,
    kysOverride,
    kysOverrideReason: kysOverride ? overrideReason : undefined
  };
  await supplier.save();

  await createAuditLog({
    action: 'submit',
    entity: 'SupplierProfile',
    entityId: supplier._id,
    user,
    description: `Submitted ${supplier.companyName} for activation${kysOverride ? `, with KYS override: ${overrideReason}` : ''}`,
    newData: { activationRequest: { kysOverride, kysOverrideReason: kysOverride ? overrideReason : undefined, notes } },
    req
  });

  // A Head of Procurement who submits is not told to approve their own.
  const deciders = await activationDeciders(user._id);
  if (deciders.length) {
    await createNotifications(
      deciders,
      staffNotice(
        supplier,
        user,
        'Supplier awaiting activation approval',
        `${nameOf(user)} submitted ${supplier.companyName} for activation${kysOverride ? ' with a KYS override' : ''}. It needs approval by ${ACTIVATION_APPROVERS}.`,
        { kysOverride }
      )
    );
  }

  return {
    status: 200,
    body: {
      success: true,
      message:
        input.successMessage ||
        `${supplier.companyName} was submitted for activation. It now awaits approval by ${ACTIVATION_APPROVERS}.`,
      awaitingActivationApproval: true,
      data: withoutDocumentFiles(supplier)
    }
  };
}

// ─── Checker ─────────────────────────────────────────────────────────────

export async function approveActivationRequest(
  supplier: any,
  req: Request,
  input: { notes?: unknown }
): Promise<ActivationResult> {
  const user = req.user!;

  if (!canDecideActivation(user)) {
    return fail(403, `Only ${ACTIVATION_APPROVERS} can approve a supplier's activation.`);
  }
  if (!isAwaitingActivation(supplier)) {
    return fail(400, `${supplier.companyName} is not awaiting activation approval.`);
  }
  // Read out before the request is cleared below.
  const request = supplier.activationRequest;
  const requesterId = idOf(request.requestedBy);
  const requestedAt = request.requestedAt;
  if (requesterId === idOf(user._id)) {
    return fail(
      403,
      `You submitted ${supplier.companyName} for activation, so it must be approved by someone else — ${ACTIVATION_APPROVERS}.`
    );
  }

  // The checklist can change while a request waits. One made on a complete
  // KYS carries no override, so it is not approved as one.
  if (!request.kysOverride) {
    const { completion, missing } = kysGap(supplier);
    if (!completion.isComplete) {
      return fail(
        400,
        `KYS is no longer complete for this supplier's tier (missing: ${missing.join('; ')}). ` +
          'Return the request so it can be resubmitted with an override, or complete the checks first.',
        { requiresKys: true, completion, missingChecks: missing }
      );
    }
  }

  const requester = await User.findById(requesterId).select('firstName lastName email').lean();
  const notes = text(input.notes);
  const now = new Date();
  const override = Boolean(request.kysOverride);
  const overrideReason = request.kysOverrideReason;

  // What single-person activation applied, now on a second person's word. An
  // override is recorded as granted by the approver, who accepted it.
  if (override) {
    supplier.kysExempt = true;
    supplier.kysExemptReason = overrideReason;
    supplier.kysExemptBy = user._id;
    supplier.kysExemptAt = now;
  } else {
    supplier.kysComplete = true;
    // The submitter checked the KYS; the approver approved the activation.
    if (!supplier.kysChecklist.verifiedAt) {
      supplier.kysChecklist.verifiedBy = requesterId;
      supplier.kysChecklist.verifiedAt = requestedAt;
    }
  }

  transitionSupplierStatus(
    supplier,
    'active',
    user._id,
    [
      `Activation submitted by ${nameOf(requester)} and approved by ${nameOf(user)}`,
      override ? `KYS override: ${overrideReason}` : null,
      notes ? `Notes: ${notes}` : null
    ]
      .filter(Boolean)
      .join('. ')
  );
  supplier.approvedBy = user._id;
  supplier.approvedAt = now;
  supplier.activationRequest = undefined;
  await supplier.save();

  await createAuditLog({
    action: 'approve',
    entity: 'SupplierProfile',
    entityId: supplier._id,
    user,
    description: `Approved activation of ${supplier.companyName} (submitted by ${nameOf(requester)})${override ? `, with KYS override: ${overrideReason}` : ''}`,
    previousData: { status: 'pending' },
    newData: { status: 'active', kysExempt: supplier.kysExempt, overrideKys: override, submittedBy: requesterId },
    req
  });

  // The same notice, and so the same email, single-person activation sent.
  if (supplier.user) {
    await createNotification({
      recipient: idOf(supplier.user),
      type: 'supplier_approved',
      title: 'Supplier account approved',
      message: `Your supplier account for ${supplier.companyName} has been approved. You can now receive RFQ invitations and submit quotations.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      relatedUser: user._id,
      metadata: { companyName: supplier.companyName }
    });
  }

  await createNotification({
    recipient: requesterId,
    ...staffNotice(
      supplier,
      user,
      'Supplier activation approved',
      `${nameOf(user)} approved the activation of ${supplier.companyName}. It is now active and can be awarded work.`
    )
  });

  return {
    status: 200,
    body: { success: true, message: `${supplier.companyName} is now active.`, data: withoutDocumentFiles(supplier) }
  };
}

export async function returnActivationRequest(
  supplier: any,
  req: Request,
  input: { reason?: unknown }
): Promise<ActivationResult> {
  const user = req.user!;
  const reason = text(input.reason);

  if (!canDecideActivation(user)) {
    return fail(403, `Only ${ACTIVATION_APPROVERS} can return an activation request.`);
  }
  if (!reason) {
    return fail(400, 'A reason is required to return an activation request.');
  }
  if (!isAwaitingActivation(supplier)) {
    return fail(400, `${supplier.companyName} is not awaiting activation approval.`);
  }

  const requesterId = idOf(supplier.activationRequest.requestedBy);
  const kysOverride = Boolean(supplier.activationRequest.kysOverride);
  supplier.activationRequest = undefined;
  await supplier.save();

  await createAuditLog({
    action: 'reject',
    entity: 'SupplierProfile',
    entityId: supplier._id,
    user,
    description: `Returned the activation request for ${supplier.companyName}. Reason: ${reason}`,
    previousData: { activationRequest: { requestedBy: requesterId, kysOverride } },
    newData: { status: 'pending', returnReason: reason },
    req
  });

  if (requesterId !== idOf(user._id)) {
    await createNotification({
      recipient: requesterId,
      ...staffNotice(
        supplier,
        user,
        'Supplier activation returned',
        `${nameOf(user)} returned the activation request for ${supplier.companyName}. Reason: ${reason}`
      )
    });
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Activation request returned. The supplier stays pending and can be submitted again.',
      data: withoutDocumentFiles(supplier)
    }
  };
}

// ─── Registration outcome ────────────────────────────────────────────────

export async function rejectRegistration(
  supplier: any,
  req: Request,
  input: { reason?: unknown }
): Promise<ActivationResult> {
  const user = req.user!;
  const reason = text(input.reason);

  if (!canDecideActivation(user)) {
    return fail(403, `Only ${ACTIVATION_APPROVERS} can reject a supplier registration.`);
  }
  if (!reason) {
    return fail(400, 'A reason is required to reject a registration.');
  }
  if (supplier.status !== 'pending') {
    return fail(400, `Only a pending registration can be rejected (this one is ${supplier.status}).`);
  }

  // Rejecting while a request waits closes the request too.
  const requesterId = supplier.activationRequest?.requestedBy ? idOf(supplier.activationRequest.requestedBy) : '';
  transitionSupplierStatus(supplier, 'rejected', user._id, reason);
  supplier.rejectionReason = reason;
  supplier.rejectedBy = user._id;
  supplier.rejectedAt = new Date();
  supplier.activationRequest = undefined;
  await supplier.save();

  await createAuditLog({
    action: 'reject',
    entity: 'SupplierProfile',
    entityId: supplier._id,
    user,
    description: `Rejected the registration of ${supplier.companyName}. Reason: ${reason}`,
    previousData: { status: 'pending', awaitingActivation: Boolean(requesterId) },
    newData: { status: 'rejected', rejectionReason: reason, transactability: supplier.transactability },
    req
  });

  if (supplier.user) {
    await createNotification({
      recipient: idOf(supplier.user),
      type: 'supplier_status_change',
      title: 'Supplier registration not approved',
      message: `Your supplier registration for ${supplier.companyName} was not approved. Reason: ${reason}. Contact procurement if you have any questions.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      relatedUser: user._id,
      metadata: { companyName: supplier.companyName, status: 'rejected' }
    });
  }

  if (requesterId && requesterId !== idOf(user._id)) {
    await createNotification({
      recipient: requesterId,
      ...staffNotice(
        supplier,
        user,
        'Supplier registration rejected',
        `${nameOf(user)} rejected the registration of ${supplier.companyName}, which you had submitted for activation. Reason: ${reason}`
      )
    });
  }

  return {
    status: 200,
    body: { success: true, message: 'Registration rejected.', data: withoutDocumentFiles(supplier) }
  };
}

export async function reopenRegistration(
  supplier: any,
  req: Request,
  input: { reason?: unknown }
): Promise<ActivationResult> {
  const user = req.user!;
  const reason = text(input.reason);

  if (!canDecideActivation(user)) {
    return fail(403, `Only ${ACTIVATION_APPROVERS} can reopen a supplier registration.`);
  }
  if (!reason) {
    return fail(400, 'A reason is required to reopen a registration.');
  }
  if (supplier.status !== 'rejected') {
    return fail(400, `Only a rejected registration can be reopened (this one is ${supplier.status}).`);
  }

  // Back to pending, from where activation again takes two people. The
  // rejection fields stay as history, as a lifted blacklisting's do.
  transitionSupplierStatus(supplier, 'pending', user._id, `Registration reopened: ${reason}`);
  await supplier.save();

  await createAuditLog({
    action: 'status_change',
    entity: 'SupplierProfile',
    entityId: supplier._id,
    user,
    description: `Reopened the registration of ${supplier.companyName}. Reason: ${reason}`,
    previousData: { status: 'rejected', rejectionReason: supplier.rejectionReason },
    newData: { status: 'pending' },
    req
  });

  if (supplier.user) {
    await createNotification({
      recipient: idOf(supplier.user),
      type: 'supplier_status_change',
      title: 'Supplier registration reopened',
      message: `Your supplier registration for ${supplier.companyName} has been reopened and is pending review again.`,
      entity: 'SupplierProfile',
      entityId: supplier._id,
      relatedUser: user._id,
      metadata: { companyName: supplier.companyName, status: 'pending' }
    });
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Registration reopened. The supplier is pending again.',
      data: withoutDocumentFiles(supplier)
    }
  };
}
