import React, { useEffect, useRef, useState } from 'react';
import { storesAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import { FormSteps, FormStepNav } from '../components/FormSteps';
import { ArrowLeftRight, Loader2, Plus, CheckCircle, Truck, PackageCheck } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-purple-100 text-purple-800',
  received: 'bg-green-100 text-green-800',
  partially_received: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

const CREATE_STEPS = [
  { label: 'Sites', description: 'Where the stock moves' },
  { label: 'Items', description: 'What and how much' },
  { label: 'Review & create', description: 'Check, then create' }
];

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-ZA') : undefined);


export default function StockTransfers() {
  const { showToast } = useToast();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [fromSiteId, setFromSiteId] = useState('');
  const [toSiteId, setToSiteId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ itemId: '', quantity: 1 }]);
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const createTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTransfers();
  }, [page, limit, statusFilter]);

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (fromSiteId) {
      loadInventory(fromSiteId);
    } else {
      setInventory([]);
    }
  }, [fromSiteId]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const res = await storesAPI.getTransfers({
        page,
        limit,
        status: statusFilter || undefined
      });
      setTransfers(res.data.data || []);
      setPagination(parsePagination(res.data.pagination));
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load transfers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const res = await storesAPI.getTransferSites();
      setSites(res.data.data || []);
    } catch (error: any) {
      console.error('Failed to load sites', error);
    }
  };

  const loadInventory = async (siteId: string) => {
    try {
      const res = await storesAPI.getInventory({ site: siteId, limit: 200 });
      setInventory(res.data.data || []);
    } catch (error: any) {
      console.error('Failed to load inventory', error);
    }
  };

  const openCreate = () => {
    setCreateStep(0);
    setShowCreate(true);
  };

  const goToCreateStep = (step: number) => {
    setCreateStep(step);
    createTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // Each step checks its own fields; handleCreate repeats them before saving.
  const validateCreateStep = (step: number) => {
    if (step === 0 && (!fromSiteId || !toSiteId)) {
      showToast('Select source and destination sites', 'error');
      return false;
    }
    if (step === 1 && !lines.some((l) => l.itemId && l.quantity > 0)) {
      showToast('Add at least one item', 'error');
      return false;
    }
    return true;
  };

  const nextCreateStep = () => {
    if (validateCreateStep(createStep)) goToCreateStep(createStep + 1);
  };

  const handleCreate = async () => {
    for (const step of [0, 1]) {
      if (!validateCreateStep(step)) {
        goToCreateStep(step);
        return;
      }
    }
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0);

    try {
      setCreating(true);
      await storesAPI.createTransfer({
        fromSiteId,
        toSiteId,
        notes: notes.trim() || undefined,
        items: validLines.map((l) => ({ itemId: l.itemId, quantity: l.quantity }))
      });
      showToast('Transfer created', 'success');
      setShowCreate(false);
      setFromSiteId('');
      setToSiteId('');
      setNotes('');
      setLines([{ itemId: '', quantity: 1 }]);
      // The list is newest first: show page one, unfiltered, so the new transfer
      // is at the top with its Approve / Ship step.
      if (page === 1 && !statusFilter) loadTransfers();
      setPage(1);
      setStatusFilter('');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to create transfer', 'error');
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (id: string, action: 'approve' | 'ship' | 'receive') => {
    try {
      setActing(id);
      if (action === 'approve') await storesAPI.approveTransfer(id);
      if (action === 'ship') await storesAPI.shipTransfer(id, {});
      if (action === 'receive') await storesAPI.receiveTransfer(id, {});
      showToast(`Transfer ${action}${action.endsWith('e') ? 'd' : 'ed'}`, 'success');
      loadTransfers();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Stock Transfers"
        subtitle="Move inventory between store locations"
        bottomSpacing="mb-4"
      />

      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-4">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          New transfer
        </button>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="md:ml-auto px-3 py-[7px] border border-gray-200 rounded-lg text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="in_transit">In transit</option>
          <option value="received">Received</option>
          <option value="partially_received">Partially received</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : transfers.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No stock transfers yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {transfers.map((transfer) => (
              <div key={transfer._id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono font-semibold text-primary">{transfer.transferNumber}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[transfer.status] || 'bg-gray-100 text-gray-700'}`}>
                        {String(transfer.status).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-gray-400" />
                      {transfer.fromSite?.name || transfer.fromSite?.code} → {transfer.toSite?.name || transfer.toSite?.code}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {transfer.items?.length || 0} line(s) · {new Date(transfer.createdAt).toLocaleDateString('en-ZA')}
                    </p>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {transfer.items?.slice(0, 3).map((line: any, i: number) => (
                        <li key={i}>
                          {line.item?.name || line.item?.code} × {line.quantityRequested}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {transfer.status === 'pending' && (
                      <button
                        type="button"
                        disabled={acting === transfer._id}
                        onClick={() => runAction(transfer._id, 'approve')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        {acting === transfer._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        Approve
                      </button>
                    )}
                    {['pending', 'approved'].includes(transfer.status) && (
                      <button
                        type="button"
                        disabled={acting === transfer._id}
                        onClick={() => runAction(transfer._id, 'ship')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        {acting === transfer._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                        Ship
                      </button>
                    )}
                    {transfer.status === 'in_transit' && (
                      <button
                        type="button"
                        disabled={acting === transfer._id}
                        onClick={() => runAction(transfer._id, 'receive')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        {acting === transfer._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                        Receive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} pages={pagination.pages} total={pagination.total} onPageChange={setPage}
          pageSize={limit}
          onPageSizeChange={(s) => { setLimit(s); setPage(1); }} itemLabel="transfers" />
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create stock transfer" size="xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Enter on an earlier step moves on rather than creating early.
            if (createStep < CREATE_STEPS.length - 1) nextCreateStep();
            else handleCreate();
          }}
        >
        <div ref={createTopRef} className="scroll-mt-4" />
        <FormSteps steps={CREATE_STEPS} current={createStep} onSelect={goToCreateStep} />
        <div className="space-y-4">
          {createStep === 0 && (
            <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From site</label>
              <select
                value={fromSiteId}
                onChange={(e) => setFromSiteId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Select source</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To site</label>
              <select
                value={toSiteId}
                onChange={(e) => setToSiteId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Select destination</option>
                {sites.filter((s) => s._id !== fromSiteId).map((s) => (
                  <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

            </>
          )}

          {createStep === 1 && (
            <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={line.itemId}
                    onChange={(e) => {
                      const next = [...lines];
                      next[index].itemId = e.target.value;
                      setLines(next);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    disabled={!fromSiteId}
                  >
                    <option value="">Select item</option>
                    {inventory.map((row: any) => (
                      <option key={row.item?._id || row._id} value={row.item?._id}>
                        {row.item?.name || row.name} (on hand: {row.quantityOnHand ?? row.quantity})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...lines];
                      next[index].quantity = Number(e.target.value);
                      setLines(next);
                    }}
                    className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLines([...lines, { itemId: '', quantity: 1 }])}
              className="mt-2 text-sm text-primary hover:underline"
            >
              + Add line
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>

            </>
          )}

          {createStep === 2 && (() => {
            const siteLabel = (id: string) => { const x = sites.find((site) => site._id === id); return x ? `${x.name} (${x.code})` : '—'; };
            const itemLabel = (id: string) => {
              const row = inventory.find((r: any) => r.item?._id === id);
              return row?.item?.name || row?.name || id;
            };
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-500">From</p>
                    <p className="font-medium text-gray-900">{siteLabel(fromSiteId)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">To</p>
                    <p className="font-medium text-gray-900">{siteLabel(toSiteId)}</p>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines
                        .filter((l) => l.itemId && l.quantity > 0)
                        .map((l, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 border-b border-gray-100">{itemLabel(l.itemId)}</td>
                            <td className="py-2 px-3 border-b border-gray-100">{l.quantity}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {notes.trim() && (
                  <div>
                    <p className="text-gray-500">Notes</p>
                    <p className="text-gray-900">{notes}</p>
                  </div>
                )}
                <p className="text-xs text-gray-500">The transfer is then approved, shipped and received at the destination.</p>
              </div>
            );
          })()}
        </div>

        <FormStepNav
          current={createStep}
          total={CREATE_STEPS.length}
          onBack={() => goToCreateStep(createStep - 1)}
          onNext={nextCreateStep}
          onCancel={() => setShowCreate(false)}
          finishLabel={creating ? 'Creating…' : 'Create transfer'}
          submitting={creating}
        />
        </form>
      </Modal>
    </div>
  );
}
