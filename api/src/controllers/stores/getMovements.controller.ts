import type { Request, Response } from 'express';

import { StoreTransaction, Delivery, StoreRequisition } from '../../models/index.js';

const getMovements = async (req: Request, res: Response): Promise<any> => {
  try {
    const { search, type, range, page = 1, limit = 50 } = req.query as Record<string, any>;
    
    const query: any = { isDeleted: false };
    
    // Filter by type (map frontend types to backend types)
    if (type) {
      const typeMap: any = {
        'stock-in': 'receipt',
        'stock-out': 'issue',
        'adjustment': 'adjustment',
        'transfer': 'transfer'
      };
      if (typeMap[type]) {
        query.type = typeMap[type];
      }
    }
    
    // Filter by date range
    if (range && range !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (range) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { transactionNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [transactions, total] = await Promise.all([
      StoreTransaction.find(query)
        .populate('item', 'code name unit')
        .populate('inventory', 'location')
        .populate('performedBy', 'firstName lastName')
        .populate('department', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StoreTransaction.countDocuments(query)
    ]);

    // Manually populate reference documents based on type
    const documentIdsByType: any = {
      grv: [],
      store_requisition: []
    };
    
    transactions.forEach(t => {
      if (t.reference?.document && t.reference?.type) {
        const docId = t.reference.document.toString();
        if (t.reference.type === 'grv') {
          if (!documentIdsByType.grv.includes(docId)) {
            documentIdsByType.grv.push(docId);
          }
        } else if (t.reference.type === 'store_requisition') {
          if (!documentIdsByType.store_requisition.includes(docId)) {
            documentIdsByType.store_requisition.push(docId);
          }
        }
      }
    });
    
    // Fetch documents
    const [deliveries, storeRequisitions] = await Promise.all([
      documentIdsByType.grv.length > 0 
        ? Delivery.find({ _id: { $in: documentIdsByType.grv } }).select('grvNumber').lean()
        : [],
      documentIdsByType.store_requisition.length > 0
        ? StoreRequisition.find({ _id: { $in: documentIdsByType.store_requisition } }).select('requisitionNumber').lean()
        : []
    ]);
    
    // Create maps for quick lookup
    const deliveryMap = new Map(deliveries.map(d => [d._id.toString(), d]));
    const storeRequisitionMap = new Map(storeRequisitions.map(sr => [sr._id.toString(), sr]));

    // Transform transactions to match frontend expectations
    const movements = transactions.map(t => {
      // Map backend types to frontend types
      const typeMap: any = {
        'receipt': 'stock-in',
        'issue': 'stock-out',
        'adjustment': 'adjustment',
        'transfer': 'transfer',
        'return': 'stock-in'
      };
      
      // Get reference number
      let referenceNumber = t.transactionNumber;
      if (t.reference?.document && t.reference?.type) {
        const docId = t.reference.document.toString();
        if (t.reference.type === 'grv') {
          const delivery = deliveryMap.get(docId);
          if (delivery?.grvNumber) {
            referenceNumber = delivery.grvNumber;
          }
        } else if (t.reference.type === 'store_requisition') {
          const storeReq = storeRequisitionMap.get(docId);
          if (storeReq?.requisitionNumber) {
            referenceNumber = storeReq.requisitionNumber;
          }
        }
      }
      
      return {
        _id: t._id,
        type: typeMap[t.type] || t.type,
        item: {
          name: t.item?.name || 'Unknown Item',
          itemCode: t.item?.code || 'N/A'
        },
        quantity: t.quantity,
        unit: t.item?.unit || 'each',
        reference: referenceNumber,
        performedBy: {
          firstName: t.performedBy?.firstName || 'Unknown',
          lastName: t.performedBy?.lastName || 'User'
        },
        department: t.department?.name,
        createdAt: t.createdAt,
        notes: t.notes || '',
        previousQuantity: t.previousQuantity,
        newQuantity: t.newQuantity,
        unitCost: t.unitCost,
        totalValue: t.totalValue
      };
    });

    res.status(200).json({
      success: true,
      data: movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Get movements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export default getMovements;
