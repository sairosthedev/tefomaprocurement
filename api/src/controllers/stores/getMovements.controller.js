const { StoreTransaction } = require('../../models');

const getMovements = async (req, res) => {
  try {
    const { search, type, range, page = 1, limit = 50 } = req.query;
    
    const query = { isDeleted: false };
    
    // Filter by type (map frontend types to backend types)
    if (type) {
      const typeMap = {
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
        .populate('reference.document')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StoreTransaction.countDocuments(query)
    ]);

    // Transform transactions to match frontend expectations
    const movements = transactions.map(t => {
      // Map backend types to frontend types
      const typeMap = {
        'receipt': 'stock-in',
        'issue': 'stock-out',
        'adjustment': 'adjustment',
        'transfer': 'transfer',
        'return': 'stock-in'
      };
      
      // Get reference number
      let referenceNumber = t.transactionNumber;
      if (t.reference?.document) {
        if (t.reference.type === 'grv' && t.reference.document.grvNumber) {
          referenceNumber = t.reference.document.grvNumber;
        } else if (t.reference.type === 'store_requisition' && t.reference.document.requisitionNumber) {
          referenceNumber = t.reference.document.requisitionNumber;
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
  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getMovements;

