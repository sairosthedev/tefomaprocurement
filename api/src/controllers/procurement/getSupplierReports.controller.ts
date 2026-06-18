import type { Request, Response } from 'express';
import { SupplierProfile, PurchaseOrder, SupplierEvaluation } from '../../models/index.js';

const PO_SPEND_STATUSES = ['approved', 'issued', 'partially_received', 'completed'] as const;

const getSupplierReports = async (req: Request, res: Response): Promise<any> => {
  try {
    const [suppliers, purchaseOrders, evaluations] = await Promise.all([
      SupplierProfile.find({ isDeleted: false })
        .select(
          'companyName status kysComplete kysExempt categories lastEvaluationAt nextEvaluationDue createdAt complianceDocuments registrationNumber'
        )
        .sort({ companyName: 1 })
        .lean(),
      PurchaseOrder.find({ isDeleted: false, status: { $in: PO_SPEND_STATUSES } })
        .select('supplier totalAmount status')
        .lean(),
      SupplierEvaluation.find({ isDeleted: false })
        .select('supplier status overallScore recommendation createdAt')
        .lean()
    ]);

    const spendBySupplier = new Map<string, { poCount: number; totalSpend: number }>();
    for (const po of purchaseOrders) {
      const id = po.supplier?.toString();
      if (!id) continue;
      const current = spendBySupplier.get(id) || { poCount: 0, totalSpend: 0 };
      current.poCount += 1;
      current.totalSpend += Number(po.totalAmount) || 0;
      spendBySupplier.set(id, current);
    }

    const evalsBySupplier = new Map<string, number>();
    const latestScoreBySupplier = new Map<string, number>();
    for (const evaluation of evaluations) {
      const id = evaluation.supplier?.toString();
      if (!id) continue;
      evalsBySupplier.set(id, (evalsBySupplier.get(id) || 0) + 1);
      const evalScore = Number(evaluation.overallScore) || 0;
      if (evalScore > 0) {
        latestScoreBySupplier.set(id, Math.max(latestScoreBySupplier.get(id) || 0, evalScore));
      }
    }

    const now = new Date();
    let kysVerified = 0;
    let kysPending = 0;
    const statusCounts: Record<string, number> = {};
    const scores: number[] = [];

    const registry = suppliers.map((supplier) => {
      const id = supplier._id.toString();
      const spend = spendBySupplier.get(id) || { poCount: 0, totalSpend: 0 };
      const verified = Boolean(supplier.kysComplete);

      statusCounts[supplier.status] = (statusCounts[supplier.status] || 0) + 1;
      if (verified) kysVerified += 1;
      else if (supplier.status !== 'blacklisted') kysPending += 1;

      const score = latestScoreBySupplier.get(id) || 0;
      if (score > 0) scores.push(score);

      const docCount = Array.isArray(supplier.complianceDocuments)
        ? supplier.complianceDocuments.length
        : 0;

      return {
        _id: id,
        companyName: supplier.companyName,
        registrationNumber: supplier.registrationNumber || '',
        status: supplier.status,
        kysComplete: verified,
        kysExempt: Boolean(supplier.kysExempt),
        overallScore: score,
        categories: supplier.categories || [],
        documentCount: docCount,
        poCount: spend.poCount,
        poSpend: spend.totalSpend,
        evaluationCount: evalsBySupplier.get(id) || 0,
        lastEvaluationAt: supplier.lastEvaluationAt || null,
        nextEvaluationDue: supplier.nextEvaluationDue || null,
        reviewOverdue: supplier.nextEvaluationDue
          ? new Date(supplier.nextEvaluationDue) <= now
          : !supplier.lastEvaluationAt
      };
    });

    const evaluationsByStatus: Record<string, number> = {};
    for (const evaluation of evaluations) {
      evaluationsByStatus[evaluation.status] = (evaluationsByStatus[evaluation.status] || 0) + 1;
    }

    const topBySpend = [...registry]
      .filter((row) => row.poSpend > 0)
      .sort((a, b) => b.poSpend - a.poSpend)
      .slice(0, 10)
      .map((row) => ({
        supplierId: row._id,
        companyName: row.companyName,
        poCount: row.poCount,
        totalSpend: row.poSpend
      }));

    const topByScore = [...registry]
      .filter((row) => row.overallScore > 0)
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 10)
      .map((row) => ({
        supplierId: row._id,
        companyName: row.companyName,
        score: row.overallScore
      }));

    const totalPoSpend = purchaseOrders.reduce((sum, po) => sum + (Number(po.totalAmount) || 0), 0);
    const dueForReview = registry.filter((row) => row.reviewOverdue && row.status !== 'blacklisted').length;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalSuppliers: suppliers.length,
          active: statusCounts.active || 0,
          pending: statusCounts.pending || 0,
          dormant: statusCounts.dormant || 0,
          blacklisted: statusCounts.blacklisted || 0,
          kysVerified,
          kysPending,
          averageScore: scores.length
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : 0,
          totalPoSpend,
          poCount: purchaseOrders.length,
          evaluationsTotal: evaluations.length,
          evaluationsPending:
            (evaluationsByStatus.pending_hod || 0) + (evaluationsByStatus.pending_sec || 0),
          dueForReview
        },
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        evaluationsByStatus: Object.entries(evaluationsByStatus).map(([status, count]) => ({
          status,
          count
        })),
        topBySpend,
        topByScore,
        registry
      }
    });
  } catch (error) {
    console.error('Get supplier reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getSupplierReports;
