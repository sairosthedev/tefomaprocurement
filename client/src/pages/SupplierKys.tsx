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
    if (id) {
      navigate(`/app/suppliers/${id}?tab=documents`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
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
