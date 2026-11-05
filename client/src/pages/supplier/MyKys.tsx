import { useEffect, useState } from 'react';
import { supplierAPI } from '../../lib/api';
import { useToast } from '../../components/Toast';
import KysDocuments from '../../components/KysDocuments';
import { documentTypeLabel, requiredDocumentTypesForTier } from '../../components/supplier/kysRequirements';
import PageHeader from '../../components/PageHeader';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * What the banner says, from the supplier's actual standing rather than its
 * status alone: "active" with lapsed or missing KYS is not "can be awarded".
 */
function kysBanner(
  profile: any,
  docs: any[],
  requiredTypes: string[]
): { ok: boolean; text: string; tone?: 'error' } {
  const uploaded = requiredTypes.filter((t) => docs.some((d: any) => d.documentType === t)).length;
  const progress = `${uploaded}/${requiredTypes.length} documents required for your account uploaded.`;

  const now = Date.now();
  const expiredRequired = docs.filter(
    (d: any) => d.expiryDate && new Date(d.expiryDate).getTime() <= now && requiredTypes.includes(d.documentType)
  );

  switch (profile?.status) {
    case 'blacklisted':
    case 'suspended':
    case 'dormant':
      return { ok: false, text: `Your account is ${profile.status}. Contact procurement for help.` };
    case 'rejected':
      return {
        ok: false,
        tone: 'error',
        text: `Your supplier registration was not approved.${profile.rejectionReason ? ` Reason: ${profile.rejectionReason}.` : ''} Contact procurement if you have any questions.`
      };
    case 'pending':
      // Submitted for activation: a second person at procurement is deciding.
      if (profile.activationPending) {
        return { ok: false, text: 'Your documents are with procurement for approval. We will let you know once your account is activated.' };
      }
      return { ok: false, text: `Pending verification — ${progress}` };
  }

  // Active from here on. An exemption covers documents, as it does on the server.
  if (!profile?.kysExempt && expiredRequired.length > 0) {
    const list = expiredRequired
      .map((d: any) => `${documentTypeLabel(d.documentType)} (expired ${new Date(d.expiryDate).toLocaleDateString('en-ZA')})`)
      .join(', ');
    return {
      ok: false,
      text: `Your account is active, but ${list} must be replaced before you can be awarded new work. You can still be invited to quote.`
    };
  }
  if (!profile?.kysComplete && !profile?.kysExempt) {
    return {
      ok: false,
      text: `Your account is active and can be invited to quote, but your KYS is incomplete, so you cannot be awarded work yet. ${progress}`
    };
  }
  if (profile?.transactability !== 'spend_authorized') {
    return {
      ok: false,
      text: 'Your account is active and can be invited to quote. Procurement has not yet authorised it for awards.'
    };
  }
  return { ok: true, text: 'Your account is active and verified: you can be invited to RFQs and awarded work.' };
}

export default function MyKys() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await supplierAPI.getProfile();
      setProfile(res.data.data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadDoc = async (payload: any) => {
    await supplierAPI.uploadKysDocument(payload);
    await load();
  };

  const deleteDoc = async (doc: any) => {
    await supplierAPI.deleteKysDocument(doc._id);
    await load();
  };

  // The profile carries document details only; the file is fetched on open.
  const fetchFile = async (doc: any): Promise<Blob> => {
    const res = await supplierAPI.getKysDocumentFile(doc._id);
    return res.data;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const docs = profile?.complianceDocuments || [];
  // Required depth follows the supplier's tier, not the full list.
  const requiredTypes = requiredDocumentTypesForTier(profile?.tier);
  const banner = kysBanner(profile, docs, requiredTypes);

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title={`KYS Compliance — ${profile?.companyName}`}
        subtitle="Upload your Know-Your-Supplier documents. Your account is activated once Procurement has verified and approved the mandatory documents."
        bottomSpacing="mb-4"
      />

      <div
        className={`mb-6 flex items-start gap-2 p-3 rounded-xl border text-sm ${
          banner.ok
            ? 'bg-green-50 border-green-200 text-green-700'
            : banner.tone === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}
      >
        {banner.ok ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
        <span>{banner.text}</span>
      </div>

      <KysDocuments
        documents={docs}
        onUpload={uploadDoc}
        onDelete={deleteDoc}
        fetchFile={fetchFile}
        requiredTypes={requiredTypes}
      />
    </div>
  );
}
