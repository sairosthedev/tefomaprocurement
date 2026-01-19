import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { ShoppingCart, Eye, Loader2, CheckCircle, Truck, Download } from 'lucide-react';
import Modal from '../../components/Modal';
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
  cancelled: 'bg-gray-100 text-gray-700',
  // Legacy statuses for backward compatibility
  sent: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700'
};

export default function MyPurchaseOrders() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [acknowledgeData, setAcknowledgeData] = useState({
    deliveryNoteNumber: '',
    expectedDeliveryDate: ''
  });

  useEffect(() => {
    fetchMyPurchaseOrders();
  }, []);

  const fetchMyPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/purchase-orders');
      if (response.data.success) {
        console.log('Purchase orders received:', response.data.data);
        setPurchaseOrders(response.data.data || []);
      } else {
        console.error('Failed to fetch purchase orders:', response.data.message);
        showToast(response.data.message || 'Failed to load purchase orders', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      showToast(error.response?.data?.message || 'Failed to load purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAcknowledgeModal = (po) => {
    setSelectedPO(po);
    setAcknowledgeData({
      deliveryNoteNumber: '',
      expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().split('T')[0] : ''
    });
    setShowAcknowledgeModal(true);
  };

  const handleAcknowledge = async () => {
    if (!selectedPO) return;
    
    try {
      await api.put(`/supplier/purchase-orders/${selectedPO._id}/acknowledge`, {
        deliveryNoteNumber: acknowledgeData.deliveryNoteNumber.trim() || undefined,
        expectedDeliveryDate: acknowledgeData.expectedDeliveryDate || undefined
      });
      showToast('Purchase order acknowledged', 'success');
      setShowAcknowledgeModal(false);
      setAcknowledgeData({ deliveryNoteNumber: '', expectedDeliveryDate: '' });
      fetchMyPurchaseOrders();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to acknowledge', 'error');
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Purchase Orders</h1>
        <p className="text-gray-500 mt-1">View and manage received purchase orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">New Orders</p>
              <p className="text-2xl font-bold text-blue-700">
                {purchaseOrders.filter(po => po.status === 'approved' || po.status === 'issued').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Truck className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">In Progress</p>
              <p className="text-2xl font-bold text-amber-700">
                {purchaseOrders.filter(po => ['issued', 'partially_received'].includes(po.status)).length}
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
              <p className="text-sm text-green-600">Completed</p>
              <p className="text-2xl font-bold text-green-700">
                {purchaseOrders.filter(po => po.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Orders List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No purchase orders received yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">PO #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Total Value</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Delivery Expected</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchaseOrders.map((po) => (
                  <tr key={po._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {po.poNumber}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {po.issuedAt 
                          ? new Date(po.issuedAt).toLocaleDateString('en-ZA')
                          : new Date(po.createdAt).toLocaleDateString('en-ZA')}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{po.items?.length || 0} items</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(po.totalAmount, po.currency || 'USD')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {po.expectedDeliveryDate 
                        ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-ZA')
                        : '-'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[po.status] || statusColors.sent}`}>
                        {po.status?.replace('_', ' ') || 'Received'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedPO(po); setShowViewModal(true); }}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {(po.status === 'approved' || po.status === 'issued') && !po.isAcknowledged && (
                          <button
                            onClick={() => openAcknowledgeModal(po)}
                            className="px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Acknowledge
                          </button>
                        )}
                        {po.isAcknowledged && (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 text-sm font-medium bg-green-100 text-green-700 rounded-lg">
                              Acknowledged
                            </span>
                            {po.status === 'issued' && (
                              <button
                                onClick={() => navigate('/app/my-deliveries')}
                                className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                Manage Delivery
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        {selectedPO && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>PO Number:</strong> {selectedPO.poNumber}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <strong>Total Value:</strong> {formatCurrency(selectedPO.totalAmount, selectedPO.currency || 'USD')}
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
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
              >
                Confirm Acknowledgment
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Purchase Order Details"
        size="lg"
      >
        {selectedPO && (
          <div className="space-y-6">
            {/* Acknowledgment Info */}
            {selectedPO.isAcknowledged && (selectedPO.status === 'issued' || selectedPO.status === 'approved') && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-800">Purchase Order Acknowledged</p>
                    <p className="text-sm text-green-700 mt-2">
                      <strong>Next Steps:</strong>
                    </p>
                    <ol className="text-sm text-green-700 mt-1 space-y-1 list-decimal list-inside ml-2">
                      <li>Prepare and deliver the goods to the delivery address specified below</li>
                      <li>Stores will receive the goods and validate them against this PO</li>
                      <li>Stores will create a GRV (Goods Received Voucher) in the system</li>
                      <li>Your delivery will appear in <strong>"My Deliveries"</strong> once Stores has received and processed the goods</li>
                    </ol>
                    <p className="text-xs text-green-600 mt-2 italic">
                      Note: Deliveries are only created by Stores when they physically receive the goods. Acknowledging a PO does not create a delivery record.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-500">PO Number</label>
                <p className="font-mono text-xl font-bold text-primary">{selectedPO.poNumber}</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Total Value</label>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(selectedPO.totalAmount, selectedPO.currency || 'USD')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[selectedPO.status]}`}>
                    {selectedPO.status?.replace('_', ' ')}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Expected Delivery</label>
                <p className="text-gray-900">
                  {selectedPO.expectedDeliveryDate 
                    ? new Date(selectedPO.expectedDeliveryDate).toLocaleDateString('en-ZA')
                    : 'Not specified'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Payment Terms</label>
                <p className="text-gray-900">{selectedPO.paymentTerms || 'Net 30'}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Order Items</label>
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
                    {selectedPO.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm font-medium">{item.description}</td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4 text-sm">
                          {formatCurrency(item.unitPrice, selectedPO.currency || 'USD')}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">
                          {formatCurrency(item.totalPrice || item.quantity * item.unitPrice, selectedPO.currency || 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedPO.deliveryAddress && (
              <div>
                <label className="text-sm text-gray-500">Delivery Address</label>
                <p className="text-gray-900">{selectedPO.deliveryAddress}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

