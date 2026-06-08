import type { Request, Response } from 'express';
import { isProcurementHead } from '@fossil/shared';
import { User, SupplierProfile, RFQ, Quotation, PurchaseOrder, Inventory, PurchaseRequisition, AuditLog } from '../../models/index.js';

/** Build a department-scoped filter for requisition queries. */
function deptRequisitionFilter(user: Request['user']) {
  const base: Record<string, unknown> = { isDeleted: false };
  if (user?.department) {
    base.department = user.department;
  } else if (user?._id) {
    base.requestedBy = user._id;
  }
  return base;
}

const getStats = async (req: Request, res: Response): Promise<any> => {
  try {
    // The head of the Procurement department operates as a procurement officer
    // for dashboard purposes (FC-HQ-P-07 §5.1.2).
    const userRole = isProcurementHead(req.user) ? 'procurement_officer' : req.user!.role;
    let stats: any = {};
    let recentActivity: any[] = [];

    // Shared counts — use the actual status values from the models
    const activeSuppliers = await SupplierProfile.countDocuments({ status: 'active', isDeleted: false });
    const totalRFQs = await RFQ.countDocuments({ isDeleted: false });
    const openRFQs = await RFQ.countDocuments({ status: { $in: ['draft', 'open'] }, isDeleted: false });
    const totalQuotations = await Quotation.countDocuments({ isDeleted: false });
    const pendingQuotations = await Quotation.countDocuments({ status: 'submitted', isDeleted: false });
    const totalPOs = await PurchaseOrder.countDocuments({ isDeleted: false });
    const pendingPOs = await PurchaseOrder.countDocuments({
      status: { $in: ['pending_hod', 'pending_finance', 'pending_coo', 'pending_approvals'] },
      isDeleted: false
    });
    const approvedPOs = await PurchaseOrder.countDocuments({
      status: { $in: ['approved', 'issued', 'partially_received', 'completed'] },
      isDeleted: false
    });

    const deptFilter = deptRequisitionFilter(req.user);

    // Role-specific stats
    switch (userRole) {
      case 'admin': {
        const totalUsers = await User.countDocuments({ isDeleted: false });
        const activeUsers = await User.countDocuments({ isDeleted: false, status: 'active' });
        stats = {
          totalUsers: { value: totalUsers, label: 'Total Users' },
          activeUsers: { value: activeUsers, label: 'Active Users' },
          totalSuppliers: { value: activeSuppliers, label: 'Active Suppliers' },
          totalPOs: { value: totalPOs, label: 'Purchase Orders' }
        };
        break;
      }

      case 'procurement_officer':
        stats = {
          openRFQs: { value: openRFQs, label: 'Open RFQs' },
          pendingQuotations: { value: pendingQuotations, label: 'Pending Quotations' },
          activeSuppliers: { value: activeSuppliers, label: 'Active Suppliers' },
          purchaseOrders: { value: totalPOs, label: 'Purchase Orders' }
        };
        break;

      case 'finance': {
        const pendingFinanceApproval = await PurchaseOrder.countDocuments({
          status: 'pending_approvals',
          financeApproved: false,
          isDeleted: false
        });
        const financeApproved = await PurchaseOrder.countDocuments({
          status: { $in: ['pending_coo', 'approved', 'issued', 'partially_received', 'completed'] },
          financeApproved: true,
          isDeleted: false
        });
        const totalPOValue = await PurchaseOrder.aggregate([
          { $match: { status: { $in: ['approved', 'issued', 'partially_received', 'completed'] }, isDeleted: false } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        stats = {
          pendingApproval: { value: pendingFinanceApproval, label: 'Pending Approval' },
          approved: { value: financeApproved, label: 'Approved POs' },
          totalValue: { value: `$${(totalPOValue[0]?.total || 0).toLocaleString()}`, label: 'Total PO Value' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        };
        break;
      }

      case 'coo': {
        const pendingCOOApproval = await PurchaseOrder.countDocuments({
          status: { $in: ['pending_coo', 'pending_approvals'] },
          cooApproved: false,
          isDeleted: false
        });
        const cooApprovedCount = await PurchaseOrder.countDocuments({
          cooApproved: true,
          isDeleted: false
        });
        const majorPOValue = await PurchaseOrder.aggregate([
          { $match: { status: 'pending_coo', isDeleted: false } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        stats = {
          pendingApproval: { value: pendingCOOApproval, label: 'Pending Approval' },
          approved: { value: cooApprovedCount, label: 'Approved by COO' },
          pendingValue: { value: `$${(majorPOValue[0]?.total || 0).toLocaleString()}`, label: 'Pending Value' },
          totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
        };
        break;
      }

      case 'stores_officer': {
        const lowStockItems = await Inventory.countDocuments({
          quantityOnHand: { $lte: 5 },
          isDeleted: false
        });
        const totalItems = await Inventory.countDocuments({ isDeleted: false });
        const pendingDeliveries = await PurchaseOrder.countDocuments({
          status: { $in: ['issued', 'partially_received'] },
          isDeleted: false
        });
        stats = {
          totalItems: { value: totalItems, label: 'Inventory Items' },
          lowStock: { value: lowStockItems, label: 'Low Stock Items' },
          pendingDeliveries: { value: pendingDeliveries, label: 'Pending Deliveries' },
          purchaseOrders: { value: approvedPOs, label: 'Approved POs' }
        };
        break;
      }

      case 'department_head': {
        const departmentRequisitions = await PurchaseRequisition.countDocuments(deptFilter);
        const pendingHodApproval = await PurchaseRequisition.countDocuments({
          ...deptFilter,
          status: 'pending_hod'
        });
        const hodApprovedRequisitions = await PurchaseRequisition.countDocuments({
          ...deptFilter,
          status: { $in: ['stores_review', 'fulfilled', 'pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered', 'completed'] }
        });
        const pendingPoApprovals = await PurchaseOrder.countDocuments({
          isDeleted: false,
          status: { $in: ['pending_hod', 'pending_approvals'] },
          hodApproved: false
        });
        stats = {
          departmentRequisitions: { value: departmentRequisitions, label: 'Dept. Requisitions' },
          pendingApproval: { value: pendingHodApproval, label: 'Awaiting My Approval' },
          approvedRequisitions: { value: hodApprovedRequisitions, label: 'Approved' },
          pendingPoApprovals: { value: pendingPoApprovals, label: 'POs Pending Approval' }
        };
        break;
      }

      case 'end_user': {
        const userFilter = { requestedBy: req.user!._id, isDeleted: false };
        const myReqs = await PurchaseRequisition.countDocuments(userFilter);
        const myDrafts = await PurchaseRequisition.countDocuments({ ...userFilter, status: 'draft' });
        const myPendingHod = await PurchaseRequisition.countDocuments({ ...userFilter, status: 'pending_hod' });
        const myFulfilled = await PurchaseRequisition.countDocuments({
          ...userFilter,
          status: { $in: ['fulfilled', 'completed', 'ordered'] }
        });
        stats = {
          myRequisitions: { value: myReqs, label: 'My Requisitions' },
          drafts: { value: myDrafts, label: 'Drafts' },
          pendingApproval: { value: myPendingHod, label: 'Awaiting HOD Approval' },
          fulfilled: { value: myFulfilled, label: 'Fulfilled' }
        };
        break;
      }

      case 'supplier': {
        const supplierProfileForStats = await SupplierProfile.findOne({ user: req.user!._id, isDeleted: false });
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
      }

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

    const pendingItems = {
      rfqs: openRFQs,
      quotations: pendingQuotations,
      purchaseOrders: pendingPOs
    };

    // Additional stats for non-admin roles
    let additionalStats: any = {};
    if (userRole !== 'admin') {
      switch (userRole) {
        case 'procurement_officer': {
          const approvedQuotations = await Quotation.countDocuments({ status: 'accepted', isDeleted: false });
          const pendingAcceptance = await PurchaseRequisition.countDocuments({
            status: 'pending_acceptance',
            isDeleted: false
          });
          additionalStats = {
            totalQuotations: { value: totalQuotations, label: 'Total Quotations' },
            approvedQuotations: { value: approvedQuotations, label: 'Approved Quotations' },
            totalRFQs: { value: totalRFQs, label: 'Total RFQs' },
            pendingAcceptance: { value: pendingAcceptance, label: 'Awaiting Acceptance' }
          };
          break;
        }

        case 'finance': {
          const pendingFinanceValue = await PurchaseOrder.aggregate([
            { $match: { status: 'pending_approvals', financeApproved: false, isDeleted: false } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          const monthlyPOValue = await PurchaseOrder.aggregate([
            {
              $match: {
                status: { $in: ['approved', 'issued', 'partially_received', 'completed'] },
                isDeleted: false,
                createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
              }
            },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          const financeApprovedCount = await PurchaseOrder.countDocuments({
            status: { $in: ['pending_coo', 'approved', 'issued', 'partially_received', 'completed'] },
            financeApproved: true,
            isDeleted: false
          });
          additionalStats = {
            pendingValue: { value: `$${(pendingFinanceValue[0]?.total || 0).toLocaleString()}`, label: 'Pending Value' },
            monthlyValue: { value: `$${(monthlyPOValue[0]?.total || 0).toLocaleString()}`, label: 'Monthly PO Value' },
            approvedPOs: { value: financeApprovedCount, label: 'Finance Approved' },
            totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
          };
          break;
        }

        case 'coo': {
          const pendingCOOValue = await PurchaseOrder.aggregate([
            { $match: { status: { $in: ['pending_coo', 'pending_approvals'] }, cooApproved: false, isDeleted: false } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          const majorPOs = await PurchaseOrder.countDocuments({
            status: 'pending_coo',
            totalAmount: { $gte: 50000 },
            isDeleted: false
          });
          const cooApprovedCount = await PurchaseOrder.countDocuments({ cooApproved: true, isDeleted: false });
          additionalStats = {
            pendingValue: { value: `$${(pendingCOOValue[0]?.total || 0).toLocaleString()}`, label: 'Pending Value' },
            majorPOs: { value: majorPOs, label: 'Major POs Pending' },
            cooApproved: { value: cooApprovedCount, label: 'COO Approved' },
            totalPOs: { value: totalPOs, label: 'All Purchase Orders' }
          };
          break;
        }

        case 'stores_officer': {
          const totalInventoryValue = await Inventory.aggregate([
            { $match: { isDeleted: false } },
            { $group: { _id: null, total: { $sum: '$totalValue' } } }
          ]);
          const itemsNeedingReorder = await Inventory.countDocuments({
            quantityOnHand: { $lte: 5 },
            isDeleted: false
          });
          const receivedThisMonth = await PurchaseOrder.countDocuments({
            status: 'completed',
            isDeleted: false,
            updatedAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
          });
          const pendingDeliveriesForStores = await PurchaseOrder.countDocuments({
            status: { $in: ['issued', 'partially_received'] },
            isDeleted: false
          });
          additionalStats = {
            inventoryValue: { value: `$${(totalInventoryValue[0]?.total || 0).toLocaleString()}`, label: 'Inventory Value' },
            itemsNeedingReorder: { value: itemsNeedingReorder, label: 'Items Needing Reorder' },
            receivedThisMonth: { value: receivedThisMonth, label: 'Received This Month' },
            pendingDeliveries: { value: pendingDeliveriesForStores, label: 'Pending Deliveries' }
          };
          break;
        }

        case 'department_head': {
          const rejectedRequisitions = await PurchaseRequisition.countDocuments({
            ...deptFilter,
            status: 'rejected'
          });
          const inProgressRequisitions = await PurchaseRequisition.countDocuments({
            ...deptFilter,
            status: { $in: ['stores_review', 'pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered'] }
          });
          const draftRequisitions = await PurchaseRequisition.countDocuments({
            ...deptFilter,
            status: 'draft'
          });
          const pendingHodApproval = await PurchaseRequisition.countDocuments({
            ...deptFilter,
            status: 'pending_hod'
          });
          additionalStats = {
            rejectedRequisitions: { value: rejectedRequisitions, label: 'Rejected' },
            inProgressRequisitions: { value: inProgressRequisitions, label: 'In Progress' },
            draftRequisitions: { value: draftRequisitions, label: 'Drafts' },
            pendingApproval: { value: pendingHodApproval, label: 'Awaiting My Approval' }
          };
          break;
        }

        case 'end_user': {
          const userFilter = { requestedBy: req.user!._id, isDeleted: false };
          const rejected = await PurchaseRequisition.countDocuments({ ...userFilter, status: 'rejected' });
          const inProgress = await PurchaseRequisition.countDocuments({
            ...userFilter,
            status: { $in: ['stores_review', 'pending_acceptance', 'accepted', 'sourcing', 'quoted', 'ordered'] }
          });
          const completed = await PurchaseRequisition.countDocuments({
            ...userFilter,
            status: { $in: ['fulfilled', 'completed'] }
          });
          additionalStats = {
            rejectedRequisitions: { value: rejected, label: 'Rejected' },
            inProgressRequisitions: { value: inProgress, label: 'In Progress' },
            completedRequisitions: { value: completed, label: 'Completed' },
            openRFQs: { value: openRFQs, label: 'Active RFQs' }
          };
          break;
        }

        default: {
          const supplierProfileForAdditional = await SupplierProfile.findOne({ user: req.user!._id, isDeleted: false });
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

function getTimeAgo(date: any): string {
  const seconds = Math.floor(((new Date() as any) - (new Date(date) as any)) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(date).toLocaleDateString('en-ZA');
}

export default getStats;
