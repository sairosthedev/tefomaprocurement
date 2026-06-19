import type { Request, Response } from 'express';
import { Department, User } from '../../models/index.js';

const getDepartments = async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, page = 1, limit = 20 } = req.query as any;

    const query: any = { isDeleted: false };
    if (status) query.status = status;

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [total, departments] = await Promise.all([
      Department.countDocuments(query),
      Department.find(query)
        .populate('head', 'firstName lastName email')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    // Calculate user count for each department
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const userCount = await User.countDocuments({
          department: dept._id,
          isDeleted: false
        });

        return {
          ...dept.toObject(),
          userCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: departmentsWithCounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getDepartments;
