'use strict';

/**
 * Sealed-bid rules.
 *
 * While an RFQ is "ongoing" (open AND before its submission deadline), the
 * bids/quotations submitted by suppliers must remain hidden from procurement
 * so they cannot influence or leak the competition. Bids become visible once
 * the RFQ is no longer accepting submissions:
 *   - the submission deadline has passed, OR
 *   - the RFQ has been explicitly closed/evaluated/awarded.
 */

function isRfqSealed(rfq) {
  if (!rfq) return false;
  if (rfq.status !== 'open') return false; // draft has no bids; closed/evaluating/awarded => revealed
  const deadline = rfq.submissionDeadline ? new Date(rfq.submissionDeadline) : null;
  if (!deadline) return true;
  return Date.now() < deadline.getTime();
}

/**
 * Admins can always see bids (oversight). Everyone else is subject to the
 * sealed-bid rule for the given RFQ.
 */
function canSeeBids(user, rfq) {
  if (user?.role === 'admin') return true;
  return !isRfqSealed(rfq);
}

module.exports = { isRfqSealed, canSeeBids };
