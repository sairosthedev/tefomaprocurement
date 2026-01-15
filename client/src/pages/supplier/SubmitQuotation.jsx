import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { ArrowLeft, Send, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { CURRENCIES, formatCurrency } from '../../lib/constants';

export default function SubmitQuotation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const rfqId = searchParams.get('rfq');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rfq, setRFQ] = useState(null);
  const [formData, setFormData] = useState({
    currency: 'USD',
    deliveryDays: 7,
    paymentTerms: 'Net 30',
    validityDays: 30,
    notes: '',
    items: []
  });

  useEffect(() => {
    if (rfqId) {
      fetchRFQ();
    } else {
      navigate('/app/my-rfqs');
    }
  }, [rfqId]);

  const fetchRFQ = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/supplier/rfqs/${rfqId}`);
      if (response.data.success) {
        const rfqData = response.data.data;
        setRFQ(rfqData);
        setFormData({
          ...formData,
          items: rfqData.items.map(item => ({
            itemId: item._id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: 0,
            brand: '',
            notes: ''
          }))
        });
      }
    } catch (error) {
      showToast('Failed to load RFQ details', 'error');
      navigate('/app/my-rfqs');
    } finally {
      setLoading(false);
    }
  };

  const updateItemPrice = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => 
      sum + (item.quantity * (parseFloat(item.unitPrice) || 0)), 0
    );
  };

  const handleSubmit = async () => {
    try {
      // Validate
      const invalidItems = formData.items.filter(item => !item.unitPrice || item.unitPrice <= 0);
      if (invalidItems.length > 0) {
        showToast('Please enter unit price for all items', 'error');
        return;
      }

      setSubmitting(true);
      await api.post('/supplier/quotations', {
        rfq: rfqId,
        currency: formData.currency,
        deliveryDays: formData.deliveryDays,
        paymentTerms: formData.paymentTerms,
        validityDays: formData.validityDays,
        notes: formData.notes,
        items: formData.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: parseFloat(item.unitPrice),
          totalPrice: item.quantity * parseFloat(item.unitPrice),
          brand: item.brand,
          notes: item.notes
        })),
        totalAmount: calculateTotal()
      });

      showToast('Quotation submitted successfully', 'success');
      navigate('/app/my-rfqs');
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to submit quotation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/app/my-rfqs')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RFQs
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Submit Quotation</h1>
        <p className="text-gray-500 mt-1">
          For RFQ: <span className="font-mono text-primary">{rfq?.rfqNumber || `RFQ-${rfqId?.slice(-6).toUpperCase()}`}</span>
        </p>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Important Notice</p>
            <p className="text-sm text-amber-600">
              Once submitted, your quotation cannot be edited. Please review all prices carefully before submitting.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* RFQ Info */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 mb-2">{rfq?.title}</h3>
          <p className="text-sm text-gray-600">{rfq?.description}</p>
        </div>

        {/* Quotation Settings */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>{curr.code} - {curr.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery (Days)</label>
            <input
              type="number"
              min="1"
              value={formData.deliveryDays}
              onChange={(e) => setFormData({ ...formData, deliveryDays: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
            <select
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="Cash">Cash</option>
              <option value="Net 7">Net 7</option>
              <option value="Net 14">Net 14</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Valid For (Days)</label>
            <input
              type="number"
              min="1"
              value={formData.validityDays}
              onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Items Pricing */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">Item Pricing</label>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Item</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Qty</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Unit Price *</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Brand</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {formData.items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-gray-900">{item.description}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateItemPrice(index, 'unitPrice', e.target.value)}
                        className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={item.brand}
                        onChange={(e) => updateItemPrice(index, 'brand', e.target.value)}
                        className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                        placeholder="Brand name"
                      />
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {formatCurrency(item.quantity * (parseFloat(item.unitPrice) || 0), formData.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="4" className="py-4 px-4 text-right font-semibold text-gray-700">
                    Grand Total:
                  </td>
                  <td className="py-4 px-4 text-lg font-bold text-primary">
                    {formatCurrency(calculateTotal(), formData.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            placeholder="Any additional information about your quotation..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={() => navigate('/app/my-rfqs')}
            className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Quotation
          </button>
        </div>
      </div>
    </div>
  );
}

