import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { FileText, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import ViewButton from '../../components/ViewButton';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../lib/constants';
import confetti from 'canvas-confetti';

const statusColors = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  awarded: 'bg-purple-100 text-purple-700'
};

export default function MyQuotations() {
  const { showToast } = useToast();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchMyQuotations();
  }, []);

  const fetchMyQuotations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/quotations');
      if (response.data.success) {
        setQuotations(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Quotations</h1>
        <p className="text-gray-500 mt-1">Track your submitted quotations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Submitted</p>
              <p className="text-2xl font-bold text-blue-700">
                {quotations.filter(q => q.status === 'submitted').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">Under Review</p>
              <p className="text-2xl font-bold text-amber-700">
                {quotations.filter(q => q.status === 'under_review').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Accepted</p>
              <p className="text-2xl font-bold text-green-700">
                {quotations.filter(q => q.status === 'accepted' || q.status === 'awarded').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600">Not Awarded</p>
              <p className="text-2xl font-bold text-red-700">
                {quotations.filter(q => q.status === 'rejected').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quotations List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No quotations submitted yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Quote #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">RFQ</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Total Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Submitted</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((quote) => (
                  <tr key={quote._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {quote.quotationNumber || `QT-${quote._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{quote.rfq?.title || 'N/A'}</p>
                      <p className="text-sm text-gray-500 font-mono">{quote.rfq?.rfqNumber}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(quote.totalAmount, quote.currency)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {new Date(quote.createdAt).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[quote.status] || statusColors.submitted}`}>
                        {quote.status === 'accepted' ? 'Accepted' : (quote.status?.replace('_', ' ') || 'Submitted')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => {
                          setSelectedQuotation(quote);
                          setShowViewModal(true);
                          // Trigger confetti if accepted
                          if (quote.status === 'accepted') {
                            setTimeout(() => {
                              confetti({
                                particleCount: 100,
                                spread: 70,
                                origin: { y: 0.6 }
                              });
                              // Second burst
                              setTimeout(() => {
                                confetti({
                                  particleCount: 50,
                                  angle: 60,
                                  spread: 55,
                                  origin: { x: 0 }
                                });
                                confetti({
                                  particleCount: 50,
                                  angle: 120,
                                  spread: 55,
                                  origin: { x: 1 }
                                });
                              }, 250);
                            }, 300);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Quotation Details"
        size="lg"
      >
        {selectedQuotation && (
          <div className="space-y-6">
            {/* Accepted Celebration Banner */}
            {selectedQuotation.status === 'accepted' && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-green-800 text-lg">🎉 Quotation Accepted!</h3>
                    <p className="text-sm text-green-700 mt-1">Congratulations! Your quotation has been accepted by the procurement team.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Quotation Number</label>
                <p className="font-mono font-medium text-primary">
                  {selectedQuotation.quotationNumber || `QT-${selectedQuotation._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[selectedQuotation.status] || statusColors.submitted}`}>
                    {selectedQuotation.status === 'accepted' ? 'Accepted' : (selectedQuotation.status?.replace('_', ' ') || 'Submitted')}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Total Amount</label>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency)}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Time</label>
                <p className="text-gray-900">{selectedQuotation.deliveryDays} days</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Payment Terms</label>
                <p className="text-gray-900">{selectedQuotation.paymentTerms}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Valid Until</label>
                <p className="text-gray-900">
                  {new Date(new Date(selectedQuotation.createdAt).getTime() + selectedQuotation.validityDays * 86400000).toLocaleDateString('en-ZA')}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Items</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Item</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Qty</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Unit Price</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedQuotation.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">
                          <p className="font-medium">{item.description}</p>
                          {item.brand && <p className="text-xs text-gray-500">Brand: {item.brand}</p>}
                        </td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4 text-sm">
                          {formatCurrency(item.unitPrice, selectedQuotation.currency)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">
                          {formatCurrency(item.totalPrice || item.quantity * item.unitPrice, selectedQuotation.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedQuotation.notes && (
              <div>
                <label className="text-sm text-gray-500">Notes</label>
                <p className="text-gray-900 text-sm">{selectedQuotation.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

