import mongoose from 'mongoose';
import {
  PurchaseOrder,
  PurchaseRequisition,
  Inventory,
  StoreTransaction,
  Quotation,
  RFQ
} from '../models/index.js';

export function parseRangeStart(range?: string): Date {
  const now = new Date();
  switch (range) {
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    case 'month':
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

export type ChartFormat = 'currency' | 'number';
export type ChartKind = 'bar' | 'horizontal';

export interface ReportChartConfig {
  id: string;
  title: string;
  kind: ChartKind;
  format: ChartFormat;
  data: { label: string; value: number }[];
}

export async function buildProcurementCharts(range?: string) {
  const start = parseRangeStart(range);
  const poMatch: Record<string, unknown> = {
    isDeleted: false,
    createdAt: { $gte: start }
  };

  const spendTrend = await PurchaseOrder.aggregate([
    {
      $match: {
        ...poMatch,
        status: { $in: ['approved', 'issued', 'partially_received', 'completed'] }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 31 }
  ]);

  const byStatus = await PurchaseOrder.aggregate([
    { $match: poMatch },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { value: -1 } }
  ]);

  const byDepartment = await PurchaseOrder.aggregate([
    { $match: { ...poMatch, purchaseRequisition: { $exists: true, $ne: null } } },
    {
      $lookup: {
        from: 'purchaserequisitions',
        localField: 'purchaseRequisition',
        foreignField: '_id',
        as: 'pr'
      }
    },
    { $unwind: '$pr' },
    {
      $group: {
        _id: '$pr.department',
        value: { $sum: '$totalAmount' }
      }
    },
    {
      $lookup: {
        from: 'departments',
        localField: '_id',
        foreignField: '_id',
        as: 'dept'
      }
    },
    { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        label: { $ifNull: ['$dept.name', 'Unassigned'] },
        value: 1
      }
    },
    { $sort: { value: -1 } },
    { $limit: 8 }
  ]);

  return {
    rangeStart: start.toISOString(),
    spendTrend: spendTrend.map((row) => ({ label: row._id, value: row.value || 0 })),
    distribution: byStatus.map((row) => ({
      label: String(row._id).replace(/_/g, ' '),
      value: row.value || 0,
      count: row.count || 0
    })),
    departmentSpend: byDepartment.map((row) => ({
      label: row.label,
      value: row.value || 0
    }))
  };
}

/** @deprecated use buildRoleReportCharts — kept for backward compatibility */
export async function buildReportCharts(range?: string) {
  return buildProcurementCharts(range);
}

async function buildStoresCharts(start: Date): Promise<ReportChartConfig[]> {
  const valuationByCategory = await Inventory.aggregate([
    { $match: { isDeleted: false } },
    {
      $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'itemDoc' }
    },
    { $unwind: '$itemDoc' },
    {
      $group: {
        _id: '$itemDoc.category',
        value: { $sum: '$totalValue' }
      }
    },
    { $sort: { value: -1 } },
    { $limit: 8 }
  ]);

  const fastMoving = await StoreTransaction.aggregate([
    {
      $match: {
        isDeleted: false,
        type: 'issue',
        createdAt: { $gte: start }
      }
    },
    {
      $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'itemDoc' }
    },
    { $unwind: '$itemDoc' },
    {
      $group: {
        _id: '$itemDoc.name',
        value: { $sum: '$quantity' }
      }
    },
    { $sort: { value: -1 } },
    { $limit: 8 }
  ]);

  const lowStock = await Inventory.aggregate([
    { $match: { isDeleted: false } },
    {
      $lookup: { from: 'items', localField: 'item', foreignField: '_id', as: 'itemDoc' }
    },
    { $unwind: '$itemDoc' },
    {
      $match: {
        $expr: {
          $lte: [
            '$quantityOnHand',
            { $cond: [{ $gt: ['$itemDoc.reorderLevel', 0] }, '$itemDoc.reorderLevel', 5] }
          ]
        }
      }
    },
    {
      $project: {
        label: '$itemDoc.name',
        value: '$quantityOnHand'
      }
    },
    { $sort: { value: 1 } },
    { $limit: 8 }
  ]);

  const movements = await StoreTransaction.aggregate([
    {
      $match: {
        isDeleted: false,
        createdAt: { $gte: start },
        type: { $in: ['receipt', 'issue', 'transfer', 'return'] }
      }
    },
    {
      $group: {
        _id: '$type',
        value: { $sum: '$quantity' }
      }
    },
    { $sort: { value: -1 } }
  ]);

  return [
    {
      id: 'stockValuation',
      title: 'Stock valuation by category',
      kind: 'horizontal',
      format: 'currency',
      data: valuationByCategory.map((r) => ({ label: r._id || 'Other', value: r.value || 0 }))
    },
    {
      id: 'fastMoving',
      title: 'Fast-moving items (issues)',
      kind: 'horizontal',
      format: 'number',
      data: fastMoving.map((r) => ({ label: r._id, value: r.value || 0 }))
    },
    {
      id: 'lowStock',
      title: 'Low stock items',
      kind: 'horizontal',
      format: 'number',
      data: lowStock.map((r) => ({ label: r.label, value: r.value || 0 }))
    },
    {
      id: 'movements',
      title: 'Stock movements by type',
      kind: 'horizontal',
      format: 'number',
      data: movements.map((r) => ({
        label: String(r._id).replace(/_/g, ' '),
        value: r.value || 0
      }))
    }
  ];
}

