import React, { useEffect, useState } from 'react';
import { financeAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import { Loader2, Calendar } from 'lucide-react';

function nextPaymentRun(): { date: Date; label: string; daysAway: number } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const candidates = [2, 4]; // Tuesday=2, Thursday=4
  let daysUntil = candidates.map(d => (d - day + 7) % 7 || 7).sort((a, b) => a - b)[0];
  const date = new Date(now);
  date.setDate(now.getDate() + daysUntil);
  const label = daysUntil === 1 ? 'Tomorrow' : daysUntil === 0 ? 'Today' : date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' });
  return { date, label, daysAway: daysUntil };
}

export default function Payments() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await financeAPI.getPayments({ page, limit: DEFAULT_PAGE_SIZE });
      setPayments(res.data.data);
      setPagination(parsePagination(res.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Payments" />

      {(() => {
        const { label, daysAway } = nextPaymentRun();
        const cls = daysAway <= 1 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800';
        return (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-6 text-sm ${cls}`}>
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>Next payment run: <strong>{label}</strong> — payments are processed on Tuesdays and Thursdays only (§ procedure).</span>
          </div>
        );
      })()}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No payments recorded yet. Record payment from an approved invoice.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Payment #</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Supplier</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Amount</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left p-4 text-sm font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-b">
                  <td className="p-4 font-medium">{p.paymentNumber}</td>
                  <td className="p-4">{p.supplier?.companyName}</td>
                  <td className="p-4">{formatCurrency(p.amount, p.currency || p.invoice?.currency || getCurrentSbuCurrency())}</td>
                  <td className="p-4">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="p-4 capitalize">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
            itemLabel="payments"
          />
        </div>
      )}
    </div>
  );
}
