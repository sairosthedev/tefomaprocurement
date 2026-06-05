import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supplierAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/constants';
import { useToast } from '../../components/Toast';
import { FileText, Loader2, Plus } from 'lucide-react';

export default function MyInvoices() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await supplierAPI.getMyInvoices();
      setInvoices(res.data.data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" />
          My Invoices
        </h1>
        <button
          onClick={() => navigate('/app/submit-invoice')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Submit invoice
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : invoices.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No invoices submitted yet.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4">Invoice</th>
                <th className="text-left p-4">PO</th>
                <th className="text-left p-4">Amount</th>
                <th className="text-left p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-b">
                  <td className="p-4 font-medium">{inv.invoiceNumber}</td>
                  <td className="p-4">{inv.purchaseOrder?.poNumber}</td>
                  <td className="p-4">{formatCurrency(inv.totalAmount)}</td>
                  <td className="p-4 capitalize">{inv.status.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
