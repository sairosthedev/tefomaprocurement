const { Inventory } = require('../../models');

const getInventory = async (req, res) => {
  try {
    const { search, belowReorderLevel, page = 1, limit = 50 } = req.query;
    
    const query = { isDeleted: false };

    const skip = (page - 1) * limit;
    
    let inventoryQuery = Inventory.find(query)
      .populate({
        path: 'item',
        match: search ? { name: { $regex: search, $options: 'i' } } : {},
        select: 'code name description category unit reorderLevel'
      })
      .sort({ 'item.name': 1 })
      .skip(skip)
      .limit(parseInt(limit));

    let [inventory, total] = await Promise.all([
      inventoryQuery,
      Inventory.countDocuments(query)
    ]);

    // Filter out null items (from populate match)
    inventory = inventory.filter(inv => inv.item !== null);

    // Filter below reorder level if requested
    if (belowReorderLevel === 'true') {
      inventory = inventory.filter(inv => 
        inv.quantityOnHand <= inv.item.reorderLevel
      );
    }

    res.status(200).json({
      success: true,
      data: inventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = getInventory;