async function buildDepartmentHeadCharts(
  start: Date,
  departmentId?: string
): Promise<ReportChartConfig[]> {
  const deptFilter: Record<string, unknown> = {
    isDeleted: false,
    createdAt: { $gte: start }
  };
  if (departmentId) {
    deptFilter.department = new mongoose.Types.ObjectId(departmentId);
  }

  const byStatus = await PurchaseRequisition.aggregate([
    { $match: deptFilter },
    { $group: { _id: '$status', value: { $sum: 1 } } },
    { $sort: { value: -1 } }
  ]);

  const requestTrend = await PurchaseRequisition.aggregate([
    { $match: deptFilter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        value: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 31 }
  ]);

  const poMatch: Record<string, unknown> = {
    isDeleted: false,
    createdAt: { $gte: start },
    purchaseRequisition: { $exists: true, $ne: null }
  };

  const deptSpendPipeline: mongoose.PipelineStage[] = [
    { $match: poMatch },
    {
      $lookup: {
        from: 'purchaserequisitions',
        localField: 'purchaseRequisition',
        foreignField: '_id',
        as: 'pr'
      }
    },
    { $unwind: '$pr' }
  ];

  if (departmentId) {
    deptSpendPipeline.push({
      $match: { 'pr.department': new mongoose.Types.ObjectId(departmentId) }
    });
  }

  deptSpendPipeline.push(
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 31 }
  );

  const deptSpendTrend = await PurchaseOrder.aggregate(deptSpendPipeline);

  return [
    {
      id: 'requisitionStatus',
      title: 'Requisition status',
      kind: 'horizontal',
      format: 'number',
      data: byStatus.map((r) => ({
        label: String(r._id).replace(/_/g, ' '),
        value: r.value || 0
      }))
    },
    {
      id: 'deptSpend',
      title: 'Department spend trend',
      kind: 'bar',
      format: 'currency',
      data: deptSpendTrend.map((r) => ({ label: r._id, value: r.value || 0 }))
    },
    {
      id: 'itemsRequested',
      title: 'Items requested over time',
      kind: 'bar',
      format: 'number',
      data: requestTrend.map((r) => ({ label: r._id, value: r.value || 0 }))
    }
  ];
}

async function buildEndUserCharts(start: Date, userId?: string): Promise<ReportChartConfig[]> {
  const filter: Record<string, unknown> = {
    isDeleted: false,
    createdAt: { $gte: start }
  };
  if (userId) {
    filter.requestedBy = new mongoose.Types.ObjectId(userId);
  }

  const byStatus = await PurchaseRequisition.aggregate([
    { $match: filter },
    { $group: { _id: '$status', value: { $sum: 1 } } },
    { $sort: { value: -1 } }
  ]);

  const trend = await PurchaseRequisition.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        value: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 31 }
  ]);

  return [
    {
      id: 'myRequisitionStatus',
      title: 'My requisitions by status',
      kind: 'horizontal',
      format: 'number',
      data: byStatus.map((r) => ({
        label: String(r._id).replace(/_/g, ' '),
        value: r.value || 0
      }))
    },
    {
      id: 'myRequestTrend',
      title: 'My requests over time',
      kind: 'bar',
      format: 'number',
      data: trend.map((r) => ({ label: r._id, value: r.value || 0 }))
    }
  ];
}

async function buildSupplierCharts(start: Date, supplierProfileId?: string): Promise<ReportChartConfig[]> {
  if (!supplierProfileId) {
    return [];
  }

  const supplierOid = new mongoose.Types.ObjectId(supplierProfileId);

  const quotationStatus = await Quotation.aggregate([
    {
      $match: {
        isDeleted: false,
        supplier: supplierOid,
        createdAt: { $gte: start }
      }
    },
    { $group: { _id: '$status', value: { $sum: 1 } } },
    { $sort: { value: -1 } }
  ]);

  const poTrend = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
        supplier: supplierOid,
        createdAt: { $gte: start }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 31 }
  ]);

  return [
    {
      id: 'quotationStatus',
      title: 'My quotations by status',
      kind: 'horizontal',
      format: 'number',
      data: quotationStatus.map((r) => ({
        label: String(r._id).replace(/_/g, ' '),
        value: r.value || 0
      }))
    },
    {
      id: 'poValueTrend',
      title: 'Purchase order value trend',
      kind: 'bar',
      format: 'currency',
      data: poTrend.map((r) => ({ label: r._id, value: r.value || 0 }))
    }
  ];
}

