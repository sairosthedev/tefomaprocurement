import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementAPI, financeAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import Tabs from '../components/Tabs';
import { 
  Search, 
  Plus,
  ShoppingCart,
  Calendar,
  DollarSign,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Truck
} from 'lucide-react';
import ViewButton from '../components/ViewButton';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  pending_finance: 'bg-amber-100 text-amber-700',
  pending_coo: 'bg-purple-100 text-purple-700',
  pending_approvals: 'bg-blue-100 text-blue-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  issued: 'bg-green-100 text-green-700',
  partially_received: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

const statusIcons = {
  draft: Clock,
  pending_finance: Clock,
  pending_coo: Clock,
  pending_approvals: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  issued: Send,
  partially_received: Truck,
  completed: CheckCircle,
  cancelled: XCircle
};

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [submitting, setSubmitting] = useState<any>(null);

  const isFinance = user?.role === 'finance';

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter, isFinance]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Use Finance API if user is Finance, otherwise use Procurement API
      const apiToUse = isFinance ? financeAPI : procurementAPI;
      const response = await apiToUse.getPurchaseOrders({ 
        search, 
        status: statusFilter 
      });
      setOrders(response.data.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showToast(error.response?.data?.message || 'Failed to fetch purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };


  const formatStatus = (status) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSubmit = async (poId) => {
    try {
      setSubmitting(poId);
      await procurementAPI.submitPurchaseOrder(poId);
      showToast('Purchase order submitted for Finance approval', 'success');
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to submit purchase order', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500 mt-1">Manage and track purchase orders</p>
        </div>
        {!isFinance && (
          <button 
            onClick={() => navigate('/app/quotations?status=accepted')}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create PO from Quotation
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
          <Tabs
            tabs={[
              { value: '', label: 'All', icon: ShoppingCart },
              { value: 'draft', label: 'Draft', icon: Clock },
              { value: 'pending_finance', label: 'Pending Finance', icon: Clock },
              { value: 'pending_coo', label: 'Pending COO', icon: Clock },
              { value: 'pending_approvals', label: 'Pending Approvals', icon: Clock },
              { value: 'approved', label: 'Approved', icon: CheckCircle },
              { value: 'issued', label: 'Issued', icon: Send },
              { value: 'completed', label: 'Completed', icon: CheckCircle }
            ]}
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
            variant="pills"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No purchase orders found</h3>
            <p className="text-gray-500 mt-1">Create your first purchase order to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    PO Number
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Expected Delivery
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const StatusIcon = statusIcons[order.status] || Clock;
                  return (
                    <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{order.poNumber}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {order.supplier?.companyName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 font-semibold text-gray-900">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          {formatCurrency(order.totalAmount, order.quotation?.currency || 'USD')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-ZA') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {order.status === 'pending_approvals' ? (
                          <div className="flex flex-col gap-1">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${order.financeApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              Finance: {order.financeApproved ? 'Approved' : 'Pending'}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${order.cooApproved ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                              COO: {order.cooApproved ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {formatStatus(order.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isFinance && order.status === 'draft' && (
                            <button
                              onClick={() => handleSubmit(order._id)}
                              disabled={submitting === order._id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-primary text-white hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50"
                            >
                              {submitting === order._id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  Submit for Approval
                                </>
                              )}
                            </button>
                          )}
                          <ViewButton
                            onClick={() => navigate(`/app/purchase-orders/${order._id}`)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

