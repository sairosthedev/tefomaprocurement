import {
  PR_CANCEL_BY_ROLE,
  PR_TERMINAL_STATUSES,
  PO_CANCEL_BY_ROLE,
  PO_TERMINAL_STATUSES
} from '@fossil/shared';

const toId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
};

export function canCancelRequisition(
  user: { role?: string; _id?: string } | null | undefined,
  requisition: { status?: string; requestedBy?: unknown; department?: unknown } | null | undefined
): boolean {
  if (!user?.role || !requisition?.status) return false;
  if ((PR_TERMINAL_STATUSES as readonly string[]).includes(requisition.status)) return false;

  const allowed = PR_CANCEL_BY_ROLE[user.role];
  if (!allowed?.includes(requisition.status)) return false;

  if (user.role === 'end_user') {
    return toId(requisition.requestedBy) === toId(user._id);
  }

  if (user.role === 'department_head') {
    return toId(requisition.department) === toId((user as { department?: unknown }).department);
  }

  return true;
}

export function canCancelPurchaseOrder(
  user: { role?: string } | null | undefined,
  po: { status?: string } | null | undefined
): boolean {
  if (!user?.role || !po?.status) return false;
  if ((PO_TERMINAL_STATUSES as readonly string[]).includes(po.status)) return false;
  return Boolean(PO_CANCEL_BY_ROLE[user.role]?.includes(po.status));
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
