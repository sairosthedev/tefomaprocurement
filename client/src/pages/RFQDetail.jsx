import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { procurementAPI } from '../lib/api';
import { 
  ArrowLeft, FileText, Package, Users, 
  Calendar, Loader2, ExternalLink
} from 'lucide-react';

export default function RFQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [rfq, setRFQ] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRFQ();
  }, [id]);

  const fetchRFQ = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getRFQById(id);
      
      if (response.data.success && response.data.data) {
        setRFQ(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch RFQ:', error);
      showToast(error.response?.data?.message || 'Failed to load RFQ details', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/app/rfqs')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to RFQs
        </button>
        <div className="text-center py-12">
          <p className="text-gray-500">RFQ not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/app/rfqs')}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to RFQs
      </button>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{rfq.rfqNumber}</h1>
        <p className="text-gray-600 mt-1">{rfq.title || 'RFQ Details'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items Section */}
          {rfq.items && rfq.items.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-primary" />
                Items ({rfq.items.length})
              </h2>
              <div className="space-y-4">
                {rfq.items.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">{item.description}</h3>
                    {item.specifications && (
                      <p className="text-sm text-gray-600">{item.specifications}</p>
                    )}
                    {item.quantity && (
                      <p className="text-sm text-gray-500 mt-2">
                        Quantity: {item.quantity} {item.unit || 'Each'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suppliers Section */}
          {rfq.invitedSuppliers && rfq.invitedSuppliers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                Invited Suppliers ({rfq.invitedSuppliers.length})
              </h2>
              <div className="space-y-2">
                {rfq.invitedSuppliers.map((invited, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900">
                      {invited.supplier?.companyName || 'Unknown Supplier'}
                    </p>
                    {invited.quotation && (
                      <p className="text-sm text-gray-600 mt-1">
                        Quotation: {invited.quotation.quotationNumber} - {invited.quotation.status}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Requisition */}
          {rfq.purchaseRequisition && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Related Requisition
                </h2>
                <button
                  onClick={() => navigate(`/app/requisitions/${rfq.purchaseRequisition._id || rfq.purchaseRequisition}`)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Requisition
                </button>
              </div>
              <div>
                <p className="font-mono font-medium text-primary">
                  {rfq.purchaseRequisition.requisitionNumber || rfq.purchaseRequisition}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    rfq.status === 'open' ? 'bg-green-100 text-green-700' :
                    rfq.status === 'closed' ? 'bg-gray-100 text-gray-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {rfq.status}
                  </span>
                </p>
              </div>
              {rfq.submissionDeadline && (
                <div>
                  <label className="text-sm text-gray-500">Submission Deadline</label>
                  <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(rfq.submissionDeadline).toLocaleDateString('en-ZA')}
                  </p>
                </div>
              )}
              {rfq.publishedAt && (
                <div>
                  <label className="text-sm text-gray-500">Published</label>
                  <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(rfq.publishedAt).toLocaleDateString('en-ZA')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

