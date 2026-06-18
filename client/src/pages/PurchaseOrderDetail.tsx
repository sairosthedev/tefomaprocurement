import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { procurementAPI, financeAPI, cooAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/constants';
import PageHeader from '../components/PageHeader';
import { 
  ShoppingCart, 
  Calendar, 
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  DollarSign,
  FileText,
  Truck,
  User
} from 'lucide-react';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  pending_finance: 'bg-amber-100 text-amber-700',
  pending_coo: 'bg-purple-100 text-purple-700',
  pending_approvals: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  issued: 'bg-blue-100 text-blue-700',
  partially_received: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState<any>(true);
  const [po, setPo] = useState<any>(null);
  const [submitting, setSubmitting] = useState<any>(false);

  const isProcurement = user?.role === 'procurement_officer' || user?.role === 'admin';
  const isFinance = user?.role === 'finance';
  const isCOO = user?.role === 'coo';

  useEffect(() => {
    fetchPurchaseOrder();
  }, [id]);

  const fetchPurchaseOrder = async () => {
    try {
      setLoading(true);
      let response: any;
      if (isFinance) {
        response = await financeAPI.getPurchaseOrder(id);
      } else if (isCOO) {
        response = await cooAPI.getPurchaseOrder(id);
      } else {
        response = await procurementAPI.getPurchaseOrder(id);
      }
      
      if (response.data.success) {
        setPo(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching purchase order:', error);
      showToast(error.response?.data?.message || 'Failed to load purchase order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await procurementAPI.submitPurchaseOrder(id);
      showToast('Purchase order submitted successfully', 'success');
      fetchPurchaseOrder();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit purchase order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Purchase Order not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        backTo="/app/purchase-orders"
        backLabel="Back to Purchase Orders"
        title="Purchase Order"
        subtitle={`#${po.poNumber}`}
        actions={
          <>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[po.status]}`}>
              {po.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase())}
            </span>
            {isProcurement && po.status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Submit for Approval
              </button>
            )}
          </>
        }
      />

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-500">PO Number</label>
              <p className="text-sm font-medium text-gray-900 mt-1 font-mono">{po.poNumber}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">
                {po.status?.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Total Amount</label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {formatCurrency(po.totalAmount || 0)}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Date</label>
              <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(po.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Supplier Info */}
        {po.supplier && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supplier Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Company Name</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{po.supplier.companyName}</p>
              </div>
              {po.supplier.contactEmail && (
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{po.supplier.contactEmail}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Approval Status */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Approval Status</h3>
            {po.status === 'approved' || po.status === 'issued' || po.status === 'partially_received' || po.status === 'completed' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="h-3.5 w-3.5" /> Fully Approved
              </span>
            ) : po.status === 'rejected' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <XCircle className="h-3.5 w-3.5" /> Rejected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <Clock className="h-3.5 w-3.5" /> In approval
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* HOD */}
            <div className={`p-4 rounded-lg ${po.hodApproved ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {po.hodApproved ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                <span className="font-medium text-gray-900">1. HOD Approval</span>
              </div>
              {po.hodApproved ? (
                <div>
                  <p className="text-sm text-green-700">Approved</p>
                  {po.hodApprovedBy && (
                    <p className="text-xs text-gray-600 mt-1">
                      By: {po.hodApprovedBy.firstName} {po.hodApprovedBy.lastName}
                    </p>
                  )}
                  {po.hodApprovedAt && (
                    <p className="text-xs text-gray-600">On: {new Date(po.hodApprovedAt).toLocaleDateString()}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-700">Pending</p>
              )}
            </div>

            {/* Finance */}
            <div className={`p-4 rounded-lg ${po.financeApproved ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {po.financeApproved ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                <span className="font-medium text-gray-900">2. Finance Approval</span>
              </div>
              {po.financeApproved ? (
                <div>
                  <p className="text-sm text-green-700">Approved</p>
                  {po.financeApprovedBy && (
                    <p className="text-xs text-gray-600 mt-1">
                      By: {po.financeApprovedBy.firstName} {po.financeApprovedBy.lastName}
                    </p>
                  )}
                  {po.financeApprovedAt && (
                    <p className="text-xs text-gray-600">On: {new Date(po.financeApprovedAt).toLocaleDateString()}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-700">Pending</p>
              )}
            </div>

            {/* COO — only when required (≥ USD 5,000) */}
            <div className={`p-4 rounded-lg ${
              po.cooApproved
                ? 'bg-green-50 border border-green-200'
                : po.requiresCooApproval
                ? 'bg-purple-50 border border-purple-200'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {po.cooApproved ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : po.requiresCooApproval ? (
                  <Clock className="h-5 w-5 text-purple-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-gray-400" />
                )}
                <span className="font-medium text-gray-900">3. COO Authorization</span>
              </div>
              {po.cooApproved ? (
                <div>
                  <p className="text-sm text-green-700">Approved</p>
                  {po.cooApprovedBy && (
                    <p className="text-xs text-gray-600 mt-1">
                      By: {po.cooApprovedBy.firstName} {po.cooApprovedBy.lastName}
                    </p>
                  )}
                  {po.cooApprovedAt && (
                    <p className="text-xs text-gray-600">On: {new Date(po.cooApprovedAt).toLocaleDateString()}</p>
                  )}
                </div>
              ) : po.requiresCooApproval ? (
                <p className="text-sm text-purple-700">Pending</p>
              ) : (
                <p className="text-sm text-gray-500">Not required (below USD 5,000)</p>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        {po.items && po.items.length > 0 && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Description</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Quantity</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item: any, index: any) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.unit && (
                          <p className="text-xs text-gray-500 mt-1">Unit: {item.unit}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">{item.quantity}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-900">
                        {formatCurrency(item.unitPrice || 0)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                        {formatCurrency((item.quantity || 0) * (item.unitPrice || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="py-3 px-4 text-right font-semibold text-gray-900">
                      Total Amount:
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                      {formatCurrency(po.totalAmount || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Related Requisition */}
        {po.purchaseRequisition && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Related Requisition</h3>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{po.purchaseRequisition.requisitionNumber}</span>
              {' - '}
              {po.purchaseRequisition.title}
            </p>
            {po.purchaseRequisition.department && (
              <p className="text-xs text-gray-500 mt-1">
                Department: {po.purchaseRequisition.department.name}
              </p>
            )}
          </div>
        )}

        {/* Created By */}
        {po.createdBy && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <User className="h-5 w-5" />
              Created By
            </h3>
            <p className="text-sm text-gray-700">
              {po.createdBy.firstName} {po.createdBy.lastName}
            </p>
            {po.createdBy.email && (
              <p className="text-xs text-gray-500 mt-1">{po.createdBy.email}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