async function buildFinanceCharts(range?: string): Promise<ReportChartConfig[]> {
  const start = parseRangeStart(range);
  const procurement = await buildProcurementCharts(range);

  const bySupplier = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
        createdAt: { $gte: start },
        status: { $in: ['approved', 'issued', 'partially_received', 'completed'] }
      }
    },
    {
      $lookup: {
        from: 'supplierprofiles',
        localField: 'supplier',
        foreignField: '_id',
        as: 'sup'
      }
    },
    { $unwind: '$sup' },
    {
      $group: {
        _id: '$sup.companyName',
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { value: -1 } },
    { $limit: 8 }
  ]);

  return [
    {
      id: 'spendTrend',
      title: 'Monthly commitments (spend trend)',
      kind: 'bar',
      format: 'currency',
      data: procurement.spendTrend
    },
    {
      id: 'departmentSpend',
      title: 'Spend by department',
      kind: 'horizontal',
      format: 'currency',
      data: procurement.departmentSpend
    },
    {
      id: 'supplierSpend',
      title: 'Spend by supplier',
      kind: 'horizontal',
      format: 'currency',
      data: bySupplier.map((r) => ({ label: r._id || 'Unknown', value: r.value || 0 }))
    },
    {
      id: 'poDistribution',
      title: 'PO value by status',
      kind: 'horizontal',
      format: 'currency',
      data: procurement.distribution
    }
  ];
}

async function buildProcurementRoleCharts(range?: string): Promise<ReportChartConfig[]> {
  const start = parseRangeStart(range);
  const procurement = await buildProcurementCharts(range);

  const rfqStatus = await RFQ.aggregate([
    { $match: { isDeleted: false, createdAt: { $gte: start } } },
    { $group: { _id: '$status', value: { $sum: 1 } } },
    { $sort: { value: -1 } }
  ]);

  return [
    {
      id: 'spendTrend',
      title: 'Procurement spend trend',
      kind: 'bar',
      format: 'currency',
      data: procurement.spendTrend
    },
    {
      id: 'rfqStats',
      title: 'RFQ statistics',
      kind: 'horizontal',
      format: 'number',
      data: rfqStatus.map((r) => ({
        label: String(r._id).replace(/_/g, ' '),
        value: r.value || 0
      }))
    },
    {
      id: 'departmentSpend',
      title: 'Spend by department',
      kind: 'horizontal',
      format: 'currency',
      data: procurement.departmentSpend
    },
    {
      id: 'poDistribution',
      title: 'PO summary by status',
      kind: 'horizontal',
      format: 'currency',
      data: procurement.distribution
    }
  ];
}

export async function buildRoleReportCharts(
  role: string,
  range?: string,
  opts?: { departmentId?: string; userId?: string; supplierProfileId?: string }
): Promise<ReportChartConfig[]> {
  const start = parseRangeStart(range);

  switch (role) {
    case 'stores_officer':
      return buildStoresCharts(start);
    case 'department_head':
      return buildDepartmentHeadCharts(start, opts?.departmentId);
    case 'end_user':
      return buildEndUserCharts(start, opts?.userId);
    case 'supplier':
      return buildSupplierCharts(start, opts?.supplierProfileId);
    case 'finance':
      return buildFinanceCharts(range);
    case 'coo':
    case 'admin': {
      const procurement = await buildProcurementCharts(range);
      return [
        {
          id: 'spendTrend',
          title: 'Total spend overview',
          kind: 'bar',
          format: 'currency',
          data: procurement.spendTrend
        },
        {
          id: 'departmentSpend',
          title: 'Department spend',
          kind: 'horizontal',
          format: 'currency',
          data: procurement.departmentSpend
        },
        {
          id: 'poDistribution',
          title: 'Procurement performance (PO by status)',
          kind: 'horizontal',
          format: 'currency',
          data: procurement.distribution
        }
      ];
    }
    case 'procurement_officer':
      return buildProcurementRoleCharts(range);
    default: {
      const procurement = await buildProcurementCharts(range);
      return [
        {
          id: 'spendTrend',
          title: 'Spend trend',
          kind: 'bar',
          format: 'currency',
          data: procurement.spendTrend
        },
        {
          id: 'departmentSpend',
          title: 'Department spend',
          kind: 'horizontal',
          format: 'currency',
          data: procurement.departmentSpend
        },
        {
          id: 'poDistribution',
          title: 'PO value by status',
          kind: 'horizontal',
          format: 'currency',
          data: procurement.distribution
        }
      ];
    }
  }
}
