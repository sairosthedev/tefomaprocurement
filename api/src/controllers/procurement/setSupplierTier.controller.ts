import type { Request, Response } from 'express';
import { SUPPLIER_TIERS, computeKysCompletionForTier, getNextReviewDate, getReviewIntervalMonths } from '@fossil/shared';
import { SupplierProfile, PurchaseOrder } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const VALID_TIERS = SUPPLIER_TIERS.map((t) => t.key).filter((k) => k !== 'unclassified');

/**
 * Assign a supplier's diligence tier.
 *
 * The tier is set by a person, with a recorded reason — a supplier's
 * criticality is a business judgement, not something to infer from spend
 * alone. `GET .../tier-suggestion` offers a starting point based on
 * 12-month spend and category, which the assessor can accept or override.
 */
export const setSupplierTier = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { tier, reason } = req.body as { tier?: string; reason?: string };

    if (!tier || !VALID_TIERS.includes(tier as any)) {
      return res.status(400).json({
        success: false,
        message: `Invalid tier. Allowed values: ${VALID_TIERS.join(', ')}`
      });
    }
    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required when setting a supplier tier'
      });
    }

    const supplier = await SupplierProfile.findById(id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const previousTier = supplier.tier;
    supplier.tier = tier as any;
    supplier.tierReason = reason.trim();
    supplier.tierSetBy = req.user!._id;
    supplier.tierSetAt = new Date();

    // Required KYS depth follows the tier, so completeness is recomputed here.
    const completion = computeKysCompletionForTier(
      supplier.kysChecklist as Record<string, boolean>,
      tier
    );
    supplier.kysComplete = completion.isComplete;

    // Review cadence follows the tier too. Only ever bring the next review
    // FORWARD: promoting a supplier to a tighter cycle should take effect now,
    // but reclassifying one downwards must not silently buy them a longer
    // leash than the review they were already due.
    const tierDue = getNextReviewDate(tier, supplier.lastEvaluationAt || undefined);
    if (!supplier.nextEvaluationDue || tierDue < supplier.nextEvaluationDue) {
      supplier.nextEvaluationDue = tierDue;
    }

    await supplier.save();

    await createAuditLog({
      action: 'update',
      entity: 'SupplierProfile',
      entityId: supplier._id,
      user: req.user,
      description: `Set ${supplier.companyName} to ${tier} tier. Reason: ${reason.trim()}`,
      previousData: { tier: previousTier },
      newData: {
        tier,
        kysComplete: supplier.kysComplete,
        reviewIntervalMonths: getReviewIntervalMonths(tier),
        nextEvaluationDue: supplier.nextEvaluationDue
      },
      req
    });

    res.status(200).json({
      success: true,
      message: `Supplier classified as ${tier}. Reviewed every ${getReviewIntervalMonths(tier)} month(s).`,
      data: { supplier, completion, reviewIntervalMonths: getReviewIntervalMonths(tier) }
    });
  } catch (error: any) {
    console.error('Set supplier tier error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Suggest a tier from 12-month spend and category breadth. Advisory only —
 * the assessor decides, exactly as with bid recommendations.
 */
export const getSupplierTierSuggestion = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const supplier = await SupplierProfile.findById(id).select('companyName categories tier');
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const spendRows = await PurchaseOrder.aggregate([
      {
        $match: {
          supplier: supplier._id,
          isDeleted: { $ne: true },
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
    ]);

    const spend = spendRows[0]?.total || 0;
    const orders = spendRows[0]?.orders || 0;

    // Deliberately simple and explainable, so a reviewer can disagree with it.
    let suggested: string;
    let rationale: string;
    if (orders === 0) {
      suggested = 'transactional';
      rationale = 'No purchase orders in the last 12 months — no evidence of reliance yet.';
    } else if (spend >= 100000) {
      suggested = 'strategic';
      rationale = `High 12-month spend (${spend.toFixed(2)}) across ${orders} order(s).`;
    } else if (spend >= 20000 || orders >= 10) {
      suggested = 'tactical';
      rationale = `Regular trading: ${orders} order(s), ${spend.toFixed(2)} in 12 months.`;
    } else {
      suggested = 'transactional';
      rationale = `Low volume: ${orders} order(s), ${spend.toFixed(2)} in 12 months.`;
    }

    res.status(200).json({
      success: true,
      data: {
        suggested,
        rationale,
        currentTier: supplier.tier,
        spendLast12Months: spend,
        orderCount: orders,
        note: 'Advisory only. Sole-source or business-stopping suppliers should be set critical regardless of spend.'
      }
    });
  } catch (error: any) {
    console.error('Supplier tier suggestion error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
