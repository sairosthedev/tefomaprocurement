import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { Truck, Loader2, CheckCircle, XCircle, Clock, Package, AlertCircle } from 'lucide-react';
import ViewButton from '../../components/ViewButton';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import Pagination from '../../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../../lib/pagination';
import { formatCurrency } from '../../lib/constants';
import { WorkflowStepper, NextStepCard } from '../../components/WorkflowStepper';
import { supplierDeliveryJourney } from '../../lib/supplierJourney';
import { SubmitInvoiceDrawer } from '../../components/InvoiceForm';

const statusColors: any = {
  pending: 'bg-yellow-100 text-yellow-700',
  received: 'bg-blue-100 text-blue-700',
  inspected: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  partially_accepted: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700'
};

export default function MyDeliveries() {
  const { showToast } = useToast();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  // The order the invoice drawer is billing; null while it is closed.
  const [invoicingPoId, setInvoicingPoId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyDeliveries();
  }, [page, limit]);

  const fetchMyDeliveries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/supplier/deliveries', { params: { page, limit } });
      if (response.data.success) {
        setDeliveries(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      } else {
        showToast(response.data.message || 'Failed to load deliveries', 'error');
      }
    } catch (error: any) {
      console.error('Failed to fetch deliveries:', error);
      showToast(error.response?.data?.message || 'Failed to load deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status: any) => {
    return status?.replace('_', ' ').charAt(0).toUpperCase() + status?.replace('_', ' ').slice(1);
  };

  return (
    <div className="p-8">
      <PageHeader
        title="My Deliveries"
        subtitle="Track your goods deliveries and GRV status"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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

        <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-700">
                {deliveries.filter((d: any) => d.status === 'pending').length}
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
              <p className="text-sm text-green-600">Accepted</p>
              <p className="text-2xl font-bold text-green-700">
                {deliveries.filter((d: any) => d.status === 'accepted').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600">Under Inspection</p>
              <p className="text-2xl font-bold text-purple-700">
                {deliveries.filter((d: any) => d.status === 'inspected' || d.status === 'received').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">Partial/Rejected</p>
              <p className="text-2xl font-bold text-amber-700">
                {deliveries.filter((d: any) => d.isPartialDelivery || d.status === 'rejected').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12 px-6">
            <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-700 font-medium text-lg mb-2">No deliveries recorded yet</p>
            <div className="max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
              <p className="text-sm text-blue-800 font-medium mb-2">How deliveries work:</p>
              <ol className="text-sm text-blue-700 text-left space-y-1 list-decimal list-inside">
                <li>After acknowledging a Purchase Order, prepare and deliver the goods to the delivery address specified in the PO</li>
                <li>Stores department will receive the goods and validate them against the PO</li>
                <li>Stores will create a GRV (Goods Received Voucher) in the system</li>
                <li>Once the GRV is created, your delivery will appear here automatically</li>
              </ol>
              <p className="text-xs text-blue-600 mt-3 italic">
                Note: When you acknowledge a Purchase Order, a pending delivery record is created. Once Stores receives the goods, the delivery status will be updated and a GRV number will be assigned.
              </p>
            </div>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">GRV #</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">PO Number</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Delivery Note</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Delivery Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Items</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Type</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery: any) => (
                  <tr key={delivery._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2 px-3 border-b border-gray-100">
                      {delivery.status === 'pending' ? (
                        <span className="text-yellow-600 italic">Awaiting GRV</span>
                      ) : (
                        <span className="font-mono font-medium text-primary">
                          {delivery.grvNumber || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className="font-mono text-gray-600">
                        {delivery.purchaseOrder?.poNumber || '-'}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className="text-gray-600">
                        {delivery.deliveryNoteNumber || (delivery.status === 'pending' ? 'Not yet provided' : '-')}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100 text-gray-500">
                      {delivery.status === 'pending' && delivery.expectedDeliveryDate ? (
                        <span>
                          Expected: {new Date(delivery.expectedDeliveryDate).toLocaleDateString('en-ZA')}
                        </span>
                      ) : (
                        new Date(delivery.deliveryDate).toLocaleDateString('en-ZA')
                      )}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className="text-gray-600">{delivery.items?.length || 0} items</span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
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
                    <td className="py-2 px-3 border-b border-gray-100">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[delivery.status] || statusColors.received}`}>
                        {formatStatus(delivery.status)}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <ViewButton
                        onClick={() => { setSelectedDelivery(delivery); setShowViewModal(true); }}
                      />
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
          pageSize={limit}
          onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
            itemLabel="deliveries"
          />
          </>
        )}
      </div>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Delivery Details"
        size="xl"
      >
        {selectedDelivery && (
          <div className="space-y-6">
            <div>
              <WorkflowStepper steps={supplierDeliveryJourney(selectedDelivery).steps} compact />
              {['accepted', 'partially_accepted'].includes(selectedDelivery.status) && selectedDelivery.purchaseOrder?._id ? (
                <NextStepCard
                  title="Submit your invoice"
                  description={`Bill what Stores accepted against ${selectedDelivery.purchaseOrder.poNumber}.`}
                  action={{
                    label: 'Submit invoice',
                    onClick: () => { setShowViewModal(false); setInvoicingPoId(selectedDelivery.purchaseOrder._id); }
                  }}
                />
              ) : selectedDelivery.status !== 'rejected' ? (
                <NextStepCard
                  waiting
                  title={selectedDelivery.status === 'pending' ? 'Stores to receive the goods' : 'Stores to inspect and accept the goods'}
                />
              ) : null}
            </div>
            {selectedDelivery.status === 'pending' && (
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mb-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800">Pending Delivery</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      This delivery is pending. Please prepare and deliver the goods to the delivery address specified in the Purchase Order. 
                      Once Stores receives the goods, this delivery will be updated with a GRV number and status.
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
                <label className="text-sm text-gray-500">PO Number</label>
                <p className="font-mono text-gray-900">{selectedDelivery.purchaseOrder?.poNumber || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Delivery Note Number</label>
                <p className="text-gray-900">
                  {selectedDelivery.deliveryNoteNumber || (selectedDelivery.status === 'pending' ? 'Not yet provided' : '-')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">
                  {selectedDelivery.status === 'pending' ? 'Expected Delivery Date' : 'Delivery Date'}
                </label>
                <p className="text-gray-900">
                  {selectedDelivery.status === 'pending' && selectedDelivery.expectedDeliveryDate ? (
                    new Date(selectedDelivery.expectedDeliveryDate).toLocaleDateString('en-ZA')
                  ) : (
                    new Date(selectedDelivery.deliveryDate).toLocaleDateString('en-ZA')
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[selectedDelivery.status]}`}>
                    {formatStatus(selectedDelivery.status)}
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
              {selectedDelivery.receivedBy && (
                <div>
                  <label className="text-sm text-gray-500">Received By</label>
                  <p className="text-gray-900">
                    {selectedDelivery.receivedBy.firstName} {selectedDelivery.receivedBy.lastName}
                  </p>
                </div>
              )}
              {selectedDelivery.receivedBy && (
                <div>
                  <label className="text-sm text-gray-500">Received Date</label>
                  <p className="text-gray-900">
                    {new Date(selectedDelivery.createdAt).toLocaleDateString('en-ZA')}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-2 block">Delivered Items</label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Ordered</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Received</th>
                      {selectedDelivery.status !== 'pending' && (
                        <>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Rejected</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Condition</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDelivery.items?.map((item: any, index: any) => (
                      <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100 font-medium">{item.description}</td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{item.quantityOrdered || '-'}</td>
                        <td className="py-2 px-3 border-b border-gray-100 font-medium text-gray-900">
                          {selectedDelivery.status === 'pending' ? (
                            <span className="text-yellow-600 italic">Pending</span>
                          ) : (
                            item.quantityReceived || 0
                          )}
                        </td>
                        {selectedDelivery.status !== 'pending' && (
                          <>
                            <td className="py-2 px-3 border-b border-gray-100 text-red-600">{item.quantityRejected || 0}</td>
                            <td className="py-2 px-3 border-b border-gray-100">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                item.condition === 'good' ? 'bg-green-100 text-green-700' :
                                item.condition === 'damaged' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {item.condition || 'good'}
                              </span>
                            </td>
                          </>
                        )}
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

      <SubmitInvoiceDrawer
        isOpen={invoicingPoId !== null}
        purchaseOrderId={invoicingPoId}
        onClose={() => setInvoicingPoId(null)}
        onSaved={() => setInvoicingPoId(null)}
      />
    </div>
  );
}

