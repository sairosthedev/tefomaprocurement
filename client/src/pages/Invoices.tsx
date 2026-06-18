import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { useToast } from '../components/Toast';
import { Loader2, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import ViewButton from '../components/ViewButton';
import PageHeader from '../components/PageHeader';

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  variance: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  paid: 'bg-emerald-100 text-emerald-700',
  partially_paid: 'bg-cyan-100 text-cyan-700'
};

export default function Invoices() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await financeAPI.getInvoices({ search, status: statusFilter });
      setInvoices(res.data.data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Invoices"
        subtitle="Three-way match and accounts payable"
        actions={
          <button
            onClick={() => navigate('/app/payments')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Payments
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="variance">Variance</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No invoices found</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Invoice</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">PO</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Supplier</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Amount</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Match</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-medium">{inv.invoiceNumber}</td>
                  <td className="p-4">{inv.purchaseOrder?.poNumber || '—'}</td>
                  <td className="p-4">{inv.supplier?.companyName || '—'}</td>
                  <td className="p-4">{formatCurrency(inv.totalAmount)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100'}`}>
                      {formatStatus(inv.status)}
                    </span>
                  </td>
                  <td className="p-4">
                    {inv.matchResult?.matched ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </td>
                  <td className="p-4">
                    <ViewButton onClick={() => navigate(`/app/invoices/${inv._id}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
