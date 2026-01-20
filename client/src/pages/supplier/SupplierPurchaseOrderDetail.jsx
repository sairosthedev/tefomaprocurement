import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api, { supplierAPI } from '../../lib/api';
import Modal from '../../components/Modal';
import { 
  ArrowLeft, ShoppingCart, Package, Building2, 
  Calendar, DollarSign, Loader2, CheckCircle, 
  ExternalLink, FileText, Receipt, MapPin, 
  CreditCard, Download, Truck
} from 'lucide-react';
import { formatCurrency } from '../../lib/constants';

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  pending_finance: 'bg-amber-100 text-amber-700',
  pending_coo: 'bg-purple-100 text-purple-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  issued: 'bg-green-100 text-green-700',
  partially_received: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

export default function SupplierPurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [acknowledgeData, setAcknowledgeData] = useState({
    deliveryNoteNumber: '',
    expectedDeliveryDate: ''
  });

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/supplier/purchase-orders/${id}`);
      
      if (response.data.success && response.data.data) {
        setOrder(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch purchase order:', error);
      showToast(error.response?.data?.message || 'Failed to load purchase order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAcknowledgeModal = () => {
    setAcknowledgeData({
      deliveryNoteNumber: '',
      expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0] : ''
    });
    setShowAcknowledgeModal(true);
  };

  const handleAcknowledge = async () => {
    if (!order) return;
    
    try {
      setActionLoading(true);
      await api.put(`/supplier/purchase-orders/${order._id}/acknowledge`, {
        deliveryNoteNumber: acknowledgeData.deliveryNoteNumber.trim() || undefined,
        expectedDeliveryDate: acknowledgeData.expectedDeliveryDate || undefined
      });
      showToast('Purchase order acknowledged successfully', 'success');
      setShowAcknowledgeModal(false);
      setAcknowledgeData({ deliveryNoteNumber: '', expectedDeliveryDate: '' });
      fetchOrder();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to acknowledge purchase order', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloadLoading(true);
      const response = await supplierAPI.downloadPurchaseOrderPDF(id);
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PO-${order.poNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast('PDF downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download PDF:', error);
      showToast(error.response?.data?.message || 'Failed to download PDF', 'error');
    } finally {
      setDownloadLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
      case 'issued':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending_finance':
      case 'pending_coo':
      case 'pending_approvals':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/app/my-purchase-orders')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </button>
        <div className="text-center py-12">
          <p className="text-gray-500">Purchase Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="p-8 pb-0">
        <button
          onClick={() => navigate('/app/my-purchase-orders')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Orders
        </button>
      </div>

      {/* Professional Header with Texture */}
      <div className="px-8 pb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-dark to-primary shadow-2xl">
          {/* Texture Overlay */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}></div>
          
          {/* Content */}
          <div className="relative px-8 py-10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <Receipt className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-1">Purchase Order</p>
                    <h1 className="text-4xl font-bold text-white mb-2">{order.poNumber}</h1>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 mt-6">
                  <div className="flex items-center gap-2 text-white/90">
                    <Calendar className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {order.issuedAt 
                        ? new Date(order.issuedAt).toLocaleDateString('en-ZA', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : new Date(order.createdAt).toLocaleDateString('en-ZA', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                    </span>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full border-2 backdrop-blur-sm ${getStatusColor(order.status)}`}>
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {order.status?.replace('_', ' ') || 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-6">
                {(order.status === 'approved' || order.status === 'issued') && !order.isAcknowledged && (
                  <button
                    onClick={openAcknowledgeModal}
                    disabled={actionLoading}
                    className="flex items-center gap-2 bg-white hover:bg-gray-50 text-primary font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-5 w-5" />
                    Acknowledge PO
                  </button>
                )}
                {order.isAcknowledged && order.status === 'issued' && (
                  <button
                    onClick={() => navigate('/app/my-deliveries')}
                    className="flex items-center gap-2 bg-white hover:bg-gray-50 text-blue-700 font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    <Truck className="h-5 w-5" />
                    Manage Delivery
                  </button>
                )}
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadLoading}
                  className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  {downloadLoading ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Acknowledgment Banner */}
            {order.isAcknowledged && (order.status === 'issued' || order.status === 'approved') && (
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-green-800 text-lg mb-2">Purchase Order Acknowledged</h3>
                    <p className="text-sm text-green-700 mb-3">
                      <strong>Next Steps:</strong>
                    </p>
                    <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside ml-2">
                      <li>Prepare and deliver the goods to the delivery address specified below</li>
                      <li>Stores will receive the goods and validate them against this PO</li>
                      <li>Stores will create a GRV (Goods Received Voucher) in the system</li>
                      <li>Your delivery will appear in <strong>"My Deliveries"</strong> once Stores has received and processed the goods</li>
                    </ol>
                    <p className="text-xs text-green-600 mt-3 italic">
                      Note: Deliveries are only created by Stores when they physically receive the goods. Acknowledging a PO does not create a delivery record.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Items Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  Order Items ({order.items?.length || 0})
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {order.items?.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all bg-gray-50/50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">{item.description}</h3>
                          {item.specifications && (
                            <p className="text-sm text-gray-600 mt-1">{item.specifications}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">
                            {formatCurrency(item.totalPrice || item.quantity * item.unitPrice, order.currency || 'USD')}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quantity</p>
                          <p className="font-semibold text-gray-900">{item.quantity} {item.unit || 'Each'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Unit Price</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(item.unitPrice, order.currency || 'USD')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Line Total</p>
                          <p className="font-semibold text-primary">{formatCurrency(item.totalPrice || item.quantity * item.unitPrice, order.currency || 'USD')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Related RFQ */}
            {order.rfq && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      Related RFQ
                    </h2>
                    <button
                      onClick={() => navigate(`/app/my-rfqs`)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View RFQ
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">RFQ Number</label>
                  <p className="font-mono font-bold text-primary text-lg">
                    {order.rfq.rfqNumber || order.rfq}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Financial Summary */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  Financial Summary
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {order.subtotal && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Subtotal</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(order.subtotal, order.currency || 'USD')}
                    </span>
                  </div>
                )}
                {order.vatAmount && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">VAT</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(order.vatAmount, order.currency || 'USD')}
                    </span>
                  </div>
                )}
                {order.totalAmount && (
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-base font-bold text-gray-900">Total Amount</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(order.totalAmount, order.currency || 'USD')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Details */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  Order Details
                </h3>
              </div>
              <div className="p-6 space-y-5">
                {order.deliveryAddress && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Delivery Address</label>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        {typeof order.deliveryAddress === 'string' ? (
                          <p>{order.deliveryAddress}</p>
                        ) : (
                          <>
                            {order.deliveryAddress.street && <p>{order.deliveryAddress.street}</p>}
                            {order.deliveryAddress.city && <p>{order.deliveryAddress.city}</p>}
                            {order.deliveryAddress.province && <p>{order.deliveryAddress.province}</p>}
                            {order.deliveryAddress.postalCode && <p>{order.deliveryAddress.postalCode}</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {order.expectedDeliveryDate && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Expected Delivery</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <p className="font-semibold text-gray-900">
                        {new Date(order.expectedDeliveryDate).toLocaleDateString('en-ZA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {order.paymentTerms && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Payment Terms</label>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-gray-400" />
                      <p className="font-semibold text-gray-900">{order.paymentTerms}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Order Date</label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="font-semibold text-gray-900">
                      {order.issuedAt 
                        ? new Date(order.issuedAt).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : new Date(order.createdAt).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acknowledge Modal */}
      <Modal
        isOpen={showAcknowledgeModal}
        onClose={() => {
          setShowAcknowledgeModal(false);
          setAcknowledgeData({ deliveryNoteNumber: '', expectedDeliveryDate: '' });
        }}
        title="Acknowledge Purchase Order"
      >
        {order && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>PO Number:</strong> {order.poNumber}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <strong>Total Value:</strong> {formatCurrency(order.totalAmount, order.currency || 'USD')}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-700 mb-4">
                By acknowledging this purchase order, you confirm that you have received it and will proceed with delivery. 
                A pending delivery record will be created for tracking purposes.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Note Number <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={acknowledgeData.deliveryNoteNumber}
                  onChange={(e) => setAcknowledgeData({ ...acknowledgeData, deliveryNoteNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="Enter delivery note number if available"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Delivery Date <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={acknowledgeData.expectedDeliveryDate}
                  onChange={(e) => setAcknowledgeData({ ...acknowledgeData, expectedDeliveryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setShowAcknowledgeModal(false);
                  setAcknowledgeData({ deliveryNoteNumber: '', expectedDeliveryDate: '' });
                }}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={actionLoading}
                className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Acknowledging...' : 'Confirm Acknowledgment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

