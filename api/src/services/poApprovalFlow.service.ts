import type { IPurchaseOrder } from '../models/PurchaseOrder.model.js';
import { toUsd } from './fx.service.js';
import { getCooThresholdUsd } from './sbuSettings.service.js';

export interface CooAssessment {
  required: boolean;
  /** The SBU's COO limit, in USD. */
  thresholdUsd: number;
  /** The PO total in USD, or null when there is no FX rate for its currency. */
  amountUsd: number | null;
  /** Units of the PO currency per USD that were applied. */
  fxRateToUsd: number | null;
}

/**
 * Whether a PO needs COO sign-off. The limit is set in USD per SBU and the PO
 * total is converted at the stored FX rate, so a R60,000 order is measured as
 * the ~USD 3,300 it is rather than as 60,000 dollars.
 *
 * With no rate on file for the currency the PO goes to the COO: an unknown
 * conversion must not let an order skip the highest approval.
 */
export async function assessCooRequirement(totalAmount: number, currency = 'USD'): Promise<CooAssessment> {
  const thresholdUsd = await getCooThresholdUsd();
  const conversion = await toUsd(totalAmount || 0, currency);

  if (!conversion) {
    return { required: true, thresholdUsd, amountUsd: null, fxRateToUsd: null };
  }

  return {
    required: conversion.amountUsd >= thresholdUsd,
    thresholdUsd,
    amountUsd: conversion.amountUsd,
    fxRateToUsd: conversion.rate
  };
}

/** Assess the PO and record the outcome, with the rate and limit used, on it. */
export async function applyCooAssessment(po: IPurchaseOrder): Promise<CooAssessment> {
  const assessment = await assessCooRequirement(po.totalAmount, po.currency);
  po.requiresCooApproval = assessment.required;
  po.cooThresholdUsd = assessment.thresholdUsd;
  po.totalAmountUsd = assessment.amountUsd ?? undefined;
  po.fxRateToUsd = assessment.fxRateToUsd ?? undefined;
  return assessment;
}

/** Plain-language reason for the COO decision, for messages and notifications. */
export function describeCooAssessment(po: Pick<IPurchaseOrder, 'currency' | 'requiresCooApproval' | 'totalAmountUsd' | 'cooThresholdUsd'>): string {
  const limit = `USD ${(po.cooThresholdUsd ?? 0).toLocaleString('en-US')}`;
  if (po.requiresCooApproval && po.currency !== 'USD' && po.totalAmountUsd == null) {
    return `no ${po.currency} exchange rate on file, so COO approval applies`;
  }
  if (po.currency !== 'USD' && po.totalAmountUsd != null) {
    const usd = `USD ${po.totalAmountUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return po.requiresCooApproval ? `≈ ${usd}, at or above ${limit}` : `≈ ${usd}, below ${limit}`;
  }
  return po.requiresCooApproval ? `at or above ${limit}` : `below ${limit}`;
}

export type PoApprovalStage = 'hod' | 'finance' | 'coo' | 'complete';

export function getPoApprovalStage(po: IPurchaseOrder): PoApprovalStage {
  if (po.status === 'approved' || po.status === 'issued' || po.status === 'partially_received' || po.status === 'completed') {
    return 'complete';
  }

  // Legacy parallel approval POs
  if (po.status === 'pending_approvals') {
    if (!po.hodApproved) return 'hod';
    if (!po.financeApproved) return 'finance';
    if (po.requiresCooApproval && !po.cooApproved) return 'coo';
    return 'complete';
  }

  if (po.status === 'pending_hod') return 'hod';
  if (po.status === 'pending_finance') return 'finance';
  if (po.status === 'pending_coo') return 'coo';

  return 'complete';
}

export function allRequiredApprovalsComplete(po: IPurchaseOrder): boolean {
  if (!po.hodApproved || !po.financeApproved) return false;
  if (po.requiresCooApproval && !po.cooApproved) return false;
  return true;
}

export function nextStatusAfterApproval(po: IPurchaseOrder): IPurchaseOrder['status'] {
  if (!po.hodApproved) return 'pending_hod';
  if (!po.financeApproved) return 'pending_finance';
  if (po.requiresCooApproval && !po.cooApproved) return 'pending_coo';
  return 'approved';
}
