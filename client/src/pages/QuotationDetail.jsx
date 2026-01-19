import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { procurementAPI } from '../lib/api';
import { 
  ArrowLeft, FileText, Package, Building2, 
  Calendar, DollarSign, Loader2, ExternalLink
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getQuotation(id);
      
      if (response.data.success && response.data.data) {
        setQuotation(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
      showToast(error.response?.data?.message || 'Failed to load quotation details', 'error');
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

  if (!quotation) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/app/quotations')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotations
        </button>
        <div className="text-center py-12">
          <p className="text-gray-500">Quotation not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/app/quotations')}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Quotations
      </button>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{quotation.quotationNumber}</h1>
        <p className="text-gray-600 mt-1">Quotation Details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" />
              Items ({quotation.items?.length || 0})
            </h2>
            <div className="space-y-4">
              {quotation.items?.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{item.description}</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 font-medium">{item.quantity} {item.unit || 'Each'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Unit Price:</span>
                      <span className="ml-2 font-medium">{formatCurrency(item.unitPrice, quotation.currency || 'USD')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <span className="ml-2 font-medium">{formatCurrency(item.totalPrice, quotation.currency || 'USD')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Related RFQ */}
          {quotation.rfq && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Related RFQ
                </h2>
                <button
                  onClick={() => navigate(`/app/rfqs/${quotation.rfq._id || quotation.rfq}`)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  View RFQ
                </button>
              </div>
              <div>
                <p className="font-mono font-medium text-primary">
                  {quotation.rfq.rfqNumber || quotation.rfq}
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
                <label className="text-sm text-gray-500">Supplier</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <Building2 className="h-4 w-4" />
                  {quotation.supplier?.companyName || 'N/A'}
                </p>
              </div>
              {quotation.totalAmount && (
                <div>
                  <label className="text-sm text-gray-500">Total Amount</label>
                  <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(quotation.totalAmount, quotation.currency || 'USD')}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm text-gray-500">Submitted</label>
                <p className="font-medium text-gray-900 flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  {quotation.submittedAt ? new Date(quotation.submittedAt).toLocaleDateString('en-ZA') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

