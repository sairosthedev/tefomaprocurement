import type { Request, Response } from 'express';
import { StoreRequisition } from '../../models/index.js';

const getStoreRequisitions = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query as any;

    const query: any = {
      department: req.user!.department,
      isDeleted: false
    };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { requisitionNumber: { $regex: search, $options: 'i' } },
        { purpose: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [requisitions, total] = await Promise.all([
      StoreRequisition.find(query)
        .populate('requestedBy', 'firstName lastName')
        .populate('department', 'name')
        .populate('items.item', 'code description unit')
        .populate('approvedBy', 'firstName lastName')
        .populate('issuedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      StoreRequisition.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: requisitions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get store requisitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getStoreRequisitions;
