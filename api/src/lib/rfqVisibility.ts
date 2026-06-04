/**
 * Sealed-bid rules.
 *
 * While an RFQ is "ongoing" (open AND before its submission deadline), the
 * bids/quotations submitted by suppliers must remain hidden from procurement
 * so they cannot influence or leak the competition. Bids become visible once
 * the RFQ is no longer accepting submissions.
 */

export function isRfqSealed(rfq: any): boolean {
  if (!rfq) return false;
  if (rfq.status !== 'open') return false;
  const deadline = rfq.submissionDeadline ? new Date(rfq.submissionDeadline) : null;
  if (!deadline) return true;
  return Date.now() < deadline.getTime();
}

/**
 * Admins can always see bids (oversight). Everyone else is subject to the
 * sealed-bid rule for the given RFQ.
 */
export function canSeeBids(user: any, rfq: any): boolean {
  if (user?.role === 'admin') return true;
  return !isRfqSealed(rfq);
}
