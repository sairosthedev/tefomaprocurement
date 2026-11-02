/**
 * Wording for the COO approval step.
 *
 * Whether a PO needs the COO is decided on the server (`po.requiresCooApproval`)
 * by converting the SBU's USD limit at a stored exchange rate; the client only
 * describes that decision and never recomputes it.
 */
const DEFAULT_COO_THRESHOLD_USD = 5000;

const usd = (amount: number, fractionDigits = 0) =>
  `USD ${amount.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })}`;

/** "USD 5,000" — the PO's COO limit as stored on it, or the group default. */
export function cooThresholdLabel(po?: { cooThresholdUsd?: number | null } | null): string {
  const threshold =
    typeof po?.cooThresholdUsd === 'number' ? po.cooThresholdUsd : DEFAULT_COO_THRESHOLD_USD;
  return usd(threshold);
}

/** "≈ USD 1,234.56" for a non-USD PO with a stored USD equivalent, otherwise null. */
export function usdEquivalentLabel(
  po?: { currency?: string | null; totalAmountUsd?: number | null } | null
): string | null {
  if (!po || !po.currency || po.currency.toUpperCase() === 'USD') return null;
  if (typeof po.totalAmountUsd !== 'number') return null;
  return `≈ ${usd(po.totalAmountUsd, 2)}`;
}

/** For screens shown before a PO exists. */
export const COO_POLICY_NOTE = `COO approval applies at ${usd(
  DEFAULT_COO_THRESHOLD_USD
)} equivalent and above (converted at the group FX rate).`;
