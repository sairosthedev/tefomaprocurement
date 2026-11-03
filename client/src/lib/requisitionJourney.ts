/**
 * Where a requisition has got to, shared by the requisitions list and the
 * requisition page so both always say the same thing.
 */

export const REQUISITION_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_hod: 'Pending HOD Approval',
  stores_review: 'Stores Review',
  fulfilled: 'Fulfilled from Stock',
  pending_acceptance: 'Pending Acceptance',
  accepted: 'Accepted',
  rejected: 'Rejected',
  sourcing: 'Sourcing',
  quoted: 'Quoted',
  ordered: 'Ordered',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const REQUISITION_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_hod: 'bg-amber-100 text-amber-700',
  stores_review: 'bg-cyan-100 text-cyan-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  pending_acceptance: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  sourcing: 'bg-blue-100 text-blue-700',
  quoted: 'bg-indigo-100 text-indigo-700',
  ordered: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500'
};

/** A purchase order's status as a stage of the requisition's journey. */
export const PO_STAGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'PO drafted', className: 'bg-gray-100 text-gray-700' },
  pending_hod: { label: 'PO with Dept Head', className: 'bg-amber-100 text-amber-700' },
  pending_dept_hod: { label: 'PO with Dept Head', className: 'bg-amber-100 text-amber-700' },
  pending_proc_hod: { label: 'PO with Head of Procurement', className: 'bg-amber-100 text-amber-700' },
  pending_finance: { label: 'PO with Finance', className: 'bg-amber-100 text-amber-700' },
  pending_coo: { label: 'PO with COO', className: 'bg-amber-100 text-amber-700' },
  pending_approvals: { label: 'PO awaiting approval', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'PO approved', className: 'bg-green-100 text-green-700' },
  issued: { label: 'Ordered from supplier', className: 'bg-blue-100 text-blue-700' },
  partially_received: { label: 'Partly delivered', className: 'bg-teal-100 text-teal-700' },
  completed: { label: 'Delivered', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'PO rejected', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'PO cancelled', className: 'bg-gray-100 text-gray-500' }
};

/**
 * The furthest point a requisition has reached across requisition, purchase
 * order and delivery, as one label. `hint` names the PO (or RFQ) behind it.
 */
export function journeyStatus(req: any): { label: string; className: string; hint?: string } {
  const po = req.purchaseOrder;
  const hint = po
    ? [po.poNumber, po.supplier?.companyName].filter(Boolean).join(' · ')
    : req.rfq?.rfqNumber;

  if (req.status === 'cancelled' || req.status === 'rejected') {
    return { label: REQUISITION_STATUS_LABELS[req.status], className: REQUISITION_STATUS_COLORS[req.status], hint };
  }
  if (req.itemsCollected) return { label: 'Collected', className: 'bg-emerald-100 text-emerald-700', hint };
  if (req.itemsDeliveredToStores) return { label: 'Delivered to Stores', className: 'bg-green-100 text-green-700', hint };
  if (po && PO_STAGE[po.status]) return { ...PO_STAGE[po.status], hint };
  if (req.status === 'ordered') return { label: 'Awaiting PO', className: 'bg-amber-100 text-amber-700', hint };
  return {
    label: REQUISITION_STATUS_LABELS[req.status] || req.status,
    className: REQUISITION_STATUS_COLORS[req.status] || REQUISITION_STATUS_COLORS.draft,
    hint
  };
}

export interface JourneyStep {
  label: string;
  done: boolean;
  /** A date or a short note under the step. */
  note?: string;
}

const historyDate = (req: any, ...actions: string[]): string | undefined => {
  const entry = (req.statusHistory || []).find((h: any) => actions.includes(h.action));
  return entry?.timestamp;
};

const shortDate = (value?: string | Date): string | undefined =>
  value ? new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) : undefined;

/**
 * The steps of the journey for a progress bar. A requisition fulfilled from
 * stock ends at stores; everything else carries on through procurement to the
 * delivery and collection.
 */
export function journeySteps(req: any): JourneyStep[] {
  const reachedProcurement = ['accepted', 'sourcing', 'quoted', 'ordered', 'completed'].includes(req.status);
  const steps: JourneyStep[] = [
    { label: req.status === 'draft' ? 'Draft' : 'Submitted', done: req.status !== 'draft', note: shortDate(req.createdAt) },
    {
      label: 'HOD approved',
      done: !!req.hodApprovedAt || !['draft', 'pending_hod'].includes(req.status),
      note: shortDate(req.hodApprovedAt || historyDate(req, 'hod_approved', 'approved'))
    },
    {
      label: 'Stores review',
      done: !!req.storesReviewedAt,
      note: shortDate(req.storesReviewedAt)
    }
  ];

  if (req.status === 'fulfilled') {
    steps.push({ label: 'Issued from stock', done: true });
    return steps;
  }

  steps.push(
    {
      label: 'Procurement',
      done: reachedProcurement || !!req.rfq || !!req.purchaseOrder,
      note: shortDate(historyDate(req, 'accepted'))
    },
    { label: 'RFQ', done: !!req.rfq, note: req.rfq?.rfqNumber },
    { label: 'Purchase order', done: !!req.purchaseOrder, note: req.purchaseOrder?.poNumber },
    { label: 'In stores', done: !!req.itemsDeliveredToStores },
    { label: 'Collected', done: !!req.itemsCollected }
  );
  return steps;
}
