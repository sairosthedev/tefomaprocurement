import type { WorkflowStep } from '../components/WorkflowStepper';

/**
 * Where a supplier's RFQ, quotation, order, delivery, invoice, banking change
 * or onboarding stands, seen from the supplier portal. Each builder lists the
 * steps in order with a flag for "done" and "stopped"; the first step not done
 * is the current one.
 */

interface RawStep {
  key: string;
  label: string;
  done: boolean;
  stopped?: boolean;
  detail?: string;
  to?: string;
}

function toSteps(raw: RawStep[]): { steps: WorkflowStep[]; stopped: boolean } {
  const current = raw.findIndex((s) => !s.done);
  const steps: WorkflowStep[] = raw.map((s, i) => ({
    key: s.key,
    label: s.label,
    detail: s.detail,
    to: s.to,
    state: s.done ? 'done' : i === current ? (s.stopped ? 'stopped' : 'current') : 'upcoming'
  }));
  return { steps, stopped: current >= 0 && !!raw[current].stopped };
}

const DECIDED = ['accepted', 'rejected', 'expired'];

/** Quotation statuses that mean procurement has made its decision. */
export function isQuoteDecided(status?: string | null): boolean {
  return DECIDED.includes(status || '');
}

/** An RFQ the supplier was invited to: invited, quoted, evaluated, decided, ordered. */
export function supplierRfqJourney(rfq: any, canSubmit: boolean) {
  const q = (rfq.quotationStatus as string | null) || null;
  const quoted = !!q && q !== 'draft' && q !== 'revision_requested';
  const missed = !quoted && !canSubmit;
  return toSteps([
    { key: 'invited', label: 'Invited', done: true, detail: rfq.rfqNumber },
    {
      key: 'quote',
      label: 'Quote submitted',
      done: quoted,
      stopped: missed,
      detail:
        q === 'revision_requested'
          ? 'Revision requested'
          : missed
            ? rfq.status === 'cancelled' ? 'RFQ cancelled' : 'Not submitted'
            : rfq.quotationNumber || undefined,
      to: quoted ? '/app/my-submitted-quotations' : undefined
    },
    { key: 'evaluation', label: 'Evaluation', done: isQuoteDecided(q) },
    {
      key: 'outcome',
      label: 'Outcome',
      done: q === 'accepted',
      stopped: q === 'rejected' || q === 'expired',
      detail: q === 'accepted' ? 'Selected' : q === 'rejected' ? 'Not selected' : q === 'expired' ? 'Quote expired' : undefined
    },
    {
      key: 'po',
      label: 'Purchase order',
      done: !!rfq.purchaseOrder,
      detail: rfq.purchaseOrder?.poNumber,
      to: rfq.purchaseOrder ? '/app/my-purchase-orders' : undefined
    }
  ]);
}

/** One of the supplier's own quotations: submitted, reviewed, decided, ordered. */
export function supplierQuotationJourney(quote: any) {
  const s = quote.status as string;
  const accepted = s === 'accepted' || s === 'awarded';
  return toSteps([
    { key: 'submitted', label: 'Submitted', done: s !== 'draft', detail: quote.quotationNumber },
    {
      key: 'review',
      label: 'Under review',
      done: accepted || s === 'rejected' || s === 'expired' || s === 'superseded',
      stopped: s === 'revision_requested',
      detail: s === 'revision_requested' ? 'Revision requested' : undefined
    },
    {
      key: 'decision',
      label: 'Decision',
      done: accepted,
      stopped: s === 'rejected' || s === 'expired' || s === 'superseded',
      detail: accepted ? 'Selected' : s === 'rejected' ? 'Not selected' : s === 'expired' ? 'Expired' : s === 'superseded' ? 'Replaced by a revision' : undefined
    },
    { key: 'po', label: 'Purchase order', done: false, to: accepted ? '/app/my-purchase-orders' : undefined }
  ]);
}

