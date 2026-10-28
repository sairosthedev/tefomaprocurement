import {
  PR_CANCEL_BY_ROLE,
  PR_TERMINAL_STATUSES,
  PO_CANCEL_BY_ROLE,
  PO_TERMINAL_STATUSES,
  cancellationRolesFor
} from '@fossil/shared';

const toId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
};

// Mirrors assertCanCancelRequisition on the API: the Head of Procurement holds
// both procurement's and a department head's rules, and either may apply.
export function canCancelRequisition(
  user: { role?: string; _id?: string; department?: unknown } | null | undefined,
  requisition: { status?: string; requestedBy?: unknown; department?: unknown } | null | undefined
): boolean {
  if (!user?.role || !requisition?.status) return false;
  const status = requisition.status;
  if ((PR_TERMINAL_STATUSES as readonly string[]).includes(status)) return false;

  return cancellationRolesFor(user).some((role) => {
    if (!PR_CANCEL_BY_ROLE[role]?.includes(status)) return false;
    if (role === 'end_user') return toId(requisition.requestedBy) === toId(user._id);
    if (role === 'department_head') return toId(requisition.department) === toId(user.department);
    return true;
  });
}

export function canCancelPurchaseOrder(
  user: { role?: string; department?: unknown } | null | undefined,
  po: { status?: string } | null | undefined
): boolean {
  if (!user?.role || !po?.status) return false;
  const status = po.status;
  if ((PO_TERMINAL_STATUSES as readonly string[]).includes(status)) return false;
  return cancellationRolesFor(user).some((role) => PO_CANCEL_BY_ROLE[role]?.includes(status));
}

export function requisitionCancelApiBase(
  user: { role?: string } | null | undefined,
  status?: string
): '/department' | '/procurement' {
  const procurementStatuses = ['pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered'];
  if (status && procurementStatuses.includes(status)) {
    return '/procurement';
  }
  if (user?.role === 'procurement_officer') {
    return '/procurement';
  }
  return '/department';
}

export function purchaseOrderCancelApiBase(user: { role?: string } | null | undefined): string {
  switch (user?.role) {
    case 'finance':
      return '/finance';
    case 'coo':
      return '/coo';
    default:
      return '/procurement';
  }
}
