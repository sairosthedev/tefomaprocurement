import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  Users, 
  Send,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  DollarSign
} from 'lucide-react';

const statusColors: any = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  closed: 'bg-amber-100 text-amber-700',
  evaluating: 'bg-purple-100 text-purple-700',
  awarded: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

export default function RFQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<any>(true);
  const [rfq, setRfq] = useState<any>(null);

  useEffect(() => {
    fetchRFQ();
  }, [id]);

  const fetchRFQ = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getRFQ(id);
      if (response.data.success) {
        setRfq(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching RFQ:', error);
      showToast(error.response?.data?.message || 'Failed to load RFQ details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      await procurementAPI.publishRFQ(id);
      showToast('RFQ published successfully', 'success');
      fetchRFQ();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to publish RFQ', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">RFQ not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/app/rfqs')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RFQs
        </button>
      </div>

      {/* Hero Section with Green Background and SVG */}
      <div className="bg-gradient-to-br from-green-50 via-green-100/50 to-green-50 rounded-2xl p-8 border border-green-200 relative overflow-hidden mb-6">
        {/* Decorative SVG/Pattern */}
        <div className="absolute top-0 right-0 w-80 h-80 opacity-10">
          <svg viewBox="0 0 300 300" className="w-full h-full text-green-600">
            <circle cx="150" cy="150" r="80" fill="currentColor" opacity="0.1" />
            <circle cx="100" cy="100" r="40" fill="currentColor" opacity="0.15" />
            <circle cx="200" cy="200" r="50" fill="currentColor" opacity="0.1" />
            <path d="M50,150 Q150,50 250,150 T450,150" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
            <path d="M50,200 Q150,100 250,200 T450,200" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.15" />
          </svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/90 rounded-2xl shadow-sm">
                <FileText className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{rfq.title}</h1>
                <p className="text-sm text-gray-600 font-mono">#{rfq.rfqNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[rfq.status]}`}>
                {rfq.status?.charAt(0).toUpperCase() + rfq.status?.slice(1)}
              </span>
              {rfq.status === 'draft' && (
                <button
                  onClick={handlePublish}
                  className="px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Publish RFQ
                </button>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Items</p>
              <p className="text-2xl font-bold text-gray-900">{rfq.items?.length || 0}</p>
            </div>
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Suppliers</p>
              <p className="text-2xl font-bold text-gray-900">{rfq.invitedSuppliers?.length || 0}</p>
            </div>
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Status</p>
              <p className="text-sm font-semibold text-gray-900 capitalize">{rfq.status}</p>
            </div>
            <div className="bg-white/90 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-xs text-gray-600 mb-1">Deadline</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">RFQ Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">RFQ Number</label>
              <p className="text-sm font-medium text-gray-900 mt-1">{rfq.rfqNumber}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{rfq.status}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Submission Deadline</label>
              <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(rfq.submissionDeadline).toLocaleDateString()}
              </p>
            </div>
            {rfq.createdBy && (
              <div>
                <label className="text-sm text-gray-500">Created By</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {rfq.createdBy.firstName} {rfq.createdBy.lastName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {rfq.description && (
          <div>
            <label className="text-sm text-gray-500">Description</label>
            <p className="text-sm text-gray-900 mt-2">{rfq.description}</p>
          </div>
        )}

        {/* Items */}
        {rfq.items && rfq.items.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Requested Items</h3>
            <div className="space-y-3">
              {rfq.items.map((item: any, index: any) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.description}</h4>
                      {item.specifications && (
                        <p className="text-sm text-gray-600 mt-1">{item.specifications}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invited Suppliers */}
        {rfq.invitedSuppliers && rfq.invitedSuppliers.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Invited Suppliers ({rfq.invitedSuppliers.length})
            </h3>
            <div className="space-y-2">
              {rfq.invitedSuppliers.map((invitation: any, index: any) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {invitation.supplier?.companyName || 'Supplier'}
                    </p>
                    {invitation.responded && (
                      <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-3 w-3" />
                        Submitted
                      </span>
                    )}
                  </div>
                  {invitation.quotation && (
                    <a
                      href={`/app/quotations/${invitation.quotation._id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View Quotation
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terms & Conditions */}
        {rfq.termsAndConditions && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Terms & Conditions</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.termsAndConditions}</p>
          </div>
        )}

        {/* Delivery Requirements */}
        {rfq.deliveryRequirements && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delivery Requirements</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.deliveryRequirements}</p>
          </div>
        )}

        {/* Payment Terms */}
        {rfq.paymentTerms && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Terms</h3>
            <p className="text-sm text-gray-700 whitespace-pre-line">{rfq.paymentTerms}</p>
          </div>
        )}
      </div>
    </div>
  );
}
