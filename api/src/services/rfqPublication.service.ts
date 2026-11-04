import { notifySupplier } from './notification.service.js';
import { partitionEligibleSuppliers } from './supplierEligibility.service.js';

/**
 * The work done when an RFQ goes out to suppliers.
 *
 * An RFQ can open three ways: published from a draft, created already open
 * from the Create RFQ drawer, or raised by re-sourcing a split award's leftover
 * lines. Only the first used to tell anyone, so suppliers invited the other two
 * ways never heard of the RFQ. Every path now runs the same two steps:
 * re-check who may still be invited, then notify exactly those suppliers.
 */

/** Deadlines are read by suppliers in Zimbabwe, not in the server's UTC. */
const DEADLINE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Harare',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/** A submission deadline as suppliers should read it, e.g. "5 Nov 2026, 17:00". */
export function formatRfqDeadline(deadline: any): string {
  const date = deadline ? new Date(deadline) : null;
  if (!date || Number.isNaN(date.getTime())) return 'not set';
  return DEADLINE_FORMAT.format(date);
}

export type InviteePartition = Awaited<ReturnType<typeof partitionEligibleSuppliers>>;

/** Split an RFQ's invitation list into suppliers who may receive it now and those who may not. */
export function partitionRfqInvitees(rfq: any): Promise<InviteePartition> {
  // One supplier listed twice is still one supplier to tell.
  const byId = new Map<string, any>();
  for (const inv of rfq.invitedSuppliers || []) {
    const id = inv.supplier?._id || inv.supplier;
    if (id) byId.set(String(id), id);
  }
  return partitionEligibleSuppliers([...byId.values()], 'invite');
}

/**
 * Notify each eligible invitee that the RFQ is open. Call once per RFQ, at the
 * moment it opens: the callers each own a single draft→open or create-open
 * transition, which is what keeps suppliers from being told twice.
 *
 * Pass the partition when the caller already took it to decide whether to
 * open the RFQ at all; otherwise it is taken here.
 */
export async function announceOpenRfq(
  rfq: any,
  relatedUser: any,
  partition?: InviteePartition
): Promise<InviteePartition> {
  const result = partition ?? (await partitionRfqInvitees(rfq));
  const deadline = formatRfqDeadline(rfq.submissionDeadline);

  await Promise.all(
    result.eligible.map((supplierId: any) =>
      notifySupplier(supplierId, {
        type: 'rfq_published',
        title: 'New RFQ Published',
        message: `A new RFQ ${rfq.rfqNumber} has been published. Submission deadline: ${deadline}`,
        entity: 'RFQ',
        entityId: rfq._id,
        relatedUser,
        metadata: {
          deadline: rfq.submissionDeadline,
          rfqNumber: rfq.rfqNumber
        }
      })
    )
  );

  return result;
}
