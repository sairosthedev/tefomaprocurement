import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { 
  FileCheck, Eye, Loader2, CheckCircle, Award, 
  Scale, BarChart3, Users
} from 'lucide-react';
import Modal from '../components/Modal';
import { formatCurrency } from '../lib/constants';

export default function Evaluations() {
  const { showToast } = useToast();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/procurement/quotations', { params: { status: 'submitted' } });
      if (response.data.success) {
        // Group quotations by RFQ
        const grouped = {};
        (response.data.data || []).forEach(quote => {
          const rfqId = quote.rfq?._id || quote.rfq;
          if (!grouped[rfqId]) {
            grouped[rfqId] = {
              rfq: quote.rfq,
              quotations: []
            };
          }
          grouped[rfqId].quotations.push(quote);
        });
        setEvaluations(Object.values(grouped));
      }
    } catch (error) {
      console.error('Failed to fetch evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAward = async (quotationId) => {
    try {
      await api.put(`/procurement/quotations/${quotationId}/award`);
      showToast('Quotation awarded successfully', 'success');
      fetchEvaluations();
      setShowModal(false);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to award quotation', 'error');
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Quotation Evaluations</h1>
        <p className="text-gray-500 mt-1">Compare and evaluate supplier quotations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Scale className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Pending Evaluation</p>
              <p className="text-2xl font-bold text-blue-700">{evaluations.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600">Total Quotations</p>
              <p className="text-2xl font-bold text-purple-700">
                {evaluations.reduce((sum, e) => sum + e.quotations.length, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Ready to Award</p>
              <p className="text-2xl font-bold text-green-700">
                {evaluations.filter(e => e.quotations.length > 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Evaluations List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : evaluations.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No quotations pending evaluation</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {evaluations.map((evaluation) => (
              <div key={evaluation.rfq?._id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="font-mono text-sm font-medium text-primary">
                      {evaluation.rfq?.rfqNumber || 'RFQ'}
                    </span>
                    <h3 className="font-semibold text-gray-900 mt-1">{evaluation.rfq?.title}</h3>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {evaluation.quotations.length} quotation{evaluation.quotations.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Quotation Comparison Table */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Supplier</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Total Amount</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Delivery</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Payment Terms</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {evaluation.quotations
                        .sort((a, b) => a.totalAmount - b.totalAmount)
                        .map((quote, index) => (
                        <tr key={quote._id} className={index === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {index === 0 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                                  LOWEST
                                </span>
                              )}
                              <span className="text-sm font-medium text-gray-900">
                                {quote.supplier?.companyName || 'Unknown Supplier'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-sm font-semibold ${index === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                              {formatCurrency(quote.totalAmount, quote.currency)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {quote.deliveryDays} days
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {quote.paymentTerms}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setSelectedEvaluation({ ...evaluation, selectedQuote: quote }); setShowModal(true); }}
                                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleAward(quote._id)}
                                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                              >
                                Award
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Quotation Details"
        size="lg"
      >
        {selectedEvaluation?.selectedQuote && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Supplier</label>
                <p className="font-medium text-gray-900">
                  {selectedEvaluation.selectedQuote.supplier?.companyName}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Total Amount</label>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(selectedEvaluation.selectedQuote.totalAmount, selectedEvaluation.selectedQuote.currency)}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Time</label>
                <p className="text-gray-900">{selectedEvaluation.selectedQuote.deliveryDays} days</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Payment Terms</label>
                <p className="text-gray-900">{selectedEvaluation.selectedQuote.paymentTerms}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Line Items</label>
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
                    {selectedEvaluation.selectedQuote.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">
                          {item.description}
                          {item.brand && <span className="text-gray-400 ml-2">({item.brand})</span>}
                        </td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4 text-sm">
                          {formatCurrency(item.unitPrice, selectedEvaluation.selectedQuote.currency)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">
                          {formatCurrency(item.totalPrice || item.quantity * item.unitPrice, selectedEvaluation.selectedQuote.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => handleAward(selectedEvaluation.selectedQuote._id)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700"
              >
                <Award className="h-4 w-4" />
                Award to This Supplier
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

