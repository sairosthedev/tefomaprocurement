import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { Truck, Eye, Loader2, CheckCircle, XCircle, Clock, Package } from 'lucide-react';
import Modal from '../../components/Modal';
import { formatCurrency } from '../../lib/constants';

const statusColors = {
  received: 'bg-blue-100 text-blue-700',
  inspected: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  partially_accepted: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700'
};

export default function MyDeliveries() {
  const { showToast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchMyDeliveries();
  }, []);

  const fetchMyDeliveries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/deliveries');
      if (response.data.success) {
        setDeliveries(response.data.data || []);
      } else {
        showToast(response.data.message || 'Failed to load deliveries', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
      showToast(error.response?.data?.message || 'Failed to load deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Deliveries</h1>
        <p className="text-gray-500 mt-1">Track your goods deliveries and GRV status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Total Deliveries</p>
              <p className="text-2xl font-bold text-blue-700">{deliveries.length}</p>
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
                {deliveries.filter(d => d.status === 'accepted').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600">Under Inspection</p>
              <p className="text-2xl font-bold text-purple-700">
                {deliveries.filter(d => d.status === 'inspected' || d.status === 'received').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Package className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">Partial</p>
              <p className="text-2xl font-bold text-amber-700">
                {deliveries.filter(d => d.isPartialDelivery).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No deliveries recorded yet</p>
            <p className="text-sm text-gray-400 mt-1">Deliveries will appear here after goods are received by Stores</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">GRV #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">PO Number</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Delivery Note</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Delivery Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Type</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliveries.map((delivery) => (
                  <tr key={delivery._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {delivery.grvNumber}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm text-gray-600">
                        {delivery.purchaseOrder?.poNumber || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">
                        {delivery.deliveryNoteNumber || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {new Date(delivery.deliveryDate).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{delivery.items?.length || 0} items</span>
                    </td>
                    <td className="py-4 px-6">
                      {delivery.isPartialDelivery ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Partial
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Full
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[delivery.status] || statusColors.received}`}>
                        {delivery.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => { setSelectedDelivery(delivery); setShowViewModal(true); }}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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
        title="Delivery Details"
        size="lg"
      >
        {selectedDelivery && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">GRV Number</label>
                <p className="font-mono font-medium text-primary">{selectedDelivery.grvNumber}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">PO Number</label>
                <p className="font-mono text-gray-900">{selectedDelivery.purchaseOrder?.poNumber || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Note Number</label>
                <p className="text-gray-900">{selectedDelivery.deliveryNoteNumber || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Date</label>
                <p className="text-gray-900">
                  {new Date(selectedDelivery.deliveryDate).toLocaleDateString('en-ZA')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[selectedDelivery.status]}`}>
                    {selectedDelivery.status?.replace('_', ' ')}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Type</label>
                <p>
                  {selectedDelivery.isPartialDelivery ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Partial Delivery
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Full Delivery
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Received By</label>
                <p className="text-gray-900">
                  {selectedDelivery.receivedBy?.firstName} {selectedDelivery.receivedBy?.lastName}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Received Date</label>
                <p className="text-gray-900">
                  {new Date(selectedDelivery.createdAt).toLocaleDateString('en-ZA')}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Delivered Items</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Ordered</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Received</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Rejected</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDelivery.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm font-medium">{item.description}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.quantityOrdered || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 font-medium">{item.quantityReceived}</td>
                        <td className="py-3 px-4 text-sm text-red-600">{item.quantityRejected || 0}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            item.condition === 'good' ? 'bg-green-100 text-green-700' :
                            item.condition === 'damaged' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {item.condition || 'good'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedDelivery.notes && (
              <div>
                <label className="text-sm text-gray-500">Notes</label>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedDelivery.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

