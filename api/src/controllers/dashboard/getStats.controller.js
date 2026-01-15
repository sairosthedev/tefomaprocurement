const { User, SupplierProfile, RFQ, Quotation, PurchaseOrder, Inventory, PurchaseRequisition, AuditLog } = require('../../models');

const getStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    let stats = {};
    let recentActivity = [];

    // Base stats for all roles
    const activeSuppliers = await SupplierProfile.countDocuments({ status: 'approved' });
    const totalRFQs = await RFQ.countDocuments();
    const openRFQs = await RFQ.countDocuments({ status: { $in: ['draft', 'published'] } });
    const totalQuotations = await Quotation.countDocuments();
    const pendingQuotations = await Quotation.countDocuments({ status: 'submitted' });
    const totalPOs = await PurchaseOrder.countDocuments();
    const pendingPOs = await PurchaseOrder.countDocuments({ status: { $in: ['pending_finance', 'pending_coo'] } });
    const approvedPOs = await PurchaseOrder.countDocuments({ status: 'approved' });

    // Role-specific stats
    switch (userRole) {
      case 'admin':
        const totalUsers = await User.countDocuments({ isDeleted: false });
        const activeUsers = await User.countDocuments({ isDeleted: false, status: 'active' });
        stats = {
          totalUsers: { value: totalUsers, label: 'Total Users' },
          activeUsers: { value: activeUsers, label: 'Active Users' },
          totalSuppliers: { value: activeSuppliers, label: 'Active Suppliers' },
          totalPOs: { value: totalPOs, label: 'Purchase Orders' }
        };
        break;

      case 'procurement_officer':
        stats = {
          openRFQs: { value: openRFQs, label: 'Open RFQs' },
          pendingQuotations: { value: pendingQuotations, label: 'Pending Quotations' },
          activeSuppliers: { value: activeSuppliers, label: 'Active Suppliers' },
          purchaseOrders: { value: totalPOs, label: 'Purchase Orders' }
        };
        break;

      case 'finance':
        const pendingFinanceApproval = await PurchaseOrder.countDocuments({ status: 'pending_finance' });
        const financeApproved = await PurchaseOrder.countDocuments({ 
          status: { $in: ['pending_coo', 'approved', 'sent'] },
          financeApproval: { $exists: true }
        });
        const totalPOValue = await PurchaseOrder.aggregate([
          { $match: { status: { $in: ['approved', 'sent', 'delivered'] } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        stats = {
          pendingApproval: { value: pendingFinanceApproval, label: 'Pending Approval' },
          approved: { value: financeApproved, label: 'Approved POs' },
          totalValue: { value: `$${(totalPOValue[0]?.total || 0).toLocaleString()}`, label: 'Total PO Value' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        };
        break;

      case 'coo':
        const pendingCOOApproval = await PurchaseOrder.countDocuments({ status: 'pending_coo' });
        const cooApproved = await PurchaseOrder.countDocuments({ 
          cooApproval: { $exists: true }
        });
        const majorPOValue = await PurchaseOrder.aggregate([
          { $match: { status: 'pending_coo' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        stats = {
          pendingApproval: { value: pendingCOOApproval, label: 'Pending Approval' },
          approved: { value: cooApproved, label: 'Approved by COO' },
          pendingValue: { value: `$${(majorPOValue[0]?.total || 0).toLocaleString()}`, label: 'Pending Value' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        };
        break;

      case 'stores_officer':
        const lowStockItems = await Inventory.countDocuments({
          $expr: { $lte: ['$currentQuantity', '$reorderLevel'] }
        });
        const totalItems = await Inventory.countDocuments();
        const pendingDeliveries = await PurchaseOrder.countDocuments({ status: 'sent' });
        stats = {
          totalItems: { value: totalItems, label: 'Inventory Items' },
          lowStock: { value: lowStockItems, label: 'Low Stock Items' },
          pendingDeliveries: { value: pendingDeliveries, label: 'Pending Deliveries' },
          purchaseOrders: { value: approvedPOs, label: 'Approved POs' }
        };
        break;

      case 'department_head':
        const myRequisitions = await PurchaseRequisition.countDocuments({ 
          requestedBy: req.user._id 
        });
        const pendingRequisitions = await PurchaseRequisition.countDocuments({ 
          status: 'pending',
          department: req.user.department
        });
        stats = {
          myRequisitions: { value: myRequisitions, label: 'My Requisitions' },
          pendingApproval: { value: pendingRequisitions, label: 'Pending Approval' },
          openRFQs: { value: openRFQs, label: 'Active RFQs' },
          purchaseOrders: { value: totalPOs, label: 'Purchase Orders' }
        };
        break;

      default:
        stats = {
          openRFQs: { value: openRFQs, label: 'Open RFQs' },
          quotations: { value: totalQuotations, label: 'Quotations' },
          purchaseOrders: { value: totalPOs, label: 'Purchase Orders' },
          suppliers: { value: activeSuppliers, label: 'Active Suppliers' }
        };
    }

    // Get recent activity from audit logs
    const auditLogs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'firstName lastName')
      .lean();

    recentActivity = auditLogs.map(log => ({
      id: log._id,
      type: log.action,
      message: log.description,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
      time: getTimeAgo(log.createdAt),
      entity: log.entity
    }));

    // Get pending items count for quick reference
    const pendingItems = {
      rfqs: openRFQs,
      quotations: pendingQuotations,
      purchaseOrders: pendingPOs
    };

    res.status(200).json({
      success: true,
      data: {
        stats,
        recentActivity,
        pendingItems
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard stats'
    });
  }
};

// Helper function to get relative time
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(date).toLocaleDateString('en-ZA');
}

module.exports = getStats;

