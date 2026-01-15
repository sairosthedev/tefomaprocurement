import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { 
  FileSearch, Eye, Clock, Send, Loader2, 
  Calendar, AlertCircle, CheckCircle
} from 'lucide-react';
import Modal from '../../components/Modal';

const statusColors = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  awarded: 'bg-purple-100 text-purple-700'
};

export default function MyRFQs() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rfqs, setRFQs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchMyRFQs();
  }, []);

  const fetchMyRFQs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/rfqs');
      if (response.data.success) {
        setRFQs(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch RFQs:', error);
      showToast('Failed to load RFQs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = (deadline) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end - now;
    
    if (diff <= 0) return { text: 'Closed', urgent: false };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return { text: `${days}d ${hours}h remaining`, urgent: days <= 2 };
    return { text: `${hours}h remaining`, urgent: true };
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My RFQs</h1>
        <p className="text-gray-500 mt-1">View and respond to Request for Quotations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <FileSearch className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Open RFQs</p>
              <p className="text-2xl font-bold text-green-700">
                {rfqs.filter(r => r.status === 'published' && !r.hasSubmitted).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Submitted</p>
              <p className="text-2xl font-bold text-blue-700">
                {rfqs.filter(r => r.hasSubmitted).length}
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
              <p className="text-sm text-amber-600">Closing Soon</p>
              <p className="text-2xl font-bold text-amber-700">
                {rfqs.filter(r => {
                  const remaining = getRemainingTime(r.submissionDeadline);
                  return remaining.urgent && r.status === 'published';
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RFQs List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : rfqs.length === 0 ? (
          <div className="text-center py-12">
            <FileSearch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No RFQs available</p>
            <p className="text-sm text-gray-400 mt-1">You'll be notified when new RFQs are published</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">RFQ #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Title</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Closing</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rfqs.map((rfq) => {
                  const remaining = getRemainingTime(rfq.submissionDeadline);
                  const canSubmit = rfq.status === 'published' && !rfq.hasSubmitted && remaining.text !== 'Closed';
                  
                  return (
                    <tr key={rfq._id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm font-medium text-primary">
                          {rfq.rfqNumber || `RFQ-${rfq._id.slice(-6).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">{rfq.title}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">{rfq.description}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-600">{rfq.items?.length || 0} items</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Clock className={`h-4 w-4 ${remaining.urgent ? 'text-red-500' : 'text-gray-400'}`} />
                          <span className={`text-sm ${remaining.urgent ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {remaining.text}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA')}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        {rfq.hasSubmitted ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Submitted
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[rfq.status] || statusColors.open}`}>
                            {rfq.status === 'published' ? 'Open' : rfq.status}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedRFQ(rfq); setShowViewModal(true); }}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canSubmit && (
                            <button
                              onClick={() => navigate(`/app/submit-quotation?rfq=${rfq._id}`)}
                              className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark"
                            >
                              Submit Quote
                            </button>
                          )}
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="RFQ Details"
        size="lg"
      >
        {selectedRFQ && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">RFQ Number</label>
                <p className="font-mono font-medium text-primary">
                  {selectedRFQ.rfqNumber || `RFQ-${selectedRFQ._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Submission Deadline</label>
                <p className="text-gray-900">
                  {new Date(selectedRFQ.submissionDeadline).toLocaleString('en-ZA')}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Title</label>
              <p className="text-gray-900 font-medium">{selectedRFQ.title}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500">Description</label>
              <p className="text-gray-900">{selectedRFQ.description || 'No description provided'}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Items Required</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">#</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Quantity</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Specification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedRFQ.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">{index + 1}</td>
                        <td className="py-3 px-4 text-sm font-medium">{item.description}</td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">{item.specification || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRFQ.terms && (
              <div>
                <label className="text-sm text-gray-500">Terms & Conditions</label>
                <p className="text-gray-900 text-sm whitespace-pre-wrap">{selectedRFQ.terms}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

