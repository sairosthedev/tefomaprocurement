import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { procurementAPI, financeAPI } from '../lib/api';
import { 
  ArrowLeft, ShoppingCart, Package, User, Building2, 
  Calendar, DollarSign, Loader2, CheckCircle, Clock, ExternalLink, FileText
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const isFinance = user?.role === 'finance';

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = isFinance 
        ? await financeAPI.getPurchaseOrderById(id)
        : await procurementAPI.getPurchaseOrderById(id);
      
      if (response.data.success && response.data.data) {
        setOrder(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch purchase order:', error);
      showToast(error.response?.data?.message || 'Failed to load purchase order details', 'error');
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

  if (!order) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/app/purchase-orders')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </button>
        <div className="text-center py-12">
          <p className="text-gray-500">Purchase Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/app/purchase-orders')}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Purchase Orders
      </button>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{order.poNumber}</h1>
        <p className="text-gray-600 mt-1">Purchase Order Details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" />
              Items ({order.items?.length || 0})
            </h2>
            <div className="space-y-4">
              {order.items?.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{item.description}</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 font-medium">{item.quantity} {item.unit || 'Each'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Unit Price:</span>
                      <span className="ml-2 font-medium">{formatCurrency(item.unitPrice, order.quotation?.currency || 'USD')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <span className="ml-2 font-medium">{formatCurrency(item.totalPrice, order.quotation?.currency || 'USD')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Related Requisition */}
          {order.purchaseRequisition && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Related Requisition
                </h2>
                <button
                  onClick={() => navigate(`/app/requisitions/${order.purchaseRequisition._id || order.purchaseRequisition}`)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Requisition
                </button>
              </div>
              <div>
                <p className="font-mono font-medium text-primary">
                  {order.purchaseRequisition.requisitionNumber || order.purchaseRequisition}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Supplier</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" />
                  {order.supplier?.companyName || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    order.status === 'approved' ? 'bg-green-100 text-green-700' :
                    order.status === 'pending_approvals' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status}
                  </span>
                </p>
              </div>
              {order.totalAmount && (
                <div>
                  <label className="text-sm text-gray-500">Total Amount</label>
                  <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(order.totalAmount, order.quotation?.currency || 'USD')}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-500">Created</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(order.createdAt).toLocaleDateString('en-ZA')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

