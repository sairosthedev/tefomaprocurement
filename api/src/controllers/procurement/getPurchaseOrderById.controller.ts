import type { Request, Response } from 'express';

import { PurchaseOrder } from '../../models/index.js';

const getPurchaseOrderById = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const order = await PurchaseOrder.findById(id)
      .populate('supplier', 'companyName contactEmail contactPhone address')
      .populate('createdBy', 'firstName lastName email')
      .populate('quotation', 'quotationNumber currency submittedAt')
      .populate('hodApprovedBy', 'firstName lastName')
      .populate('financeApprovedBy', 'firstName lastName')
      .populate('cooApprovedBy', 'firstName lastName')
      // One populate for the path: a second, unselected one used to override
      // this select and send the whole requisition, items and history.
      .populate({
        path: 'purchaseRequisition',
        select: 'requisitionNumber title department',
        populate: {
          path: 'department',
          select: 'name code'
        }
      })
      .lean();

    if (!order || order.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error: any) {
    console.error('Get purchase order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getPurchaseOrderById;
