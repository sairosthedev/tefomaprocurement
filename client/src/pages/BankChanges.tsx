import { useEffect, useState } from 'react';
import { procurementAPI } from '../services/procurement.service';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import FilterSelect from '../components/FilterSelect';
import { WorkflowStepper, type WorkflowStep } from '../components/WorkflowStepper';
import { Loader2, ShieldCheck, ShieldX, Phone, AlertTriangle, Landmark } from 'lucide-react';

/**
 * Supplier banking change queue.
 *
 * A change to banking details does not take effect on save: it lands here,
 * payments to that supplier pause, someone calls a number ALREADY ON FILE to
 * confirm it, and then a SECOND person — not the requester, not the caller —
 * approves. That sequence is the control against payment-redirection fraud.
 */
const personName = (p: any) => (p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : undefined);

/** Requested, verified by callback, approved by a second person, applied. */
function bankChangeSteps(request: any): WorkflowStep[] {
  const stopped = request.status === 'rejected' || request.status === 'cancelled';
  const approved = request.status === 'approved';
  const raw: Array<{ key: string; label: string; done: boolean; detail?: string }> = [
    { key: 'requested', label: 'Requested', done: true, detail: personName(request.requestedBy) },
    {
      key: 'callback',
      label: 'Callback verified',
      done: Boolean(request.callback?.verifiedAt) || approved,
      detail: personName(request.callback?.verifiedBy)
    },
    { key: 'approval', label: 'Second approval', done: approved, detail: personName(request.approvedBy) },
    {
      key: 'applied',
      label: 'Applied, payments resume',
      done: approved,
      detail: request.appliedAt ? new Date(request.appliedAt).toLocaleDateString('en-ZA') : undefined
    }
  ];
  const current = raw.findIndex((s) => !s.done);
  return raw.map((s, i) => ({
    key: s.key,
    label: s.label,
    detail: i === current && stopped ? (request.status === 'rejected' ? 'Rejected' : 'Cancelled') : s.detail,
    state: i === current ? (stopped ? 'stopped' : 'current') : s.done ? 'done' : 'upcoming'
  }));
}

export default function BankChanges() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');

  const load = async () => {
    try {
      setLoading(true);
      const res = await procurementAPI.getBankChangeRequests({ status: statusFilter });
      setRequests(res.data?.data || []);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load banking changes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const recordCallback = async (request: any) => {
    const numberCalled = window.prompt(
      'Which number did you call? It must be one already held on the supplier record — never a number supplied in the change request.'
    );
    if (!numberCalled?.trim()) return;
    const confirmedBy = window.prompt('Who at the supplier confirmed the change?');
    if (!confirmedBy?.trim()) return;

    try {
      setBusyId(request._id);
      await procurementAPI.verifyBankChangeCallback(request._id, {
        numberCalled: numberCalled.trim(),
        confirmedBy: confirmedBy.trim()
      });
      showToast('Callback recorded. A second approver must now authorise it.', 'success');
      await load();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Could not record the callback';
      // The server refuses numbers that are not on file unless overridden.
      if (message.includes('not on file')) {
        const overrideReason = window.prompt(
          `${message}\n\nIf you are sure, give a reason for calling a number that is not on file:`
        );
        if (!overrideReason?.trim()) {
          setBusyId(null);
          return;
        }
        try {
          await procurementAPI.verifyBankChangeCallback(request._id, {
            numberCalled: numberCalled.trim(),
            confirmedBy: confirmedBy.trim(),
            overrideNumberCheck: true,
            overrideReason: overrideReason.trim()
          });
          showToast('Callback recorded with an override.', 'success');
          await load();
        } catch (err: any) {
          showToast(err.response?.data?.message || 'Could not record the callback', 'error');
        }
      } else {
        showToast(message, 'error');
      }
    } finally {
      setBusyId(null);
    }
  };

  const approve = async (request: any) => {
    try {
      setBusyId(request._id);
      await procurementAPI.approveBankChange(request._id);
      showToast('Banking change approved and applied. Payments have resumed.', 'success');
      await load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not approve the change', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (request: any) => {
    const reason = window.prompt('Why is this banking change being rejected?');
    if (!reason?.trim()) return;
    try {
      setBusyId(request._id);
      await procurementAPI.rejectBankChange(request._id, { reason: reason.trim() });
      showToast('Banking change rejected.', 'success');
      await load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not reject the change', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const statusPill = (status: string) => {
    const map: Record<string, string> = {
      pending_verification: 'bg-amber-100 text-amber-700',
      pending_approval: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-600'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Supplier banking changes"
        subtitle="Payments to a supplier are held while a banking change is open. Verify by calling a number already on file, then have a second person approve."
      />

      <div className="mb-6">
        <FilterSelect
          options={[
            { value: 'open', label: 'Open' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'all', label: 'All' }
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          No banking changes {statusFilter === 'open' ? 'awaiting action' : `with status "${statusFilter}"`}.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const busy = busyId === request._id;
            const isOpen = ['pending_verification', 'pending_approval'].includes(request.status);
            return (
              <div key={request._id} className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-gray-400 shrink-0" />
                      <p className="font-semibold text-gray-900 truncate">
                        {request.supplier?.companyName || 'Unknown supplier'}
                      </p>
                      {statusPill(request.status)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Requested by {request.requestedBy?.firstName} {request.requestedBy?.lastName} ·{' '}
                      {new Date(request.createdAt).toLocaleString('en-ZA')} · via {String(request.requestedVia).replace(/_/g, ' ')}
                    </p>
                  </div>
                  {isOpen && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="h-3.5 w-3.5" /> Payments on hold
                    </span>
                  )}
                </div>

                <WorkflowStepper compact steps={bankChangeSteps(request)} />

                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Field</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">From</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(request.changes || []).map((change: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-2 px-3 border border-gray-200 font-medium text-gray-800">{change.field}</td>
                          <td className="py-2 px-3 border border-gray-200 text-gray-500">{change.from || '—'}</td>
                          <td className="py-2 px-3 border border-gray-200 text-gray-900 font-medium">{change.to || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {request.callback?.verifiedAt && (
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 mb-4">
                    <p className="flex items-center gap-1.5 font-medium text-gray-800">
                      <Phone className="h-3.5 w-3.5" /> Callback verified
                    </p>
                    <p className="mt-1">
                      Called {request.callback.numberCalled} · confirmed by {request.callback.confirmedBy} ·{' '}
                      {request.callback.verifiedBy?.firstName} {request.callback.verifiedBy?.lastName} on{' '}
                      {new Date(request.callback.verifiedAt).toLocaleString('en-ZA')}
                    </p>
                    {request.callback.notes && <p className="mt-1 text-amber-700">{request.callback.notes}</p>}
                  </div>
                )}

                {request.status === 'rejected' && request.rejectionReason && (
                  <p className="text-sm text-red-600 mb-4">Rejected: {request.rejectionReason}</p>
                )}

                {isOpen && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {request.status === 'pending_verification' && (
                      <button
                        disabled={busy}
                        onClick={() => recordCallback(request)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                        Record callback
                      </button>
                    )}
                    {request.status === 'pending_approval' && (
                      <button
                        disabled={busy}
                        onClick={() => approve(request)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50"
                        title="Must be someone other than the requester and the caller"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Approve
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => reject(request)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50"
                    >
                      <ShieldX className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
