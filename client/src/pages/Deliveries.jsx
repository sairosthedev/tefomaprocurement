import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { 
  Plus, Search, Truck, Eye, CheckCircle, 
  Loader2, Package, Calendar, FileText, AlertCircle
} from 'lucide-react';
import Modal from '../components/Modal';
import { formatCurrency } from '../lib/constants';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
};

export default function Deliveries() {
  const { showToast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [pendingPOs, setPendingPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [receiveData, setReceiveData] = useState({
    deliveryNote: '',
    items: []
  });

  useEffect(() => {
    fetchData();
  }, [searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [deliveriesRes, posRes] = await Promise.all([
        api.get('/stores/deliveries', { params: { search: searchTerm } }),
        api.get('/stores/pending-deliveries')
      ]);
      
      if (deliveriesRes.data.success) setDeliveries(deliveriesRes.data.data || []);
      if (posRes.data.success) setPendingPOs(posRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReceiveModal = (po) => {
    setSelectedPO(po);
    setReceiveData({
      deliveryNote: '',
      items: po.items.map(item => ({
        ...item,
        receivedQuantity: item.quantity - (item.receivedQuantity || 0)
      }))
    });
    setShowReceiveModal(true);
  };

  const handleReceive = async () => {
    try {
      if (!receiveData.deliveryNote.trim()) {
        showToast('Please enter delivery note number', 'error');
        return;
      }

      await api.post('/stores/deliveries', {
        purchaseOrder: selectedPO._id,
        deliveryNote: receiveData.deliveryNote,
        items: receiveData.items.map(item => ({
          item: item.item || item._id,
          description: item.description,
          orderedQuantity: item.quantity,
          receivedQuantity: item.receivedQuantity,
          unit: item.unit
        }))
      });

      showToast('Goods received successfully', 'success');
      setShowReceiveModal(false);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to receive goods', 'error');
    }
  };

  const updateReceivedQty = (index, qty) => {
    const newItems = [...receiveData.items];
    newItems[index].receivedQuantity = parseInt(qty) || 0;
    setReceiveData({ ...receiveData, items: newItems });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Receiving (GRV)</h1>
          <p className="text-gray-500 mt-1">Receive and record deliveries</p>
        </div>
      </div>

      {/* Pending Deliveries Alert */}
      {pendingPOs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <Truck className="h-6 w-6 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">
                {pendingPOs.length} Purchase Order{pendingPOs.length > 1 ? 's' : ''} awaiting delivery
              </p>
              <p className="text-sm text-amber-600">Click "Receive" to record incoming goods</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {pendingPOs.slice(0, 3).map(po => (
              <div key={po._id} className="flex items-center justify-between bg-white rounded-xl p-3">
                <div>
                  <span className="font-mono text-sm font-medium text-primary">{po.poNumber}</span>
                  <span className="text-sm text-gray-500 ml-3">{po.supplier?.companyName}</span>
                </div>
                <button
                  onClick={() => openReceiveModal(po)}
                  className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark"
                >
                  Receive
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search deliveries by GRV number, PO number, or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Deliveries List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Deliveries</h2>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No deliveries recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">GRV #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">PO #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Supplier</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Delivery Note</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliveries.map((delivery) => (
                  <tr key={delivery._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-medium text-primary">
                        {delivery.grvNumber || `GRV-${delivery._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm text-gray-600">
                        {delivery.purchaseOrder?.poNumber}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-gray-900">{delivery.purchaseOrder?.supplier?.companyName}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{delivery.deliveryNote}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{delivery.items?.length || 0} items</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {new Date(delivery.receivedAt || delivery.createdAt).toLocaleDateString('en-ZA')}
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

      {/* Receive Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title="Receive Goods"
        size="lg"
      >
        {selectedPO && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">PO Number</label>
                  <p className="font-mono font-medium text-primary">{selectedPO.poNumber}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Supplier</label>
                  <p className="text-gray-900">{selectedPO.supplier?.companyName}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Note Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={receiveData.deliveryNote}
                onChange={(e) => setReceiveData({ ...receiveData, deliveryNote: e.target.value })}
                placeholder="Enter supplier's delivery note number"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Items to Receive</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Item</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Ordered</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receiveData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">{item.description}</td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity - (item.previouslyReceived || 0)}
                            value={item.receivedQuantity}
                            onChange={(e) => updateReceivedQty(index, e.target.value)}
                            className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="GRV Details"
        size="lg"
      >
        {selectedDelivery && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">GRV Number</label>
                <p className="font-mono font-medium text-primary">
                  {selectedDelivery.grvNumber || `GRV-${selectedDelivery._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Received Date</label>
                <p className="text-gray-900">
                  {new Date(selectedDelivery.receivedAt || selectedDelivery.createdAt).toLocaleDateString('en-ZA')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Note</label>
                <p className="text-gray-900">{selectedDelivery.deliveryNote}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Received By</label>
                <p className="text-gray-900">
                  {selectedDelivery.receivedBy?.firstName} {selectedDelivery.receivedBy?.lastName}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Items Received</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Item</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Ordered</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDelivery.items?.map((item, index) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">{item.description}</td>
                        <td className="py-3 px-4 text-sm">{item.orderedQuantity} {item.unit}</td>
                        <td className="py-3 px-4 text-sm font-medium text-green-600">
                          {item.receivedQuantity} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

