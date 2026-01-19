import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { procurementAPI, departmentAPI } from '../lib/api';
import { 
  ArrowLeft, FileText, ShoppingCart, Truck, Package, 
  Clock, CheckCircle, XCircle, User, Building2, 
  Calendar, DollarSign, Loader2, Eye, ExternalLink
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  pending_acceptance: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  sourcing: 'bg-blue-100 text-blue-700',
  quoted: 'bg-indigo-100 text-indigo-700',
  ordered: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500'
};

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requisition, setRequisition] = useState(null);
  const [loading, setLoading] = useState(true);

  const isProcurement = user?.role === 'procurement_officer' || user?.role === 'admin';

  useEffect(() => {
    fetchRequisition();
  }, [id]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      const response = isProcurement 
        ? await procurementAPI.getRequisitionById(id)
        : await departmentAPI.getRequisitionById(id);
      
      if (response.data.success && response.data.data) {
        setRequisition(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch requisition:', error);
      showToast(error.response?.data?.message || 'Failed to load requisition details', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/app/requisitions')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requisitions
        </button>
        <div className="text-center py-12">
          <p className="text-gray-500">Requisition not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/app/requisitions')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requisitions
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {requisition.requisitionNumber || `REQ-${requisition._id.slice(-6).toUpperCase()}`}
            </h1>
            <p className="text-gray-600 mt-1">{requisition.title || 'Untitled Requisition'}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[requisition.status] || statusColors.draft}`}>
            {requisition.status?.charAt(0).toUpperCase() + requisition.status?.slice(1) || 'Draft'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Items ({requisition.items?.length || 0})
              </h2>
            </div>
            <div className="space-y-4">
              {requisition.items?.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">{item.description}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Quantity:</span>
                          <span className="ml-2 font-medium">{item.quantity} {item.unit || 'Each'}</span>
                        </div>
                        {item.estimatedCost && (
                          <div>
                            <span className="text-gray-500">Estimated Cost:</span>
                            <span className="ml-2 font-medium">{formatCurrency(item.estimatedCost, 'USD')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Order Section */}
          {requisition.purchaseOrder && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Purchase Order
                </h2>
                <button
                  onClick={() => navigate(`/app/purchase-orders/${requisition.purchaseOrder._id}`)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  View PO Details
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">PO Number</label>
                    <p className="font-mono font-medium text-primary text-lg">
                      {requisition.purchaseOrder.poNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Supplier</label>
                    <p className="font-medium text-gray-900">
                      {requisition.purchaseOrder.supplier?.companyName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Status</label>
                    <p>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        requisition.purchaseOrder.status === 'approved' ? 'bg-green-100 text-green-700' :
                        requisition.purchaseOrder.status === 'pending_approvals' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {requisition.purchaseOrder.status}
                      </span>
                    </p>
                  </div>
                  {requisition.purchaseOrder.totalAmount && (
                    <div>
                      <label className="text-sm text-gray-500">Total Amount</label>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(requisition.purchaseOrder.totalAmount, requisition.purchaseOrder.quotation?.currency || 'USD')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RFQ Section */}
          {requisition.rfq && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Request for Quotation
                </h2>
                <button
                  onClick={() => navigate(`/app/rfqs/${requisition.rfq._id || requisition.rfq}`)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  View RFQ
                </button>
              </div>
              <div>
                <label className="text-sm text-gray-500">RFQ Number</label>
                <p className="font-mono font-medium text-primary">
                  {requisition.rfq.rfqNumber || requisition.rfq}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Requested By</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" />
                  {requisition.requestedBy?.firstName} {requisition.requestedBy?.lastName}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Department</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4" />
                  {requisition.department?.name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Priority</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                    requisition.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    requisition.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {requisition.priority || 'Medium'}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Created</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(requisition.createdAt).toLocaleDateString('en-ZA')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

