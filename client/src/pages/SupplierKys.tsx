import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { KYS_CHECKLIST_ITEMS, KYS_DOCUMENT_REQUIREMENTS } from '@fossil/shared';
import { useToast } from '../components/Toast';
import KysDocuments from '../components/KysDocuments';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle,
  ShieldCheck,
  Check,
  Save
} from 'lucide-react';

type Step = {
  id: string;
  title: string;
  subtitle: string;
  /** Document types uploaded in this step (auto-saved on upload). */
  docTypes?: string[];
  /** Manual (non-document) checklist keys captured in this step. */
  checks?: string[];
};

// Wizard layout. Documents auto-save on upload; manual checks auto-save on toggle.
const STEPS: Step[] = [
  {
    id: 'registration',
    title: 'Registration & Statutory',
    subtitle: 'Company registration, address and statutory compliance',
    docTypes: ['company_registration_cr14', 'registered_address_cr6', 'tax_clearance', 'nssa_compliance', 'nec_registration']
  },
  {
    id: 'capability',
    title: 'Capability & Licences',
    subtitle: 'Licences, certifications, company profile and referrals',
    docTypes: ['industry_licence', 'iso_certification', 'company_profile', 'client_referral']
  },
  {
    id: 'financial',
    title: 'Financial Standing',
    subtitle: 'Audited financials, bank references and credit terms',
    docTypes: ['audited_financials', 'bank_reference'],
    checks: ['paymentTerms', 'liquidityRatios']
  },
  {
    id: 'operations',
    title: 'Commercial & Operations',
    subtitle: 'Warranties, support, safety and operational compliance',
    docTypes: ['safety_records', 'environmental_policy', 'insurance', 'disaster_preparedness'],
    checks: ['warranties', 'afterSalesSupport', 'sampleTesting']
  },
  {
    id: 'review',
    title: 'Review & Verify',
    subtitle: 'Confirm completeness and activate the supplier'
  }
];

const CHECK_LABEL: Record<string, string> = Object.fromEntries(
  KYS_CHECKLIST_ITEMS.map((i) => [i.key, i.label])
);
const CHECK_REQUIRED: Record<string, boolean> = Object.fromEntries(
  KYS_CHECKLIST_ITEMS.map((i) => [i.key, i.required])
);
const DOC_TO_CHECK: Record<string, string> = Object.fromEntries(
  KYS_DOCUMENT_REQUIREMENTS.map((r) => [r.documentType, r.checklistKey])
);
const DOC_REQUIRED: Record<string, boolean> = Object.fromEntries(
  KYS_DOCUMENT_REQUIREMENTS.map((r) => [r.documentType, r.required])
);

/** Required checklist keys a given step is responsible for. */
function requiredKeysForStep(step: Step): string[] {
  const keys: string[] = [];
  (step.docTypes || []).forEach((dt) => {
    if (DOC_REQUIRED[dt]) keys.push(DOC_TO_CHECK[dt]);
  });
  (step.checks || []).forEach((k) => {
    if (CHECK_REQUIRED[k]) keys.push(k);
  });
  return keys;
}

