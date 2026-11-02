import type { WorkflowStep } from '../components/WorkflowStepper';
import { PO_WAITING_ON } from './purchaseOrderSteps';

/**
 * One purchase, from requisition to goods in stores, worked out from the
 * requisition record (with its RFQ sourcing progress and purchase order as the
 * requisition detail endpoint returns them).
 */

export interface JourneyViewer {
  isOwner: boolean;
  isDepartment: boolean;
  isProcurement: boolean;
  isProcurementHead: boolean;
  isStores: boolean;
}

export interface JourneyNext {
  title: string;
  description?: string;
  /** Someone else's step: shown as "waiting on". */
  waiting?: boolean;
  action?: { label: string; to?: string; key?: 'submit' | 'accept' | 'createRfq' };
}

const PO_ISSUED = ['issued', 'partially_received', 'completed'];


const STEP_LABELS = [
  'Requisition',
  'HOD approval',
  'Stores check',
  'Procurement',
  'RFQ & quotes',
  'Award',
  'Purchase order',
  'Delivery'
];

/** Index of the step the purchase is on; STEP_LABELS.length once delivered. */
function stageOf(req: any): number {
  const po = req.purchaseOrder;
  const sourcing = req.rfq?.sourcing;
  if (req.itemsDeliveredToStores) return 8;
  if (po && PO_ISSUED.includes(po.status)) return 7;
  if (po) return 6;
  if (sourcing?.authorized) return 6;
  if (sourcing && ['closed', 'evaluating', 'awarded'].includes(sourcing.status)) return 5;
  if (req.rfq) return 4;

  switch (req.status) {
    case 'draft':
      return 0;
    case 'pending_hod':
      return 1;
    case 'stores_review':
      return 2;
    case 'pending_acceptance':
      return 3;
    case 'rejected':
      // Rejected before stores ever saw it means the department head refused it.
      return req.storesReviewedBy ? 3 : 1;
    case 'cancelled':
      if (req.storesReviewedBy) return 3;
      return req.hodApprovedBy ? 2 : 1;
    default:
      return 4;
  }
}

export function requisitionJourney(req: any, viewer: JourneyViewer): { steps: WorkflowStep[]; next: JourneyNext | null } {
  const stopped = req.status === 'rejected' || req.status === 'cancelled';

  // Issued from stock: the purchase ends at the stores check.
  if (req.status === 'fulfilled') {
    return {
      steps: STEP_LABELS.slice(0, 3).map((label, i) => ({
        key: label,
        label,
        state: 'done' as const,
        detail: i === 0 ? req.requisitionNumber : i === 2 ? 'Issued from stock' : undefined
      })),
      next: null
    };
  }

  const stage = stageOf(req);
  const rfq = req.rfq;
  const sourcing = rfq?.sourcing;
  const po = req.purchaseOrder;
  const rfqLink = viewer.isProcurement && rfq ? `/app/rfqs/${rfq._id}` : undefined;
  const poLink = viewer.isProcurement && po ? `/app/purchase-orders/${po._id}` : undefined;

  const details: Array<{ detail?: string; to?: string }> = [
    { detail: req.requisitionNumber },
    { detail: req.hodApprovedBy ? `${req.hodApprovedBy.firstName || ''} ${req.hodApprovedBy.lastName || ''}`.trim() : undefined },
    { detail: req.storesReviewedBy ? 'Not in stock' : undefined },
    { detail: stage > 3 ? 'Accepted' : undefined },
    { detail: rfq?.rfqNumber, to: rfqLink },
    {
      detail: sourcing?.winner?.supplierName || (sourcing?.lines ? `${sourcing.lines.awarded}/${sourcing.lines.total} lines` : undefined),
      to: viewer.isProcurement && sourcing?.lines && rfq ? `/app/rfqs/${rfq._id}/award` : viewer.isProcurement && sourcing?.winner ? `/app/quotations/${sourcing.winner.quotationId}` : undefined
    },
    { detail: po?.poNumber, to: poLink },
    { detail: req.itemsDeliveredToStores ? 'In stores' : undefined }
  ];

  const steps: WorkflowStep[] = STEP_LABELS.map((label, i) => ({
    key: label,
    label,
    state: i < stage ? 'done' : i === stage ? (stopped ? 'stopped' : 'current') : 'upcoming',
    detail: i === stage && stopped ? (req.status === 'rejected' ? 'Rejected' : 'Cancelled') : details[i].detail,
    to: details[i].to
  }));

  if (stopped) return { steps, next: null };

  return { steps, next: nextFor(req, stage, viewer) };
}

