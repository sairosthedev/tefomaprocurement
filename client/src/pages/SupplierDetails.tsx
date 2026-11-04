import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import Tabs from '../components/Tabs';
import KysDocuments from '../components/KysDocuments';
import { requiredDocumentTypesForTier } from '../components/supplier/kysRequirements';
import { KYS_CHECKLIST_ITEMS, getRequiredChecklistKeys, isProcurementHead } from '@fossil/shared';
import SupplierEditableSection from '../components/supplier/SupplierEditableSection';
import {
  draftPayloadForSection,
  supplierToDraft,
  type SupplierDraft
} from '../components/supplier/SupplierProfileEditor';
import {
  Ban,
  Check,
  CheckCircle,
  Clock,
  Loader2,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

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

function VettingForm({ supplier, onSaved, showToast }: { supplier: any; onSaved: (s: any) => void; showToast: (m: string, t: string) => void }) {
  const [form, setForm] = React.useState({
    vettingStatus: supplier.vettingStatus || 'not_started',
    siteVisitDate: supplier.siteVisitDate ? new Date(supplier.siteVisitDate).toISOString().split('T')[0] : '',
    siteVisitBy: supplier.siteVisitBy || '',
    siteVisitNotes: supplier.siteVisitNotes || '',
    onboardingMethod: supplier.onboardingMethod || '',
    onboardingMethodNotes: supplier.onboardingMethodNotes || ''
  });
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      // `/suppliers/:id` does not exist; the record is updated under /procurement.
      const { data } = await procurementAPI.updateSupplier(supplier._id, {
        vettingStatus: form.vettingStatus || undefined,
        siteVisitDate: form.siteVisitDate || undefined,
        siteVisitBy: form.siteVisitBy.trim() || undefined,
        siteVisitNotes: form.siteVisitNotes.trim() || undefined,
        onboardingMethod: form.onboardingMethod || undefined,
        onboardingMethodNotes: form.onboardingMethodNotes.trim() || undefined
      });
      onSaved(data.data);
      showToast('Vetting record saved', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save vetting record', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Update vetting record</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select value={form.vettingStatus} onChange={e => setForm(f => ({ ...f, vettingStatus: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Visit date</label>
          <input type="date" value={form.siteVisitDate} onChange={e => setForm(f => ({ ...f, siteVisitDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Conducted by</label>
          <input type="text" value={form.siteVisitBy} onChange={e => setForm(f => ({ ...f, siteVisitBy: e.target.value }))}
            placeholder="Officer name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Onboarding method</label>
          <select value={form.onboardingMethod} onChange={e => setForm(f => ({ ...f, onboardingMethod: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">— select —</option>
            <option value="newspaper">Newspaper invitation</option>
            <option value="direct_application">Direct application</option>
            <option value="referral">Referral</option>
            <option value="existing">Existing supplier</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Site visit notes</label>
        <textarea value={form.siteVisitNotes} onChange={e => setForm(f => ({ ...f, siteVisitNotes: e.target.value }))}
          rows={2} placeholder="Observations from the site visit…"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
      </div>
      <button onClick={save} disabled={saving}
        className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
        {saving ? 'Saving…' : 'Save vetting record'}
      </button>
    </div>
  );
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
  const location = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth();
  // The COO and admins see the full record but maintain nothing on it: editing,
  // KYS, tiering and status changes are procurement's.
  const canManage = user?.role === 'procurement_officer' || isProcurementHead(user);

  const [supplier, setSupplier] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kysSaving, setKysSaving] = useState(false);
  const [tab, setTab] = useState('overview');
  const [docStep, setDocStep] = useState(0);
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
    if (nextTab === 'documents') setDocStep(0);
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
      // A banking edit becomes a held change request; say so rather than "saved".
      showToast(res.data?.message || 'Supplier profile saved', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save supplier profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  // Count against the canonical required set for this supplier's tier, not the
  // keys that happen to be stored: a profile with 2 stored booleans both true
  // previously displayed "2/2" and enabled a button the server then rejected.
  const completion = useMemo(() => {
    const requiredKeys = getRequiredChecklistKeys(supplier?.tier);
    const ticked = requiredKeys.filter((key: string) => checklist[key]).length;
    return {
      keys: requiredKeys,
      ticked,
      isComplete: ticked === requiredKeys.length,
      missing: requiredKeys.filter((key: string) => !checklist[key])
    };
  }, [checklist, supplier?.tier]);

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

  const [tierSaving, setTierSaving] = useState(false);
  const [tierSuggestion, setTierSuggestion] = useState<any>(null);

  useEffect(() => {
    if (!supplier?._id) return;
    procurementAPI
      .getSupplierTierSuggestion(supplier._id)
      .then((res: any) => setTierSuggestion(res.data?.data))
      // Advisory only — a failure here must not block the page.
      .catch(() => setTierSuggestion(null));
  }, [supplier?._id]);

  const assignTier = async (tier: string) => {
    if (!supplier) return;
    const reason = window.prompt(`Why is ${supplier.companyName} classified as ${tier}?`);
    if (!reason?.trim()) return;
    try {
      setTierSaving(true);
      await procurementAPI.setSupplierTier(supplier._id, { tier, reason: reason.trim() });
      showToast(`Classified as ${tier}`, 'success');
      await load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not set the tier', 'error');
    } finally {
      setTierSaving(false);
    }
  };

  const verifyDoc = async (doc: any, verified: boolean, notes?: string) => {
    if (!supplier) return;
    await procurementAPI.verifySupplierDocument(supplier._id, doc._id, { verified, notes });
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
      showToast(isBlacklisted ? 'Lift the blacklisting first.' : 'This supplier is already active.', 'error');
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

  // Returns the supplier to pending; re-approval then goes through KYS.
  const runReinstate = async () => {
    if (!supplier) return;
    if (!actionReason.trim()) {
      showToast('A reason is required to lift a blacklisting', 'error');
      return;
    }
    try {
      setSaving(true);
      const res = await procurementAPI.reinstateSupplier(supplier._id, { reason: actionReason.trim() });
      showToast(res.data.message || 'Blacklisting lifted', 'success');
      refreshSupplier(res.data.data);
      setPendingAction(null);
      setActionReason('');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to lift the blacklisting', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmPendingAction = () => {
    if (pendingAction === 'suspend') return runSetStatus('suspended');
    if (pendingAction === 'reactivate') return runSetStatus('active');
    if (pendingAction === 'dormant') return runSetStatus('dormant');
    if (pendingAction === 'blacklist') return runBlacklist();
    if (pendingAction === 'reinstate') return runReinstate();
  };

  const closePendingAction = () => {
    setPendingAction(null);
    setActionReason('');
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
  // A blacklisted supplier must have the blacklisting lifted first; the API
  // refuses KYS verification for them, so the button is not offered.
  const isBlacklisted = supplier?.status === 'blacklisted';
  const canRunKysActivation = supplier?.status !== 'active' && !isBlacklisted;
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
    { value: 'vetting', label: 'Vetting' },
    { value: 'performance', label: 'Performance', count: evaluations.length }
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-8">
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
  const formatDate = (value: any) => (value ? new Date(value).toLocaleDateString('en-ZA') : '—');

  // The few facts worth seeing before opening a tab; the rest live in the tabs.
  const facts: Array<{ label: string; value: React.ReactNode; sub?: string }> = [
    { label: 'KYS', value: kysLabel, sub: `${completion.ticked}/${completion.keys.length} required checks` },
    { label: 'Diligence tier', value: <span className="capitalize">{supplier.tier || 'Unclassified'}</span> },
    // Separate from status: only a spend-authorised supplier can be awarded or sent a PO.
    {
      label: 'Spend authorisation',
      value: supplier.transactability === 'spend_authorized'
        ? 'Authorised'
        : supplier.transactability === 'prospective' ? 'Prospective' : 'Not authorised',
      sub: supplier.transactability === 'spend_authorized'
        ? 'Can be awarded and paid'
        : supplier.transactability === 'prospective' ? 'May quote, not be awarded' : 'Cannot be awarded'
    },
    {
      label: 'Performance',
      value: performanceScore,
      sub: latestEvaluation ? `Evaluated ${formatDate(latestEvaluation.createdAt)}` : 'Not evaluated yet'
    },
    ...(latestEvaluation?.nextReviewDue ? [{ label: 'Next review', value: formatDate(latestEvaluation.nextReviewDue) }] : [])
  ];

  const actionButton = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors';
  const panel = 'rounded-xl border border-gray-200 p-4';

  return (
    <div className="p-8">
      <PageHeader
        backTo="/app/suppliers"
        backLabel="Back to suppliers"
        title={supplier.companyName}
        subtitle={(supplier.tradingName || supplier.tradingAs) ? `Trading as ${supplier.tradingName || supplier.tradingAs}` : undefined}
        bottomSpacing="mb-4"
        actions={
          <>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[supplier.status]}`}>
              <StatusIcon className="h-4 w-4" />
              {supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1)}
            </span>
            {canManage && (supplier.status === 'suspended' || supplier.status === 'dormant') && (
              <button type="button" onClick={() => setPendingAction('reactivate')} className={`${actionButton} bg-primary border-primary text-white hover:bg-primary-dark`}>
                <CheckCircle className="h-4 w-4" />
                Reactivate
              </button>
            )}
            {canManage && supplier.status === 'active' && (
              <>
                <button type="button" onClick={() => setPendingAction('suspend')} className={`${actionButton} text-gray-700 border-gray-300 hover:bg-gray-50`}>
                  <Ban className="h-4 w-4" />
                  Suspend
                </button>
                <button type="button" onClick={() => setPendingAction('dormant')} className={`${actionButton} text-gray-700 border-gray-300 hover:bg-gray-50`}>
                  <Clock className="h-4 w-4" />
                  Mark dormant
                </button>
              </>
            )}
            {canManage && supplier.status !== 'blacklisted' && (
              <button type="button" onClick={() => setPendingAction('blacklist')} className={`${actionButton} text-red-700 border-red-200 hover:bg-red-50`}>
                <XCircle className="h-4 w-4" />
                Blacklist
              </button>
            )}
            {canManage && isBlacklisted && (
              <button type="button" onClick={() => setPendingAction('reinstate')} className={`${actionButton} text-gray-700 border-gray-300 hover:bg-gray-50`}>
                <CheckCircle className="h-4 w-4" />
                Lift blacklisting
              </button>
            )}
          </>
        }
      />

      {supplier.status === 'blacklisted' && supplier.blacklistReason && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Blacklist reason: </span>{supplier.blacklistReason}
        </div>
      )}
      {supplier.kysExempt && supplier.kysExemptReason && (
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">KYS override: </span>{supplier.kysExemptReason}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 px-5 py-4">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-gray-400">{fact.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-gray-900 truncate">{fact.value}</dd>
              {fact.sub && <dd className="text-xs text-gray-500 truncate">{fact.sub}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
        <Tabs tabs={tabs} activeTab={tab} onTabChange={handleTabChange} variant="pills" />

        {(EDITABLE_SUPPLIER_TABS as readonly string[]).includes(tab) && supplier && profileDraft && (
          <SupplierEditableSection
            section={tab}
            supplier={supplier}
            draft={profileDraft}
            editing={profileEditing}
            saving={profileSaving}
            onEdit={canManage ? startProfileEdit : undefined}
            onCancel={cancelProfileEdit}
            onSave={saveProfileSection}
            onDraftChange={setProfileDraft}
          />
        )}

        {tab === 'documents' && (() => {
          const DOC_STEPS = [
            { label: 'Documents', done: checklistDocuments.length > 0 },
            { label: 'Checklist', done: completion.isComplete },
            { label: 'Verify', done: supplier.status === 'active' }
          ];
          return (
            <div className="space-y-6">
              {/* Horizontal step nav */}
              <nav className="flex items-center">
                {DOC_STEPS.map((step, i) => {
                  const active = i === docStep;
                  const past = i < docStep;
                  return (
                    <React.Fragment key={step.label}>
                      <button
                        type="button"
                        onClick={() => setDocStep(i)}
                        className="flex items-center gap-2 shrink-0"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 transition-colors ${
                          step.done
                            ? 'bg-primary ring-primary'
                            : active
                              ? 'bg-white ring-primary'
                              : 'bg-white ring-gray-200'
                        }`}>
                          {step.done
                            ? <Check className="h-3.5 w-3.5 text-white" />
                            : <span className={`text-[11px] font-bold ${active ? 'text-primary' : 'text-gray-400'}`}>{i + 1}</span>
                          }
                        </div>
                        <span className={`text-sm font-medium ${active ? 'text-primary' : step.done || past ? 'text-gray-500' : 'text-gray-400'}`}>
                          {step.label}
                        </span>
                      </button>
                      {i < DOC_STEPS.length - 1 && (
                        <div className={`flex-1 h-px mx-3 ${past || step.done ? 'bg-primary/40' : 'bg-gray-200'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>

              {/* Step 1 — compliance document uploads */}
              {docStep === 0 && (
                <KysDocuments
                  documents={checklistDocuments}
                  fetchFile={async (doc) => (await procurementAPI.getSupplierDocumentFile(supplier._id, doc._id)).data}
                  requiredTypes={requiredDocumentTypesForTier(supplier.tier)}
                  readOnly={!canManage}
                  onUpload={uploadDoc}
                  onDelete={deleteDoc}
                  onVerify={verifyDoc}
                  title="Required and optional documents"
                />
              )}

              {/* Step 2 — KYS checklist */}
              {docStep === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">KYS checklist</p>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${completion.keys.length ? (completion.ticked / completion.keys.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums">{completion.ticked}/{completion.keys.length}</span>
                    </div>
                  </div>
                  {checklistSections.map(({ section, items }) => (
                    <div key={section} className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{section}</p>
                        <p className="text-xs text-gray-500">{items.filter((item) => checklist[item.key]).length}/{items.length}</p>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {items.map((item) => (
                          <label key={item.key} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                            <input type="checkbox" checked={!!checklist[item.key]} onChange={() => toggleCheck(item.key)} disabled={kysSaving || !canManage} />
                            <p className="flex-1 text-sm text-gray-900">{item.label}</p>
                            <span className="text-xs text-gray-400">{item.required ? 'Required' : 'Optional'}</span>
                            {checklist[item.key] && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3 — assign tier + verify */}
              {docStep === 2 && (
                <div className="max-w-sm space-y-6">
                  {/* Tier */}
                  <div className={`${panel} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">Diligence tier</p>
                      {supplier.tier && <span className="text-xs font-medium text-primary capitalize">{supplier.tier}</span>}
                    </div>
                    <p className="text-xs text-gray-400">Sets how many KYS items are required. Unclassified is treated as full depth.</p>
                    {canManage && (
                      <div className="flex flex-wrap gap-2">
                        {['critical', 'strategic', 'tactical', 'transactional'].map((t) => (
                          <button key={t} type="button" disabled={tierSaving || supplier.tier === t} onClick={() => assignTier(t)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-colors ${
                              supplier.tier === t ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            } disabled:opacity-50`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                    {tierSuggestion && supplier.tier !== tierSuggestion.suggested && (
                      <p className="text-xs text-amber-700">
                        Suggested: <span className="font-medium capitalize">{tierSuggestion.suggested}</span> — {tierSuggestion.rationale}
                      </p>
                    )}
                  </div>

                  {/* Activate */}
                  <div className={`${panel} space-y-3`}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-gray-900">Verify KYS &amp; activate</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full"
                          style={{ width: `${completion.keys.length ? (completion.ticked / completion.keys.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums shrink-0">{completion.ticked}/{completion.keys.length} required</span>
                    </div>
                    {isBlacklisted ? (
                      <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Supplier is blacklisted — lift the blacklisting before verifying KYS.
                      </p>
                    ) : !canRunKysActivation ? (
                      <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
                        Supplier is active — KYS verification is locked.
                      </p>
                    ) : !canManage ? (
                      <p className="text-sm text-gray-400">Managed by procurement</p>
                    ) : showOverrideConfirm ? (
                      <div className="space-y-3">
                        <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                          rows={3} placeholder="Reason for KYS override (required)"
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none" />
                        <div className="flex gap-2">
                          <button type="button" disabled={kysSaving}
                            onClick={() => { setShowOverrideConfirm(false); setOverrideReason(''); }}
                            className="flex-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                            Cancel
                          </button>
                          <button type="button" disabled={kysSaving || !overrideReason.trim()} onClick={() => verifyKys(true)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50">
                            {kysSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Confirm
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button type="button" onClick={() => verifyKys(false)}
                          disabled={kysSaving || (!supplier.kysComplete && completion.ticked !== completion.keys.length)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
                          {kysSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          Verify KYS &amp; activate
                        </button>
                        <button type="button" onClick={() => setShowOverrideConfirm(true)} disabled={kysSaving}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                          Activate without KYS
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prev / Next */}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                {docStep > 0 ? (
                  <button type="button" onClick={() => setDocStep((s) => s - 1)}
                    className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                    Back
                  </button>
                ) : <div />}
                {docStep < 2 && (
                  <button type="button" onClick={() => setDocStep((s) => s + 1)}
                    className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                    Next
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {tab === 'vetting' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${panel} space-y-3`}>
              <h3 className="text-sm font-semibold text-gray-900">Onboarding method (§ 6.2.1)</h3>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">How the supplier joined the register</p>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {supplier.onboardingMethod?.replace(/_/g, ' ') || '—'}
                </p>
              </div>
              {supplier.onboardingMethodNotes && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                  <p className="text-sm text-gray-800">{supplier.onboardingMethodNotes}</p>
                </div>
              )}
            </div>

            <div className={`${panel} space-y-3`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Site visit (§ 5.5)</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  supplier.vettingStatus === 'passed' ? 'bg-green-100 text-green-700' :
                  supplier.vettingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                  supplier.vettingStatus === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {supplier.vettingStatus?.replace(/_/g, ' ') || 'Not started'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Visit date</p>
                  <p className="font-medium text-gray-900">{formatDate(supplier.siteVisitDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Conducted by</p>
                  <p className="font-medium text-gray-900">{supplier.siteVisitBy || '—'}</p>
                </div>
              </div>
              {supplier.siteVisitNotes && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                  <p className="text-sm text-gray-800">{supplier.siteVisitNotes}</p>
                </div>
              )}
              {canManage && (
                <VettingForm supplier={supplier} onSaved={refreshSupplier} showToast={showToast} />
              )}
            </div>
          </div>
        )}

        {tab === 'performance' && (
          latestEvaluation ? (
            <div className={`${panel} space-y-3 text-sm`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">Latest evaluation · {latestEvaluation.overallScore}/5</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {String(latestEvaluation.evaluationType || 'initial').replace(/_/g, ' ')} · {formatDate(latestEvaluation.createdAt)}
                    {latestEvaluation.nextReviewDue ? ` · next review ${formatDate(latestEvaluation.nextReviewDue)}` : ''}
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
                    <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
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
            <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
              No supplier evaluations captured yet.
            </p>
          )
        )}
      </section>

      <Modal
        isOpen={!!pendingAction}
        onClose={() => { if (!saving) closePendingAction(); }}
        title={
          pendingAction === 'suspend' ? 'Suspend this supplier?'
            : pendingAction === 'reactivate' ? 'Reactivate this supplier?'
              : pendingAction === 'dormant' ? 'Mark this supplier as dormant?'
                : pendingAction === 'reinstate' ? 'Lift this blacklisting?'
                  : 'Blacklist this supplier?'
        }
        subtitle={supplier.companyName}
        footer={
          <>
            <button
              type="button"
              onClick={closePendingAction}
              disabled={saving}
              className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmPendingAction}
              disabled={saving || ((pendingAction === 'blacklist' || pendingAction === 'reinstate') && !actionReason.trim())}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                pendingAction === 'blacklist' ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </button>
          </>
        }
      >
        {pendingAction === 'suspend' || pendingAction === 'blacklist' || pendingAction === 'reinstate' ? (
          <>
            {pendingAction === 'reinstate' && (
              <p className="text-sm text-gray-600 mb-3">
                The supplier returns to pending and must be re-approved through KYS before they can be awarded work.
              </p>
            )}
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              rows={3}
              placeholder={
                pendingAction === 'blacklist' ? 'Reason for blacklisting (required)'
                  : pendingAction === 'reinstate' ? 'Reason for lifting the blacklisting (required)'
                    : 'Reason for suspension (required)'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </>
        ) : (
          <p className="text-sm text-gray-600">
            {pendingAction === 'reactivate'
              ? 'The supplier can be invited to RFQs and receive orders again.'
              : 'The supplier stays on the register but is set aside until reactivated.'}
          </p>
        )}
      </Modal>
    </div>
  );
}
