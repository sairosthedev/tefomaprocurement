import type { Request, Response } from 'express';
import { DepartmentBudget } from '../../models/index.js';
import { createAuditLog } from '../../middleware/index.js';

const upsertDepartmentBudget = async (req: Request, res: Response): Promise<any> => {
  try {
    const { departmentId, fiscalYear, allocatedAmount, notes } = req.body;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department is required' });
    }

    const year = Number(fiscalYear) || new Date().getFullYear();
    const amount = Number(allocatedAmount);

    if (Number.isNaN(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: 'Allocated amount must be a non-negative number' });
    }

    const budget = await DepartmentBudget.findOneAndUpdate(
      { department: departmentId, fiscalYear: year, isDeleted: false },
      {
        department: departmentId,
        fiscalYear: year,
        allocatedAmount: amount,
        notes: notes?.trim() || undefined
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await createAuditLog({
      action: 'update',
      entity: 'DepartmentBudget',
      entityId: budget._id,
      user: req.user,
      description: `Set department budget for ${year} to ${amount}`,
      req
    });

    res.status(200).json({ success: true, data: budget });
  } catch (error) {
    console.error('Upsert department budget error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export default upsertDepartmentBudget;