/** What happens next on one of the supplier's quotations. */
export function supplierQuotationNext(quote: any): { title: string; description?: string; waiting?: boolean; to?: string; label?: string } | null {
  const s = quote.status as string;
  const rfqId = quote.rfq?._id || quote.rfq;
  if (s === 'revision_requested' && rfqId) {
    return { title: 'Submit a revised quotation', description: 'Procurement asked you for a revised price.', to: `/app/submit-quotation?rfq=${rfqId}`, label: 'Submit revised quote' };
  }
  if (s === 'accepted' || s === 'awarded') {
    return { title: 'Procurement to issue the purchase order', description: 'It appears under My Purchase Orders once approved.', waiting: true, to: '/app/my-purchase-orders', label: 'My purchase orders' };
  }
  if (s === 'submitted' || s === 'under_review') {
    return { title: 'Procurement to evaluate the quotes', description: 'You are notified when a decision is made.', waiting: true };
  }
  return null;
}

const DELIVERED = ['partially_received', 'completed'];
const INVOICED = ['submitted', 'variance', 'approved', 'partially_paid', 'paid'];

/** An order placed with the supplier: received, acknowledged, delivered, invoiced, paid. */
export function supplierPoJourney(po: any) {
  const inv = po.invoice;
  const cancelled = po.status === 'cancelled';
  return toSteps([
    { key: 'received', label: 'Order received', done: !cancelled, stopped: cancelled, detail: cancelled ? 'Cancelled' : po.poNumber },
    { key: 'ack', label: 'Acknowledged', done: !!po.isAcknowledged || DELIVERED.includes(po.status) },
    {
      key: 'delivered',
      label: 'Delivered',
      done: po.status === 'completed',
      detail: po.status === 'partially_received' ? 'Partly delivered' : undefined,
      to: DELIVERED.includes(po.status) ? '/app/my-deliveries' : undefined
    },
    {
      key: 'invoiced',
      label: 'Invoiced',
      done: !!inv && INVOICED.includes(inv.status),
      stopped: inv?.status === 'rejected',
      detail: inv ? (inv.status === 'rejected' ? 'Invoice rejected' : inv.invoiceNumber) : undefined,
      to: inv ? '/app/my-invoices' : undefined
    },
    {
      key: 'paid',
      label: 'Paid',
      done: inv?.status === 'paid',
      detail: inv?.status === 'partially_paid' ? 'Part paid' : inv?.status === 'variance' ? 'Under query' : undefined
    }
  ]);
}

/** The one thing the supplier does next on an order, if anything. */
export function supplierPoNext(po: any): { title: string; description?: string; waiting?: boolean; action?: 'acknowledge' | 'invoice' | 'deliveries' } | null {
  const inv = po.invoice;
  if (['cancelled', 'rejected'].includes(po.status)) return null;
  if (!po.isAcknowledged && ['approved', 'issued'].includes(po.status)) {
    return { title: 'Acknowledge this order', description: 'Confirm you have received it and when you will deliver.', action: 'acknowledge' };
  }
  if (!DELIVERED.includes(po.status)) {
    return { title: 'Deliver the goods', description: 'Stores record the delivery and issue a GRV when the goods arrive.', action: 'deliveries' };
  }
  if (!inv || inv.status === 'rejected' || inv.status === 'draft') {
    return {
      title: inv?.status === 'rejected' ? 'Submit a corrected invoice' : 'Submit your invoice',
      description: 'Bill what was delivered. It is matched against this order and the goods received.',
      action: 'invoice'
    };
  }
  if (inv.status === 'paid') return null;
  return {
    title: inv.status === 'variance' ? 'Finance to resolve a difference on your invoice' : 'Finance to approve and pay your invoice',
    description: `${inv.invoiceNumber} is with Finance.`,
    waiting: true
  };
}

