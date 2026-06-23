import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import Tabs from '../components/Tabs';
import KysDocuments from '../components/KysDocuments';
import { KYS_CHECKLIST_ITEMS } from '@fossil/shared';
import SupplierEditableSection from '../components/supplier/SupplierEditableSection';
import {
  draftPayloadForSection,
  supplierToDraft,
  type SupplierDraft
} from '../components/supplier/SupplierProfileEditor';
import {
  Building2,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

const statusColors: any = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-gray-100 text-gray-700',
  blacklisted: 'bg-red-100 text-red-700',
  dormant: 'bg-gray-100 text-gray-700'
};

const statusIcons: any = {
  pending: Clock,
  active: CheckCircle,
  suspended: XCircle,
  blacklisted: XCircle,
  dormant: Clock
};

function valueOrDash(value: any) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

const EDITABLE_SUPPLIER_TABS = [
  'overview',
  'corporate',
  'banking',
  'trade',
  'directors',
  'references'
] as const;

export default function SupplierDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [supplier, setSupplier] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kysSaving, setKysSaving] = useState(false);
  const [tab, setTab] = useState('overview');
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [actionReason, setActionReason] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [profileDraft, setProfileDraft] = useState<SupplierDraft | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  const supplierId = id as string;

  const load = async () => {
    if (!supplierId) return;
    try {
      setLoading(true);
      const [detailResponse, evaluationsResponse] = await Promise.all([
        procurementAPI.getSupplier(supplierId),
        procurementAPI.getSupplierEvaluations(supplierId)
      ]);
      setSupplier(detailResponse.data.data);
      setEvaluations(evaluationsResponse.data.data || []);
      setChecklist(detailResponse.data.data?.kysChecklist || {});
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load supplier details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  useEffect(() => {
    const tabFromQuery = new URLSearchParams(location.search).get('tab');
    if (tabFromQuery) {
      setTab(tabFromQuery);
    }
  }, [location.search]);

  useEffect(() => {
    setProfileEditing(false);
    if (supplier && EDITABLE_SUPPLIER_TABS.includes(tab as typeof EDITABLE_SUPPLIER_TABS[number])) {
      setProfileDraft(supplierToDraft(supplier));
    }
  }, [supplier, tab]);

  const handleTabChange = (nextTab: string) => {
    setProfileEditing(false);
    setTab(nextTab);
  };

  const startProfileEdit = () => {
    if (supplier) {
      setProfileDraft(supplierToDraft(supplier));
    }
    setProfileEditing(true);
  };

  const cancelProfileEdit = () => {
    if (supplier) {
      setProfileDraft(supplierToDraft(supplier));
    }
    setProfileEditing(false);
  };

  const refreshSupplier = (updated: any) => {
    setSupplier(updated);
    setChecklist(updated?.kysChecklist || {});
    if (EDITABLE_SUPPLIER_TABS.includes(tab as typeof EDITABLE_SUPPLIER_TABS[number])) {
      setProfileDraft(supplierToDraft(updated));
    }
  };

  const saveProfileSection = async () => {
    if (!supplier || !profileDraft || !EDITABLE_SUPPLIER_TABS.includes(tab as typeof EDITABLE_SUPPLIER_TABS[number])) return;
    try {
      setProfileSaving(true);
      const payload = draftPayloadForSection(tab, profileDraft);
      const res = await procurementAPI.updateSupplier(supplier._id, payload);
      const updated = res.data?.data;
      if (updated) {
        refreshSupplier(updated);
      }
      setProfileEditing(false);
      showToast('Supplier profile saved', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save supplier profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const completion = useMemo(() => {
    const keys = Object.keys(checklist).filter((key) => typeof checklist[key] === 'boolean');
    const ticked = keys.filter((key) => checklist[key]).length;
    return { keys, ticked };
  }, [checklist]);

  const checklistSections = useMemo(() => {
    type KysItem = (typeof KYS_CHECKLIST_ITEMS)[number];
    const grouped = KYS_CHECKLIST_ITEMS.reduce<Record<string, KysItem[]>>((acc, item) => {
      acc[item.section] = acc[item.section] || [];
      acc[item.section].push(item);
      return acc;
    }, {});

    return Object.entries(grouped).map(([section, items]) => ({ section, items }));
  }, []);

  const toggleCheck = async (key: string) => {
    if (!supplier) return;
    const value = !checklist[key];
    const prev = checklist;
    const next = { ...checklist, [key]: value };
    setChecklist(next);
    try {
      setKysSaving(true);
      const res = await procurementAPI.updateKys(supplier._id, { checklist: { [key]: value } });
      const updated = res.data?.data?.supplier;
      if (updated) {
        setSupplier(updated);
        setChecklist(updated.kysChecklist || next);
      }
    } catch (error: any) {
      setChecklist(prev);
      showToast(error.response?.data?.message || 'Could not save change', 'error');
    } finally {
      setKysSaving(false);
    }
  };

  const uploadDoc = async (payload: any) => {
    if (!supplier) return;
    await procurementAPI.uploadSupplierDocument(supplier._id, payload);
    await load();
  };

  const deleteDoc = async (doc: any) => {
    if (!supplier) return;
    await procurementAPI.deleteSupplierDocument(supplier._id, doc._id);
    await load();
  };

  const verifyKys = async (overrideKys = false) => {
    if (!supplier) return;
    if (!canRunKysActivation) {
      showToast('This supplier is already active.', 'error');
      return;
    }
    if (overrideKys && !overrideReason.trim()) {
      showToast('A reason is required to activate without KYS', 'error');
      return;
    }
    try {
      setKysSaving(true);
      await procurementAPI.verifyKys(supplier._id, {
        approveForActivation: true,
        overrideKys,
        reason: overrideKys ? overrideReason.trim() : undefined
      });
      showToast(
        overrideKys ? 'Supplier activated without KYS (override applied)' : 'KYS verified and supplier activated',
        'success'
      );
      await load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setKysSaving(false);
    }
  };

  const runApprove = async (overrideKys = false) => {
    if (!supplier) return;
    if (!canRunKysActivation) {
      showToast('This supplier is already active.', 'error');
      return;
    }
    if (overrideKys && !actionReason.trim()) {
      showToast('A reason is required to activate without KYS', 'error');
      return;
    }
    try {
      setSaving(true);
      const res = await procurementAPI.approveSupplier(supplier._id, {
        overrideKys,
        reason: overrideKys ? actionReason.trim() : undefined
      });
      showToast(
        overrideKys ? 'Supplier activated without KYS (override applied)' : 'Supplier approved',
        'success'
      );
      refreshSupplier(res.data.data);
      setPendingAction(null);
      setActionReason('');
    } catch (error: any) {
      if (error.response?.data?.data?.requiresKys) {
        showToast('KYS documents are incomplete. Complete KYS or use the override option.', 'error');
        return;
      }
      showToast(error.response?.data?.message || 'Failed to approve supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runSetStatus = async (status: string) => {
    if (!supplier) return;
    try {
      setSaving(true);
      const res = await procurementAPI.setSupplierStatus(supplier._id, {
        status,
        reason: actionReason || undefined
      });
      showToast(res.data.message || 'Supplier status updated', 'success');
      refreshSupplier(res.data.data);
      setPendingAction(null);
      setActionReason('');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runBlacklist = async () => {
    if (!supplier) return;
    if (!actionReason.trim()) {
      showToast('A reason is required to blacklist a supplier', 'error');
      return;
    }
    try {
      setSaving(true);
      const res = await procurementAPI.blacklistSupplier(supplier._id, {
        reason: actionReason
      });
      showToast('Supplier blacklisted', 'success');
      refreshSupplier(res.data.data);
      setPendingAction(null);
      setActionReason('');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to blacklist supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmPendingAction = () => {
    if (pendingAction === 'suspend') return runSetStatus('suspended');
    if (pendingAction === 'reactivate') return runSetStatus('active');
    if (pendingAction === 'dormant') return runSetStatus('dormant');
    if (pendingAction === 'blacklist') return runBlacklist();
    if (pendingAction === 'approve') return runApprove(false);
    if (pendingAction === 'approveOverride') return runApprove(true);
  };

  const checklistDocuments = Array.isArray(supplier?.complianceDocuments) ? supplier.complianceDocuments : [];
  const latestEvaluation = evaluations?.[0];
  const performanceScore = latestEvaluation?.overallScore != null && latestEvaluation.overallScore > 0
    ? `${latestEvaluation.overallScore}/5`
    : '—';
  const kysLabel = supplier?.kysExempt
    ? 'Exempt'
    : supplier?.kysComplete
      ? 'Verified'
      : 'Pending';
  const canRunKysActivation = supplier?.status !== 'active';
  const directorCount = Array.isArray(supplier?.contactPersons) ? supplier.contactPersons.length : 0;
  const referenceCount = Array.isArray(supplier?.clientReferrals) ? supplier.clientReferrals.length : 0;
  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'banking', label: 'Banking' },
    { value: 'trade', label: 'Trade' },
    { value: 'directors', label: 'Directors', count: directorCount },
    { value: 'references', label: 'References', count: referenceCount },
    { value: 'documents', label: 'Documents', count: checklistDocuments.length },
    { value: 'performance', label: 'Performance', count: evaluations.length },
    { value: 'reports', label: 'Reports' }
  ];

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader
          backTo="/app/suppliers"
          backLabel="Back to suppliers"
          title="Supplier not found"
          subtitle="The supplier record could not be loaded."
        />
      </div>
    );
  }

  const StatusIcon = statusIcons[supplier.status] || Clock;

  const renderValue = (label: string, value: any) => (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-gray-900">{valueOrDash(value)}</p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        backTo="/app/suppliers"
        backLabel="Back to suppliers"
        title={supplier.companyName}
        subtitle={supplier.tradingAs ? `Trading as ${supplier.tradingAs}` : 'Supplier profile'}
        actions={
          <button
            type="button"
            onClick={() => setTab('documents')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
          >
            <FileText className="h-4 w-4" />
            Open Documents
          </button>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColors[supplier.status]}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
          <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500">Performance score</p>
            <p className="text-2xl font-bold text-gray-900">{performanceScore}</p>
            <p className="text-xs text-gray-400 mt-0.5">From latest evaluation</p>
          </div>
          <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500">KYS status</p>
            <p className="text-2xl font-bold text-gray-900">{kysLabel}</p>
          </div>
          <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500">Documents</p>
            <p className="text-2xl font-bold text-gray-900">{checklistDocuments.length}</p>
          </div>
          <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs text-gray-500">Evaluations</p>
            <p className="text-2xl font-bold text-gray-900">{evaluations.length}</p>
          </div>
        </div>

        <Tabs tabs={tabs} activeTab={tab} onTabChange={handleTabChange} variant="pills" />

        {(EDITABLE_SUPPLIER_TABS as readonly string[]).includes(tab) && supplier && profileDraft && (
          <SupplierEditableSection
            section={tab}
            supplier={supplier}
            draft={profileDraft}
            editing={profileEditing}
            saving={profileSaving}
            onEdit={startProfileEdit}
            onCancel={cancelProfileEdit}
            onSave={saveProfileSection}
            onDraftChange={setProfileDraft}
          />
        )}

        {tab === 'documents' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Documents &amp; KYS — {supplier.companyName}</h2>
              <p className="text-gray-500 mt-1">
                Upload supplier documents, complete the verification checklist, and activate the supplier from one place.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Checklist</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{completion.ticked}/{completion.keys.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Documents</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{checklistDocuments.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Status</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{supplier.kysComplete ? 'Verified' : 'Pending'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Compliance Documents</h3>
                      <p className="text-sm text-gray-500">Upload, preview, replace, and remove supplier documents.</p>
                    </div>
                  </div>
                  <KysDocuments
                    documents={checklistDocuments}
                    onUpload={uploadDoc}
                    onDelete={deleteDoc}
                    title="Required and optional documents"
                  />
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">KYS Checklist</h3>
                      <p className="text-sm text-gray-500">Complete the verification checklist without leaving the documents page.</p>
                    </div>
                    {supplier.kysExempt && supplier.kysExemptReason && (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                        Exempt
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    {checklistSections.map(({ section, items }) => (
                      <div key={section} className="rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{section}</p>
                            <p className="text-xs text-gray-500">{items.filter((item) => checklist[item.key]).length}/{items.length} complete</p>
                          </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {items.map((item) => (
                            <label key={item.key} className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={!!checklist[item.key]}
                                onChange={() => toggleCheck(item.key)}
                                disabled={kysSaving}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-sm text-gray-900">{item.label}</p>
                                <p className="text-xs text-gray-500">{item.required ? 'Required' : 'Optional'}</p>
                              </div>
                              {checklist[item.key] && <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Verification Controls</p>
                      <p className="text-xs text-gray-500">
                        {canRunKysActivation ? 'Activate the supplier once the checklist is complete.' : 'Supplier is already active.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3 flex items-center justify-between">
                      <span className="text-gray-500">Required complete</span>
                      <span className="font-semibold text-gray-900">{completion.ticked}/{completion.keys.length}</span>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 flex items-center justify-between">
                      <span className="text-gray-500">Documents uploaded</span>
                      <span className="font-semibold text-gray-900">{checklistDocuments.length}</span>
                    </div>
                  </div>

                  {!canRunKysActivation ? (
                    <div className="mt-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                      KYS verification is locked because this supplier is already active.
                    </div>
                  ) : showOverrideConfirm ? (
                    <div className="mt-4 space-y-3">
                      <textarea
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        rows={3}
                        placeholder="Reason for KYS override (required)"
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setShowOverrideConfirm(false);
                            setOverrideReason('');
                          }}
                          disabled={kysSaving}
                          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => verifyKys(true)}
                          disabled={kysSaving || !overrideReason.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                          {kysSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Confirm Override
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <button
                        type="button"
                        onClick={() => verifyKys(false)}
                        disabled={kysSaving || !canRunKysActivation || (!supplier.kysComplete && completion.ticked !== completion.keys.length)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        {kysSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        Verify KYS & Activate
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowOverrideConfirm(true)}
                        disabled={kysSaving || !canRunKysActivation}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                      >
                        Activate without KYS
                      </button>
                    </div>
                  )}
                </div>

                {supplier.kysExempt && supplier.kysExemptReason && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800">
                    <span className="font-medium">KYS override: </span>{supplier.kysExemptReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'performance' && (
          <div className="space-y-4 text-sm">
            {latestEvaluation ? (
              <div className="rounded-xl border border-gray-100 p-4 bg-gray-50 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">Latest evaluation</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {String(latestEvaluation.evaluationType || 'initial').replace(/_/g, ' ')} ·{' '}
                      {new Date(latestEvaluation.createdAt).toLocaleDateString('en-ZA')}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-2">
                      Overall: {latestEvaluation.overallScore}/5
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                      latestEvaluation.recommendation === 'approve'
                        ? 'bg-emerald-100 text-emerald-700'
                        : latestEvaluation.recommendation === 'reject'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {String(latestEvaluation.recommendation || '').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {Object.entries(latestEvaluation.scores || {})
                    .filter(([key]) => key !== 'otherNotes')
                    .map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-gray-200 bg-white p-3">
                        <p className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-lg font-semibold text-gray-900">{String(value)}</p>
                      </div>
                    ))}
                </div>
                {latestEvaluation.scores?.otherNotes && (
                  <div className="text-xs text-gray-600">Notes: {latestEvaluation.scores.otherNotes}</div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 p-4 text-gray-500">
                No supplier evaluations captured yet.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {renderValue('Total Evaluations', evaluations.length)}
              {renderValue('Last Evaluation', latestEvaluation ? new Date(latestEvaluation.createdAt).toLocaleDateString('en-ZA') : 'Not captured')}
              {renderValue('Next Review', latestEvaluation?.nextReviewDue ? new Date(latestEvaluation.nextReviewDue).toLocaleDateString('en-ZA') : 'Not captured')}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-6">
            <PageHeader
              title={`Reports — ${supplier.companyName}`}
              subtitle="Supplier report panels, analytics, downloads, and compliance summaries."
              actions={
                <button
                  type="button"
                  onClick={() => navigate('/app/reports?tab=suppliers')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4" />
                  Open Reports Page
                </button>
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Verification</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{supplier.kysComplete ? 'Complete' : 'Incomplete'}</p>
                <p className="mt-1 text-sm text-gray-500">
                  Status: <span className="capitalize">{supplier.status?.replace('_', ' ')}</span>
                  {supplier.kysExempt ? ' · KYS exempt' : ''}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Compliance documents</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{checklistDocuments.length}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {checklistDocuments.filter((d: any) => d.status === 'verified').length} verified ·{' '}
                  {checklistDocuments.filter((d: any) => !d.fileUrl && !d.url).length} missing uploads
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Performance reviews</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{evaluations.length}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {latestEvaluation?.overallScore != null
                    ? `Latest score: ${latestEvaluation.overallScore}/5`
                    : 'No scored evaluations yet'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Compliance summary</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>KYS complete: {supplier.kysComplete ? 'Yes' : 'No'}</li>
                  <li>Documents on file: {checklistDocuments.length}</li>
                  <li>Account status: <span className="capitalize">{supplier.status}</span></li>
                  {supplier.blacklistReason && (
                    <li className="text-red-600">Blacklisted: {supplier.blacklistReason}</li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Performance summary</h3>
                {evaluations.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No evaluations recorded for this supplier.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-gray-600">
                    <li>Total evaluations: {evaluations.length}</li>
                    {latestEvaluation && (
                      <>
                        <li>Latest period: {latestEvaluation.evaluationPeriod || '—'}</li>
                        <li>Overall score: {latestEvaluation.overallScore ?? '—'}/5</li>
                        <li>Recommendation: {latestEvaluation.recommendation || '—'}</li>
                      </>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {supplier.kysExempt && supplier.kysExemptReason && (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
            <span className="font-medium">KYS override: </span>{supplier.kysExemptReason}
          </div>
        )}

        {supplier.status === 'blacklisted' && supplier.blacklistReason && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            <span className="font-medium">Blacklist reason: </span>{supplier.blacklistReason}
          </div>
        )}

        {!pendingAction ? (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            {supplier.status === 'pending' && canRunKysActivation && (
              <>
                <button
                  type="button"
                  onClick={() => setPendingAction('approve')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve & Activate
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAction('approveOverride')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Activate without KYS
                </button>
              </>
            )}
            {supplier.status === 'active' && (
              <button
                type="button"
                onClick={() => setPendingAction('suspend')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50"
              >
                <XCircle className="h-4 w-4" />
                Suspend
              </button>
            )}
            {(supplier.status === 'suspended' || supplier.status === 'dormant') && (
              <button
                type="button"
                onClick={() => setPendingAction('reactivate')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50"
              >
                <CheckCircle className="h-4 w-4" />
                Reactivate
              </button>
            )}
            {supplier.status === 'active' && (
              <button
                type="button"
                onClick={() => setPendingAction('dormant')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Clock className="h-4 w-4" />
                Mark Dormant
              </button>
            )}
            {supplier.status !== 'blacklisted' && (
              <button
                type="button"
                onClick={() => setPendingAction('blacklist')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                Blacklist
              </button>
            )}
            {supplier.status === 'active' && (
              <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                KYS actions are unavailable for active suppliers
              </span>
            )}
          </div>
        ) : (
          <div className="p-4 border border-gray-200 rounded-xl space-y-3">
            <p className="text-sm font-medium text-gray-900">
              {pendingAction === 'suspend' && 'Suspend this supplier?'}
              {pendingAction === 'reactivate' && 'Reactivate this supplier?'}
              {pendingAction === 'dormant' && 'Mark this supplier as dormant?'}
              {pendingAction === 'blacklist' && 'Blacklist this supplier?'}
              {pendingAction === 'approve' && 'Approve and activate this supplier?'}
              {pendingAction === 'approveOverride' && 'Activate this supplier without KYS?'}
            </p>
            {(pendingAction === 'suspend' || pendingAction === 'blacklist' || pendingAction === 'approveOverride') && (
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={3}
                placeholder={
                  pendingAction === 'blacklist'
                    ? 'Reason for blacklisting (required)'
                    : pendingAction === 'approveOverride'
                      ? 'Reason for KYS override (required)'
                      : 'Reason for suspension (required)'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPendingAction(null); setActionReason(''); }}
                disabled={saving}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingAction}
                disabled={saving || (pendingAction === 'approveOverride' && !actionReason.trim())}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                  pendingAction === 'blacklist'
                    ? 'bg-red-600 hover:bg-red-700'
                    : pendingAction === 'approveOverride'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
