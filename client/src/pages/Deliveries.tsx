import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api, { storesAPI } from '../lib/api';
import { 
  Plus, Search, Truck, CheckCircle, 
  Loader2, Package, Calendar, FileText, AlertCircle, Clock
} from 'lucide-react';
import ViewButton from '../components/ViewButton';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { formatCurrency } from '../lib/constants';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

const statusColors: any = {
  pending: 'bg-yellow-100 text-yellow-700',
  received: 'bg-blue-100 text-blue-700',
  inspected: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  partially_accepted: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700'
};

const formatStatus = (status: any) => {
  return status?.replace('_', ' ').charAt(0).toUpperCase() + status?.replace('_', ' ').slice(1);
};

export default function Deliveries() {
  const { showToast } = useToast();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [showReceiveModal, setShowReceiveModal] = useState<any>(false);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [receiveData, setReceiveData] = useState<any>({
    deliveryNote: '',
    items: []
  });
  const [isReceiving, setIsReceiving] = useState<any>(false);
  const [acceptNotes, setAcceptNotes] = useState('');
  const [acceptStatus, setAcceptStatus] = useState<'accepted' | 'partially_accepted' | 'rejected'>('accepted');
  const [isAccepting, setIsAccepting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchData();
  }, [page, searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [deliveriesRes, posRes] = await Promise.allSettled([
        api.get('/stores/deliveries', { params: { search: searchTerm, page, limit: DEFAULT_PAGE_SIZE } }),
        api.get('/stores/pending-deliveries')
      ]);
      
      if (deliveriesRes.status === 'fulfilled' && deliveriesRes.value.data.success) {
        setDeliveries(deliveriesRes.value.data.data || []);
        setPagination(parsePagination(deliveriesRes.value.data.pagination));
      } else if (deliveriesRes.status === 'rejected') {
        showToast(deliveriesRes.reason?.response?.data?.message || 'Failed to load deliveries', 'error');
      }
      
      if (posRes.status === 'fulfilled' && posRes.value.data.success) {
        setPendingPOs(posRes.value.data.data || []);
      } else if (posRes.status === 'rejected') {
        setPendingPOs([]);
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openReceiveModal = (po: any) => {
    setSelectedPO(po);
    setReceiveData({
      deliveryNote: po.pendingDelivery?.deliveryNoteNumber || '',
      items: po.items.map((item: any) => ({
        _id: item._id,
        description: item.description,
        quantity: item.quantity,
        quantityReceived: item.quantityReceived || 0,
        unit: item.unit,
        receivedQuantity: item.quantity - (item.quantityReceived || 0)
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

      setIsReceiving(true);
      await api.post('/stores/deliveries', {
        purchaseOrderId: selectedPO._id,
        deliveryNoteNumber: receiveData.deliveryNote,
        deliveryDate: new Date().toISOString(),
        items: receiveData.items
          .filter((item: any) => item.receivedQuantity > 0) // Only include items with quantity > 0
          .map((item: any) => ({
            poItem: item._id, // The PO item ID
            description: item.description,
            quantityOrdered: item.quantity,
            quantityReceived: item.receivedQuantity || 0,
            condition: 'good'
          })),
        notes: ''
      });

      showToast('Goods received successfully', 'success');
      setShowReceiveModal(false);
      setReceiveData({ deliveryNote: '', items: [] });
      fetchData();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to receive goods', 'error');
    } finally {
      setIsReceiving(false);
    }
  };

  const updateReceivedQty = (index: any, qty: any) => {
    const newItems = [...receiveData.items];
    newItems[index].receivedQuantity = parseInt(qty) || 0;
    setReceiveData({ ...receiveData, items: newItems });
  };

  const canAcceptDelivery = (delivery: any) =>
    ['received', 'inspected'].includes(delivery?.status);

  const openAcceptFlow = (delivery: any) => {
    setSelectedDelivery(delivery);
    setAcceptStatus('accepted');
    setAcceptNotes('');
    setShowViewModal(true);
  };

  const handleAcceptDelivery = async () => {
    if (!selectedDelivery) return;
    try {
      setIsAccepting(true);
      await storesAPI.acceptDelivery(selectedDelivery._id, {
        status: acceptStatus,
        notes: acceptNotes.trim() || undefined
      });
      showToast(
        acceptStatus === 'rejected'
          ? 'Delivery rejected'
          : 'Delivery accepted — stock updated',
        'success'
      );
      setShowViewModal(false);
      setSelectedDelivery(null);
      fetchData();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update delivery', 'error');
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Goods Receiving (GRV)"
        subtitle="Receive and record deliveries"
      />

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
            {pendingPOs.slice(0, 3).map((po: any) => (
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
            onChange={(e: any) => setSearchTerm(e.target.value)}
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
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">GRV #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">PO #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Supplier</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Delivery Note</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deliveries.map((delivery: any) => (
                  <tr key={delivery._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      {delivery.status === 'pending' ? (
                        <span className="text-sm text-yellow-600 italic">Awaiting GRV</span>
                      ) : (
                        <span className="font-mono text-sm font-medium text-primary">
                          {delivery.grvNumber || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm text-gray-600">
                        {delivery.purchaseOrder?.poNumber || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-gray-900">{delivery.supplier?.companyName || delivery.purchaseOrder?.supplier?.companyName || '-'}</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">
                        {delivery.deliveryNoteNumber || (delivery.status === 'pending' ? 'Not yet provided' : '-')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[delivery.status] || statusColors.received}`}>
                        {formatStatus(delivery.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-600">{delivery.items?.length || 0} items</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {delivery.status === 'pending' && delivery.expectedDeliveryDate ? (
                        <span>Expected: {new Date(delivery.expectedDeliveryDate).toLocaleDateString('en-ZA')}</span>
                      ) : (
                        new Date(delivery.deliveryDate || delivery.createdAt).toLocaleDateString('en-ZA')
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <ViewButton
                          onClick={() => { setSelectedDelivery(delivery); setShowViewModal(true); }}
                        />
                        {canAcceptDelivery(delivery) && (
                          <button
                            onClick={() => openAcceptFlow(delivery)}
                            className="px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            Accept
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
            itemLabel="deliveries"
          />
          </>
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
                onChange={(e: any) => setReceiveData({ ...receiveData, deliveryNote: e.target.value })}
                placeholder={selectedPO.pendingDelivery?.deliveryNoteNumber || "Enter supplier's delivery note number"}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {selectedPO.pendingDelivery?.deliveryNoteNumber && (
                <>
                  {receiveData.deliveryNote === selectedPO.pendingDelivery.deliveryNoteNumber ? (
                    <p className="text-xs text-blue-600 mt-1">
                      ℹ️ This matches the delivery note number provided by the supplier. Please verify it matches the physical delivery note document.
                    </p>
                  ) : receiveData.deliveryNote && receiveData.deliveryNote !== selectedPO.pendingDelivery.deliveryNoteNumber ? (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Supplier provided: <strong>{selectedPO.pendingDelivery.deliveryNoteNumber}</strong> - The entered number differs. Please verify.
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600 mt-1">
                      ℹ️ Supplier provided: <strong>{selectedPO.pendingDelivery.deliveryNoteNumber}</strong> - Pre-filled above. Please verify it matches the physical delivery note.
                    </p>
                  )}
                </>
              )}
              <p className="text-xs text-gray-500 mt-1">
                This is the number from the supplier's delivery note document that accompanies the goods.
                {selectedPO.pendingDelivery?.deliveryNoteNumber ? ' The supplier has already provided a delivery note number above.' : ' If the supplier provided a delivery note number when acknowledging the PO, it will be pre-filled.'}
              </p>
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
                    {receiveData.items.map((item: any, index: any) => (
                      <tr key={index}>
                        <td className="py-3 px-4 text-sm">{item.description}</td>
                        <td className="py-3 px-4 text-sm">{item.quantity} {item.unit}</td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity - (item.previouslyReceived || 0)}
                            value={item.receivedQuantity}
                            onChange={(e: any) => updateReceivedQty(index, e.target.value)}
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
                disabled={isReceiving}
                className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                disabled={isReceiving}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReceiving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm Receipt
                  </>
                )}
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
            {selectedDelivery.status === 'pending' && (
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800">Pending Delivery</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      This delivery is pending. The supplier has acknowledged the Purchase Order and is preparing to deliver the goods. 
                      Once the goods arrive, you can receive them and update this delivery with a GRV number.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">GRV Number</label>
                <p className="font-mono font-medium text-primary">
                  {selectedDelivery.status === 'pending' ? (
                    <span className="text-yellow-600 italic">Awaiting GRV</span>
                  ) : (
                    selectedDelivery.grvNumber || '-'
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[selectedDelivery.status] || statusColors.received}`}>
                    {formatStatus(selectedDelivery.status)}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">PO Number</label>
                <p className="font-mono text-gray-900">{selectedDelivery.purchaseOrder?.poNumber || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">
                  {selectedDelivery.status === 'pending' ? 'Expected Delivery Date' : 'Delivery Date'}
                </label>
                <p className="text-gray-900">
                  {selectedDelivery.status === 'pending' && selectedDelivery.expectedDeliveryDate ? (
                    new Date(selectedDelivery.expectedDeliveryDate).toLocaleDateString('en-ZA')
                  ) : (
                    new Date(selectedDelivery.deliveryDate || selectedDelivery.createdAt).toLocaleDateString('en-ZA')
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Note</label>
                <p className="text-gray-900">
                  {selectedDelivery.deliveryNoteNumber || (selectedDelivery.status === 'pending' ? 'Not yet provided' : '-')}
                </p>
              </div>
              {selectedDelivery.receivedBy && (
                <div>
                  <label className="text-sm text-gray-500">Received By</label>
                  <p className="text-gray-900">
                    {selectedDelivery.receivedBy.firstName} {selectedDelivery.receivedBy.lastName}
                  </p>
                </div>
              )}
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
                    {selectedDelivery.items?.map((item: any, index: any) => (
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

            {canAcceptDelivery(selectedDelivery) && (
              <div className="border-t border-gray-100 pt-6 space-y-4">
                <h3 className="font-semibold text-gray-900">Accept into stock</h3>
                <p className="text-sm text-gray-500">
                  Confirm inspection and move received goods into inventory.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Decision</label>
                  <select
                    value={acceptStatus}
                    onChange={(e: any) => setAcceptStatus(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="accepted">Accept all (good condition)</option>
                    <option value="partially_accepted">Partially accept</option>
                    <option value="rejected">Reject delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    value={acceptNotes}
                    onChange={(e: any) => setAcceptNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    placeholder="Inspection notes..."
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleAcceptDelivery}
                    disabled={isAccepting}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Confirm {acceptStatus === 'rejected' ? 'Rejection' : 'Acceptance'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

