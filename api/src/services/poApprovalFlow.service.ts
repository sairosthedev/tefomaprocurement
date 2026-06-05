import type { IPurchaseOrder } from '../models/PurchaseOrder.model.js';
import { COO_APPROVAL_THRESHOLD_USD } from '@fosssil/shared';

export function requiresCooApproval(totalAmount: number, currency = 'USD'): boolean {
  // Procedure §6.3.11 — COO for amounts above USD 5,000
  if (currency.toUpperCase() !== 'USD') {
    // Non-USD: apply threshold as-is until multi-currency rules are defined
    return totalAmount >= COO_APPROVAL_THRESHOLD_USD;
  }
  return totalAmount >= COO_APPROVAL_THRESHOLD_USD;
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
    if (requiresCooApproval(po.totalAmount) && !po.cooApproved) return 'coo';
    return 'complete';
  }

  if (po.status === 'pending_hod') return 'hod';
  if (po.status === 'pending_finance') return 'finance';
  if (po.status === 'pending_coo') return 'coo';

  return 'complete';
}

export function allRequiredApprovalsComplete(po: IPurchaseOrder): boolean {
  if (!po.hodApproved || !po.financeApproved) return false;
  if (requiresCooApproval(po.totalAmount) && !po.cooApproved) return false;
  return true;
}

export function nextStatusAfterApproval(po: IPurchaseOrder): IPurchaseOrder['status'] {
  if (!po.hodApproved) return 'pending_hod';
  if (!po.financeApproved) return 'pending_finance';
  if (requiresCooApproval(po.totalAmount) && !po.cooApproved) return 'pending_coo';
  return 'approved';
}
