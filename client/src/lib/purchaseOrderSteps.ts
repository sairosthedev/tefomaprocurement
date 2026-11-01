import type { WorkflowStep } from '../components/WorkflowStepper';

const ISSUED = ['issued', 'partially_received', 'completed'];
const BEFORE_PROC_HOD = ['draft', 'pending_hod', 'pending_dept_hod', 'pending_proc_hod'];

/** Who an order in each approval status is waiting on. */
export const PO_WAITING_ON: Record<string, string> = {
  draft: 'Procurement to submit the purchase order',
  pending_hod: 'Head of Procurement approval',
  pending_proc_hod: 'Head of Procurement approval',
  pending_dept_hod: 'Department head approval',
  pending_finance: 'Finance approval',
  pending_coo: 'COO approval',
  pending_approvals: 'Finance and COO approval',
  approved: 'Procurement to issue the order'
};

/**
 * A purchase order's approval chain and fulfilment, one step after another.
 * The PO page leads with the requisition and winning quote it came from;
 * the approvals dialog starts at submission.
 */
export function purchaseOrderSteps(po: any, { withSources = false }: { withSources?: boolean } = {}): WorkflowStep[] {
  const stopped = po.status === 'rejected' || po.status === 'cancelled';
  const issued = ISSUED.includes(po.status);
  const raw: Array<{ key: string; label: string; done: boolean; detail?: string; to?: string }> = [];

  if (withSources) {
    raw.push({
      key: 'pr',
      label: 'Requisition',
      done: true,
      detail: po.purchaseRequisition?.requisitionNumber,
      to: po.purchaseRequisition?._id ? `/app/requisitions/${po.purchaseRequisition._id}` : undefined
    });
    raw.push({
      key: 'quote',
      label: 'Winning quote',
      done: true,
      detail: po.quotation?.quotationNumber,
      to: po.quotation?._id ? `/app/quotations/${po.quotation._id}` : undefined
    });
  }

  raw.push({ key: 'submitted', label: 'Submitted', done: po.status !== 'draft' });
  if (po.deptHodApproved || ['pending_hod', 'pending_dept_hod'].includes(po.status)) {
    raw.push({ key: 'dept', label: 'Department head', done: !!po.deptHodApproved || issued });
  }
  raw.push({
    key: 'proc',
    label: 'Head of Procurement',
    done: !!po.procHodApproved || issued || (!stopped && !BEFORE_PROC_HOD.includes(po.status))
  });
  raw.push({ key: 'finance', label: 'Finance', done: !!po.financeApproved || issued });
  if (po.requiresCooApproval || po.status === 'pending_coo' || po.status === 'pending_approvals') {
    raw.push({ key: 'coo', label: 'COO', done: !!po.cooApproved || issued });
  }
  raw.push({ key: 'issued', label: 'Issued to supplier', done: issued });
  raw.push({
    key: 'received',
    label: 'Goods received',
    done: po.status === 'completed',
    detail: po.status === 'partially_received' ? 'Partly received' : undefined
  });

  const current = raw.findIndex((s) => !s.done);
  return raw.map((s, i) => ({
    key: s.key,
    label: s.label,
    detail: i === current && stopped ? (po.status === 'rejected' ? 'Rejected' : 'Cancelled') : s.detail,
    to: s.to,
    state: s.done ? 'done' : i === current ? (stopped ? 'stopped' : 'current') : 'upcoming'
  }));
}
