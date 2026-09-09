import type { Request, Response } from 'express';
import { Department } from '../../models/index.js';
import { getBudgetPositions } from '../../services/budget.service.js';

/**
 * Budget position for every active department in a fiscal year (BRD FR-B2).
 *
 * The figures come from budget.service so this page and the check that runs
 * when a requisition is submitted always agree.
 */
const getBudgets = async (req: Request, res: Response): Promise<any> => {
  try {
    const fiscalYear = Number(req.query.fiscalYear) || new Date().getFullYear();

    const departments = await Department.find({ isDeleted: false, status: 'active' })
      .sort({ name: 1 })
      .lean();

    const departmentRows = await getBudgetPositions(
      departments.map((d) => ({ _id: d._id, name: d.name, code: (d as { code?: string }).code })),
      fiscalYear
    );

    const totalBudget = departmentRows.reduce((sum, d) => sum + d.budget, 0);
    const utilised = departmentRows.reduce((sum, d) => sum + d.utilised, 0);
    const committed = departmentRows.reduce((sum, d) => sum + d.committed, 0);
    const available = totalBudget - utilised - committed;

    res.status(200).json({
      success: true,
      data: {
        fiscalYear,
        totalBudget,
        // `utilized` is kept alongside the corrected spelling so an older client
        // bundle does not read undefined and render NaN mid-deploy.
        utilized: utilised,
        utilised,
        committed,
        available,
        departmentsOverBudget: departmentRows.filter((d) => d.isOverBudget).length,
        departments: departmentRows.map((d) => ({ ...d, utilized: d.utilised }))
      }
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default getBudgets;