export default function SupplierKys() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [supplier, setSupplier] = useState<any>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await procurementAPI.getSupplier(id);
      setSupplier(res.data.data);
      setChecklist(res.data.data.kysChecklist || {});
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load supplier', 'error');
    } finally {
      setLoading(false);
    }
  };

  const required = useMemo(() => KYS_CHECKLIST_ITEMS.filter((i) => i.required), []);
  const done = required.filter((i) => checklist[i.key]).length;
  const isComplete = done === required.length;
  const isVerified = !!supplier?.kysChecklist?.verifiedAt;

  const stepComplete = (s: Step) => requiredKeysForStep(s).every((k) => checklist[k]);

  // Auto-save a manual checklist toggle (no "Save" button needed).
  const toggleCheck = async (key: string) => {
    const value = !checklist[key];
    const prev = checklist;
    const next = { ...checklist, [key]: value };
    setChecklist(next);
    try {
      setSaving(true);
      const res = await procurementAPI.updateKys(id, { checklist: { [key]: value } });
      const updated = res.data?.data?.supplier;
      if (updated) {
        setSupplier(updated);
        setChecklist(updated.kysChecklist || next);
      }
    } catch (error: any) {
      setChecklist(prev);
      showToast(error.response?.data?.message || 'Could not save change', 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = async (payload: any) => {
    await procurementAPI.uploadSupplierDocument(id, payload);
    await load();
  };

  const deleteDoc = async (doc: any) => {
    await procurementAPI.deleteSupplierDocument(id, doc._id);
    await load();
  };

  const verify = async () => {
    try {
      setSaving(true);
      await procurementAPI.verifyKys(id, { approveForActivation: true });
      showToast('KYS verified and supplier activated', 'success');
      navigate('/app/suppliers');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const verifyOverride = async () => {
    if (!overrideReason.trim()) {
      showToast('A reason is required to activate without KYS', 'error');
      return;
    }
    try {
      setSaving(true);
      await procurementAPI.verifyKys(id, {
        approveForActivation: true,
        overrideKys: true,
        reason: overrideReason.trim()
      });
      showToast('Supplier activated without KYS (override applied)', 'success');
      navigate('/app/suppliers');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Override activation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/app/suppliers')} className="flex items-center gap-2 text-gray-600 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to suppliers
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              KYS — {supplier?.companyName}
            </h1>
            <p className="text-gray-500 text-sm mt-1">Know Your Supplier (KYS)</p>
          </div>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
              supplier?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {supplier?.status === 'active' ? 'Active' : 'Pending KYS verification'}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Required items complete</span>
            <span className="font-medium">{done}/{required.length}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(done / required.length) * 100}%` }}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
          <Save className="h-3 w-3" /> Documents and selections are saved automatically.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-6 overflow-x-auto">
        {STEPS.map((s, idx) => {
          const complete = idx < STEPS.length - 1 ? stepComplete(s) : isComplete;
          const active = idx === step;
          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => setStep(idx)}
                className="flex items-center gap-2 shrink-0 focus:outline-none"
                title={s.title}
              >
                <span
                  className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold border-2 transition-colors ${
                    active
                      ? 'border-primary bg-primary text-white'
                      : complete
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {complete && !active ? <Check className="h-4 w-4" /> : idx + 1}
                </span>
                <span className={`text-xs font-medium hidden sm:block ${active ? 'text-primary' : 'text-gray-500'}`}>
                  {s.title}
                </span>
              </button>
              {idx < STEPS.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-2 min-w-[16px]" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div className="mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{current.title}</h2>
          <p className="text-sm text-gray-500">{current.subtitle}</p>
        </div>

        {current.id === 'review' ? (
          <ReviewStep
            checklist={checklist}
            required={required}
            isComplete={isComplete}
            isVerified={isVerified}
            status={supplier?.status}
            kysExempt={supplier?.kysExempt}
            kysExemptReason={supplier?.kysExemptReason}
          />
        ) : (
          <div className="space-y-6">
            {current.docTypes && current.docTypes.length > 0 && (
              <KysDocuments
                documents={supplier?.complianceDocuments || []}
                onUpload={uploadDoc}
                onDelete={deleteDoc}
                includeTypes={current.docTypes}
                title="Documents"
              />
            )}

            {current.checks && current.checks.length > 0 && (
              <div className="bg-white rounded-xl shadow divide-y">
                <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
                  <h3 className="text-sm font-semibold text-gray-700">Attestations</h3>
                </div>
                {current.checks.map((key) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={!!checklist[key]}
                      onChange={() => toggleCheck(key)}
                      disabled={saving}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{CHECK_LABEL[key] || key}</p>
                      <p className="text-xs text-gray-400">{CHECK_REQUIRED[key] ? 'Required' : 'Optional'}</p>
                    </div>
                    {checklist[key] && <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {!isLast ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : supplier?.status === 'active' ? (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700">
            <CheckCircle className="h-4 w-4" /> Supplier active
          </span>
        ) : showOverrideConfirm ? (
          <div className="flex flex-col items-end gap-2 w-full max-w-md ml-auto">
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={3}
              placeholder="Reason for KYS override (required)"
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowOverrideConfirm(false);
                  setOverrideReason('');
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={verifyOverride}
                disabled={saving || !overrideReason.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Confirm Override
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOverrideConfirm(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50"
            >
              Activate without KYS
            </button>
            <button
              type="button"
              onClick={verify}
              disabled={saving || !isComplete}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              title={!isComplete ? 'Complete all required items first' : 'Verify KYS and activate supplier'}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verify KYS & Activate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  checklist,
  required,
  isComplete,
  isVerified,
  status,
  kysExempt,
  kysExemptReason
}: {
  checklist: Record<string, boolean>;
  required: readonly { key: string; label: string }[];
  isComplete: boolean;
  isVerified: boolean;
  status?: string;
  kysExempt?: boolean;
  kysExemptReason?: string;
}) {
  const missing = required.filter((i) => !checklist[i.key]);

  return (
    <div className="space-y-4">
      <div
        className={`p-4 rounded-xl border ${
          isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}
      >
        <p className={`text-sm font-medium ${isComplete ? 'text-green-700' : 'text-amber-700'}`}>
          {isComplete
            ? 'All required KYS items are complete. You can verify and activate this supplier.'
            : `${missing.length} required item${missing.length === 1 ? '' : 's'} still outstanding. Use Activate without KYS if this supplier is exempt from the full checklist.`}
        </p>
      </div>

      {kysExempt && kysExemptReason && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <span className="font-medium">KYS override applied: </span>{kysExemptReason}
        </div>
      )}

      {missing.length > 0 && (
        <div className="bg-white rounded-xl shadow">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <h3 className="text-sm font-semibold text-gray-700">Outstanding required items</h3>
          </div>
          <ul className="divide-y">
            {missing.map((i) => (
              <li key={i.key} className="px-4 py-3 text-sm text-gray-600">
                {i.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'active' && isVerified && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> KYS verified — supplier is active.
        </div>
      )}
    </div>
  );
}