function nextFor(req: any, stage: number, v: JourneyViewer): JourneyNext | null {
  const rfq = req.rfq;
  const sourcing = rfq?.sourcing;
  const po = req.purchaseOrder;

  switch (stage) {
    case 0:
      return v.isOwner
        ? { title: 'Submit the requisition', description: 'It goes to your department head for approval.', action: { label: 'Submit for approval', key: 'submit' } }
        : { title: 'The requester to submit it', waiting: true };
    case 1:
      return v.isDepartment
        ? { title: 'Approve or reject this requisition', description: 'Approved requisitions go to Stores for a stock check.', action: { label: 'Open approvals', to: '/app/approvals' } }
        : { title: 'Department head approval', waiting: true };
    case 2:
      return v.isStores
        ? { title: 'Check stock for this requisition', description: 'Issue it from stock, or forward it to Procurement.', action: { label: 'Open stores review', to: '/app/stores-pr-review' } }
        : { title: 'Stores to check stock', waiting: true };
    case 3:
      return v.isProcurement
        ? { title: 'Accept this requisition for sourcing', description: 'The RFQ form opens next, with this requisition filled in.', action: { label: 'Accept and create RFQ', key: 'accept' } }
        : { title: 'Procurement to accept it for sourcing', waiting: true };
    case 4:
      if (!rfq) {
        return v.isProcurement
          ? { title: 'Create the RFQ', description: 'Invite suppliers to quote for these items.', action: { label: 'Create RFQ', key: 'createRfq' } }
          : { title: 'Procurement to send out an RFQ', waiting: true };
      }
      if (sourcing?.status === 'draft') {
        return v.isProcurement
          ? { title: 'Publish the RFQ', description: `${rfq.rfqNumber} is still a draft. Suppliers see it once it is published.`, action: { label: 'Open RFQ', to: `/app/rfqs/${rfq._id}` } }
          : { title: 'Procurement to publish the RFQ', waiting: true };
      }
      return {
        title: 'Suppliers are quoting',
        description: rfq.submissionDeadline
          ? `Quotes close on ${new Date(rfq.submissionDeadline).toLocaleDateString()}. ${sourcing?.quotationCount ?? 0} received so far.`
          : undefined,
        waiting: true,
        action: v.isProcurement ? { label: 'Open RFQ', to: `/app/rfqs/${rfq._id}` } : undefined
      };
    case 5: {
      const awardTo = sourcing?.lines ? `/app/rfqs/${rfq._id}/award` : `/app/rfqs/${rfq._id}`;
      if (sourcing?.winner || (sourcing?.lines && sourcing.lines.awarded > 0)) {
        return v.isProcurementHead
          ? { title: 'Authorize the award', description: 'Procurement has selected the winning quote.', action: { label: 'Review award', to: sourcing?.lines ? awardTo : `/app/quotations/${sourcing.winner.quotationId}` } }
          : { title: 'Head of Procurement to authorize the award', waiting: true };
      }
      return v.isProcurement
        ? { title: 'Compare the quotes and pick a winner', description: `${sourcing?.quotationCount ?? 0} quotes received.`, action: { label: sourcing?.lines ? 'Open award matrix' : 'Compare quotes', to: awardTo } }
        : { title: 'Procurement to evaluate the quotes', waiting: true };
    }
    case 6:
      if (!po) {
        const to = sourcing?.lines ? `/app/rfqs/${rfq._id}/award` : sourcing?.winner ? `/app/quotations/${sourcing.winner.quotationId}` : `/app/rfqs/${rfq?._id}`;
        return v.isProcurement
          ? { title: 'Raise the purchase order', description: 'The award is authorized. Create the PO from the winning quote.', action: { label: 'Create purchase order', to } }
          : { title: 'Procurement to raise the purchase order', waiting: true };
      }
      if (po.status === 'draft' && v.isProcurement) {
        return { title: 'Submit the purchase order for approval', action: { label: 'Open purchase order', to: `/app/purchase-orders/${po._id}` } };
      }
      return {
        title: PO_WAITING_ON[po.status] || 'Purchase order approval',
        description: `${po.poNumber} is in its approval chain.`,
        waiting: true,
        action: v.isProcurement ? { label: 'Open purchase order', to: `/app/purchase-orders/${po._id}` } : undefined
      };
    case 7:
      return v.isStores
        ? { title: 'Receive the goods', description: `Record the delivery against ${po.poNumber} when it arrives.`, action: { label: 'Open deliveries', to: '/app/deliveries' } }
        : { title: 'Supplier to deliver, and Stores to receive the goods', description: po ? `${po.poNumber} has been issued to the supplier.` : undefined, waiting: true };
    default:
      return null;
  }
}
