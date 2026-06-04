import type { Request, Response } from 'express';
import { User, SupplierProfile, RFQ, Quotation, PurchaseOrder, Inventory, PurchaseRequisition, AuditLog } from '../../models/index.js';

const getStats = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = req.user!.role;
    let stats: any = {};
    let recentActivity: any[] = [];

    // Base stats for all roles
    const activeSuppliers = await SupplierProfile.countDocuments({ status: 'approved' });
    const totalRFQs = await RFQ.countDocuments();
    const openRFQs = await RFQ.countDocuments({ status: { $in: ['draft', 'published'] } });
    const totalQuotations = await Quotation.countDocuments();
    const pendingQuotations = await Quotation.countDocuments({ status: 'submitted' });
    const totalPOs = await PurchaseOrder.countDocuments();
    const pendingPOs = await PurchaseOrder.countDocuments({ status: { $in: ['pending_finance', 'pending_coo', 'pending_approvals'] } });
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
        const pendingFinanceApproval = await PurchaseOrder.countDocuments({
          status: 'pending_approvals',
          financeApproved: false
        });
        const financeApproved = await PurchaseOrder.countDocuments({
          status: { $in: ['pending_coo', 'approved', 'sent'] },
          financeApproved: true
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
        const pendingCOOApproval = await PurchaseOrder.countDocuments({
          status: 'pending_approvals',
          cooApproved: false
        });
        const cooApproved = await PurchaseOrder.countDocuments({
          cooApproved: true
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
        // Count low stock items (items with quantityOnHand <= 5 as a threshold)
        // Note: For accurate reorderLevel check, would need to populate Item, but using threshold for performance
        const lowStockItems = await Inventory.countDocuments({
          quantityOnHand: { $lte: 5 },
          isDeleted: false
        });
        const totalItems = await Inventory.countDocuments({ isDeleted: false });
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
          requestedBy: req.user!._id
        });
        const pendingRequisitions = await PurchaseRequisition.countDocuments({
          status: 'pending_acceptance',
          department: req.user!.department
        });
        stats = {
          myRequisitions: { value: myRequisitions, label: 'My Requisitions' },
          pendingApproval: { value: pendingRequisitions, label: 'Pending Approval' },
          openRFQs: { value: openRFQs, label: 'Active RFQs' },
          purchaseOrders: { value: totalPOs, label: 'Purchase Orders' }
        };
        break;

      case 'supplier':
        const supplierProfileForStats = await SupplierProfile.findOne({ user: req.user!._id });
        if (supplierProfileForStats) {
          const myQuotations = await Quotation.countDocuments({
            supplier: supplierProfileForStats._id,
            isDeleted: false
          });
          const myPOs = await PurchaseOrder.countDocuments({
            supplier: supplierProfileForStats._id,
            isDeleted: false
          });
          const myRFQs = await RFQ.countDocuments({
            invitedSuppliers: { $elemMatch: { supplier: supplierProfileForStats._id } },
            status: { $in: ['draft', 'open'] },
            isDeleted: false
          });
          const submittedQuotations = await Quotation.countDocuments({
            supplier: supplierProfileForStats._id,
            status: 'submitted',
            isDeleted: false
          });
          stats = {
            myRFQs: { value: myRFQs, label: 'My RFQs' },
            myQuotations: { value: myQuotations, label: 'My Quotations' },
            submittedQuotations: { value: submittedQuotations, label: 'Submitted Quotations' },
            myPOs: { value: myPOs, label: 'My Purchase Orders' }
          };
        } else {
          stats = {
            openRFQs: { value: openRFQs, label: 'Open RFQs' },
            quotations: { value: totalQuotations, label: 'Quotations' },
            purchaseOrders: { value: totalPOs, label: 'Purchase Orders' },
            suppliers: { value: activeSuppliers, label: 'Active Suppliers' }
          };
        }
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

    recentActivity = auditLogs.map((log: any) => ({
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

    // Get additional stats for non-admin roles (to display in place of Recent Activity)
    let additionalStats: any = {};
    if (userRole !== 'admin') {
      switch (userRole) {
        case 'procurement_officer':
          const totalQuotationsForProcurement = await Quotation.countDocuments();
          const approvedQuotations = await Quotation.countDocuments({ status: 'accepted' });
          additionalStats = {
            totalQuotations: { value: totalQuotationsForProcurement, label: 'Total Quotations' },
            approvedQuotations: { value: approvedQuotations, label: 'Approved Quotations' },
            totalRFQs: { value: totalRFQs, label: 'Total RFQs' },
            approvedPOs: { value: approvedPOs, label: 'Approved POs' }
          };
          break;

        case 'finance':
          const pendingFinanceValue = await PurchaseOrder.aggregate([
            { $match: { status: 'pending_approvals', financeApproved: false } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          const monthlyPOValue = await PurchaseOrder.aggregate([
            {
              $match: {
                status: { $in: ['approved', 'sent', 'delivered'] },
                createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
              }
            },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          const financeApprovedForAdditional = await PurchaseOrder.countDocuments({
            status: { $in: ['pending_coo', 'approved', 'sent'] },
            financeApproved: true
          });
          additionalStats = {
            pendingValue: { value: `$${(pendingFinanceValue[0]?.total || 0).toLocaleString()}`, label: 'Pending Value' },
            monthlyValue: { value: `$${(monthlyPOValue[0]?.total || 0).toLocaleString()}`, label: 'Monthly PO Value' },
            approvedPOs: { value: financeApprovedForAdditional, label: 'Finance Approved' },
            totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
          };
          break;

        case 'coo':
          const pendingCOOValue = await PurchaseOrder.aggregate([
            { $match: { status: 'pending_approvals', cooApproved: false } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          const majorPOs = await PurchaseOrder.countDocuments({
            status: 'pending_coo',
            totalAmount: { $gte: 50000 } // Major POs (assuming threshold)
          });
          const cooApproved = await PurchaseOrder.countDocuments({
            cooApproved: true
          });
          additionalStats = {
            pendingValue: { value: `$${(pendingCOOValue[0]?.total || 0).toLocaleString()}`, label: 'Pending Value' },
            majorPOs: { value: majorPOs, label: 'Major POs Pending' },
            cooApproved: { value: cooApproved, label: 'COO Approved' },
            totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
          };
          break;

        case 'stores_officer':
          const totalInventoryValue = await Inventory.aggregate([
            { $match: { isDeleted: false } },
            { $group: { _id: null, total: { $sum: '$totalValue' } } }
          ]);
          // Count items needing reorder (using threshold of 5, same as lowStock calculation)
          const itemsNeedingReorder = await Inventory.countDocuments({
            quantityOnHand: { $lte: 5 },
            isDeleted: false
          });
          const receivedThisMonth = await PurchaseOrder.countDocuments({
            status: 'delivered',
            createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
          });
          const pendingDeliveriesForStores = await PurchaseOrder.countDocuments({ status: 'sent' });
          additionalStats = {
            inventoryValue: { value: `$${(totalInventoryValue[0]?.total || 0).toLocaleString()}`, label: 'Inventory Value' },
            itemsNeedingReorder: { value: itemsNeedingReorder, label: 'Items Needing Reorder' },
            receivedThisMonth: { value: receivedThisMonth, label: 'Received This Month' },
            pendingDeliveries: { value: pendingDeliveriesForStores, label: 'Pending Deliveries' }
          };
          break;

        case 'department_head':
          const approvedRequisitions = await PurchaseRequisition.countDocuments({
            requestedBy: req.user!._id,
            status: { $in: ['accepted', 'sourcing', 'quoted', 'ordered', 'completed'] }
          });
          const rejectedRequisitions = await PurchaseRequisition.countDocuments({
            requestedBy: req.user!._id,
            status: 'rejected'
          });
          const departmentRequisitions = await PurchaseRequisition.countDocuments({
            department: req.user!.department
          });
          const pendingRequisitions = await PurchaseRequisition.countDocuments({
            status: 'pending_acceptance',
            department: req.user!.department
          });
          additionalStats = {
            approvedRequisitions: { value: approvedRequisitions, label: 'Approved Requisitions' },
            rejectedRequisitions: { value: rejectedRequisitions, label: 'Rejected Requisitions' },
            departmentRequisitions: { value: departmentRequisitions, label: 'Dept. Requisitions' },
            pendingApproval: { value: pendingRequisitions, label: 'Pending Approval' }
          };
          break;

        default: // supplier or other roles
          const supplierProfileForAdditional = await SupplierProfile.findOne({ user: req.user!._id });
          if (supplierProfileForAdditional) {
            const myQuotationsAdditional = await Quotation.countDocuments({
              supplier: supplierProfileForAdditional._id,
              isDeleted: false
            });
            const myPOsAdditional = await PurchaseOrder.countDocuments({
              supplier: supplierProfileForAdditional._id,
              isDeleted: false
            });
            const submittedQuotationsAdditional = await Quotation.countDocuments({
              supplier: supplierProfileForAdditional._id,
              status: 'submitted',
              isDeleted: false
            });
            const myRFQsAdditional = await RFQ.countDocuments({
              invitedSuppliers: { $elemMatch: { supplier: supplierProfileForAdditional._id } },
              status: { $in: ['draft', 'open'] },
              isDeleted: false
            });
            additionalStats = {
              myQuotations: { value: myQuotationsAdditional, label: 'My Quotations' },
              submittedQuotations: { value: submittedQuotationsAdditional, label: 'Submitted Quotations' },
              myPOs: { value: myPOsAdditional, label: 'My Purchase Orders' },
              myRFQs: { value: myRFQsAdditional, label: 'My RFQs' }
            };
          } else {
            additionalStats = {
              openRFQs: { value: openRFQs, label: 'Open RFQs' },
              quotations: { value: totalQuotations, label: 'Quotations' },
              purchaseOrders: { value: totalPOs, label: 'Purchase Orders' },
              suppliers: { value: activeSuppliers, label: 'Active Suppliers' }
            };
          }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        stats,
        recentActivity,
        pendingItems,
        additionalStats
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
function getTimeAgo(date: any): string {
  const seconds = Math.floor(((new Date() as any) - (new Date(date) as any)) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(date).toLocaleDateString('en-ZA');
}

export default getStats;
