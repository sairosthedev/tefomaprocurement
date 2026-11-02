import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementAPI, financeAPI, cooAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { isProcurementHead } from '@fossil/shared';
import FilterSelect from '../components/FilterSelect';
import PageHeader from '../components/PageHeader';
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
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  pending_hod: 'bg-purple-100 text-purple-700',
  pending_dept_hod: 'bg-purple-100 text-purple-700',
  pending_proc_hod: 'bg-fuchsia-100 text-fuchsia-700',
  pending_finance: 'bg-amber-100 text-amber-700',
  pending_coo: 'bg-indigo-100 text-indigo-700',
  pending_approvals: 'bg-blue-100 text-blue-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  issued: 'bg-green-100 text-green-700',
  partially_received: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

const statusIcons: any = {
  draft: Clock,
  pending_hod: Clock,
  pending_dept_hod: Clock,
  pending_proc_hod: Clock,
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
  const [loading, setLoading] = useState<any>(true);
  const [search, setSearch] = useState<any>('');
  const [statusFilter, setStatusFilter] = useState<any>('');
  const [submitting, setSubmitting] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());

  const isFinance = user?.role === 'finance';
  const isCoo = user?.role === 'coo';
  // Raising and submitting POs is procurement's; everyone else here only reads.
  const isProcurement = user?.role === 'procurement_officer' || isProcurementHead(user);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [page, limit, search, statusFilter, isFinance, isCoo]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Each approving role reads from its own scoped endpoint; procurement
      // (officers/admin/procurement head) uses the procurement endpoint.
      const apiToUse = isFinance ? financeAPI : isCoo ? cooAPI : procurementAPI;
      const response = await apiToUse.getPurchaseOrders({ 
        search, 
        status: statusFilter,
        page,
        limit
      });
      setOrders(response.data.data);
      setPagination(parsePagination(response.data.pagination));
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      showToast(error.response?.data?.message || 'Failed to fetch purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };


  const formatStatus = (status: any) => {
    return status.split('_').map((word: any) => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSubmit = async (poId: any) => {
    try {
      setSubmitting(poId);
      await procurementAPI.submitPurchaseOrder(poId);
      showToast('Purchase order submitted for Finance approval', 'success');
      fetchOrders();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit purchase order', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage and track purchase orders"
        bottomSpacing="mb-4"
      />

      {/* Filters */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {isProcurement && (
            <button
              type="button"
              onClick={() => navigate('/app/quotations?status=accepted')}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Create PO from Quotation
            </button>
          )}
          {/* Pushed to the right edge, with or without the button beside it. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:ml-auto">
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search purchase orders..."
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <FilterSelect
              size="sm"
              label="Status"
              options={[
                { value: '', label: 'All' },
                { value: 'draft', label: 'Draft' },
                { value: 'pending_finance', label: 'Pending Finance' },
                { value: 'pending_coo', label: 'Pending COO' },
                { value: 'pending_approvals', label: 'Pending Approvals' },
                { value: 'approved', label: 'Approved' },
                { value: 'issued', label: 'Issued' },
                { value: 'completed', label: 'Completed' }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div>
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
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">PO Number</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Supplier</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total Amount</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Expected Delivery</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Created</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => {
                  const StatusIcon = statusIcons[order.status] || Clock;
                  return (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className="font-medium text-gray-900">{order.poNumber}</span>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-600">
                        {order.supplier?.companyName}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <div className="flex items-center gap-1 font-semibold text-gray-900">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          {formatCurrency(order.totalAmount, order.currency || order.quotation?.currency || getCurrentSbuCurrency())}
                        </div>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-ZA') : '-'}
                        </div>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
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
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isProcurement && order.status === 'draft' && (
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
          <Pagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
          pageSize={limit}
          onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
            itemLabel="purchase orders"
          />
          </>
        )}
      </div>
    </div>
  );
}

