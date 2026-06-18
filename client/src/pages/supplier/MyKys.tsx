import { useEffect, useState } from 'react';
import { supplierAPI } from '../../lib/api';
import { KYS_DOCUMENT_REQUIREMENTS } from '@fossil/shared';
import { useToast } from '../../components/Toast';
import KysDocuments from '../../components/KysDocuments';
import PageHeader from '../../components/PageHeader';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const docs = profile?.complianceDocuments || [];
  const requiredReqs = KYS_DOCUMENT_REQUIREMENTS.filter((r) => r.required);
  const requiredUploaded = requiredReqs.filter((r) =>
    docs.some((d: any) => d.documentType === r.documentType)
  ).length;
  const isActive = profile?.status === 'active';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title={`KYS Compliance — ${profile?.companyName}`}
        subtitle="Upload your Know-Your-Supplier documents. Your account is activated once Procurement verifies the mandatory documents."
      />

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div
          className={`mt-4 flex items-start gap-2 p-3 rounded-lg text-sm ${
            isActive ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {isActive ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
          <span>
            {isActive
              ? 'Your account is active and can be invited to RFQs.'
              : `Pending verification — ${requiredUploaded}/${requiredReqs.length} mandatory documents uploaded.`}
          </span>
        </div>
      </div>

      <KysDocuments documents={docs} onUpload={uploadDoc} onDelete={deleteDoc} />
    </div>
  );
}