/** A delivery against one of the supplier's orders. */
export function supplierDeliveryJourney(d: any) {
  const s = d.status as string;
  const received = s !== 'pending';
  const decided = ['accepted', 'partially_accepted', 'rejected'].includes(s);
  return toSteps([
    { key: 'ordered', label: 'Order acknowledged', done: true, detail: d.purchaseOrder?.poNumber, to: '/app/my-purchase-orders' },
    { key: 'received', label: 'Received by Stores', done: received, detail: received ? d.grvNumber || d.deliveryNumber : undefined },
    { key: 'inspected', label: 'Inspected', done: s === 'inspected' || decided },
    {
      key: 'accepted',
      label: 'Accepted',
      done: s === 'accepted' || s === 'partially_accepted',
      stopped: s === 'rejected',
      detail: s === 'partially_accepted' ? 'Partly accepted' : s === 'rejected' ? 'Rejected' : undefined
    }
  ]);
}

/** One of the supplier's invoices: submitted, matched, approved, paid. */
export function supplierInvoiceJourney(inv: any) {
  const s = inv.status as string;
  const approved = ['approved', 'partially_paid', 'paid'].includes(s);
  return toSteps([
    { key: 'submitted', label: 'Submitted', done: s !== 'draft', detail: inv.invoiceNumber },
    {
      key: 'match',
      label: 'Three-way match',
      done: approved,
      stopped: s === 'rejected' || s === 'cancelled',
      detail: s === 'variance' ? 'Difference found' : s === 'rejected' ? 'Rejected' : s === 'cancelled' ? 'Cancelled' : undefined
    },
    { key: 'approved', label: 'Approved', done: approved },
    { key: 'paid', label: 'Paid', done: s === 'paid', detail: s === 'partially_paid' ? 'Part paid' : undefined }
  ]);
}

/** The supplier's latest request to change their bank details. */
export function supplierBankChangeJourney(req: any) {
  const s = req.status as string;
  const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-ZA') : undefined);
  return toSteps([
    { key: 'requested', label: 'Requested', done: true, detail: day(req.requestedAt) },
    {
      key: 'callback',
      label: 'Callback verified',
      done: !!req.verifiedAt || s === 'pending_approval' || s === 'approved',
      stopped: s === 'cancelled' || (s === 'rejected' && !req.verifiedAt),
      detail: s === 'cancelled' ? 'Cancelled' : s === 'rejected' && !req.verifiedAt ? 'Rejected' : day(req.verifiedAt)
    },
    {
      key: 'approved',
      label: 'Approved',
      done: s === 'approved',
      stopped: s === 'rejected',
      detail: s === 'approved' ? day(req.approvedAt) : s === 'rejected' ? 'Rejected' : undefined
    },
    { key: 'active', label: 'In use for payments', done: s === 'approved' }
  ]);
}

/** Supplier onboarding: registered, documents uploaded, verified, activated. */
export function supplierOnboardingJourney(profile: any, requiredUploaded: number, requiredTotal: number, requiredVerified: number) {
  const status = profile?.status as string;
  const active = status === 'active';
  const barred = status === 'suspended' || status === 'blacklisted';
  const uploaded = requiredUploaded >= requiredTotal || active || !!profile?.kysExempt;
  const verified = (requiredTotal > 0 && requiredVerified >= requiredTotal) || !!profile?.kysComplete || !!profile?.kysExempt || active;
  return toSteps([
    { key: 'registered', label: 'Registered', done: true, detail: profile?.companyName },
    { key: 'uploaded', label: 'Documents uploaded', done: uploaded, detail: uploaded ? undefined : `${requiredUploaded}/${requiredTotal} mandatory` },
    { key: 'verified', label: 'Verified by Procurement', done: verified, detail: profile?.kysExempt ? 'Exempt' : undefined },
    {
      key: 'active',
      label: 'Account active',
      done: active,
      stopped: barred,
      detail: barred ? (status === 'suspended' ? 'Suspended' : 'Blacklisted') : status === 'dormant' ? 'Dormant' : undefined
    }
  ]);
}
