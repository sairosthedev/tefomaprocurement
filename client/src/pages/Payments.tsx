import React, { useEffect, useState } from 'react';
import { financeAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { Loader2 } from 'lucide-react';

export default function Payments() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await financeAPI.getPayments();
      setPayments(res.data.data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Payments" />

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
                  <td className="p-4">{formatCurrency(p.amount)}</td>
                  <td className="p-4">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="p-4 capitalize">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
