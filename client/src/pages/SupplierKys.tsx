import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { KYS_CHECKLIST_ITEMS } from '@fosssil/shared';
import { useToast } from '../components/Toast';
import KysDocuments from '../components/KysDocuments';
import { ArrowLeft, Loader2, CheckCircle, ShieldCheck } from 'lucide-react';

export default function SupplierKys() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [supplier, setSupplier] = useState<any>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) load();
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

  const toggle = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    try {
      setSaving(true);
      await procurementAPI.updateKys(id, { checklist });
      showToast('KYS checklist saved', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    try {
      setSaving(true);
      await procurementAPI.verifyKys(id, { approveForActivation: true });
      showToast('KYS verified and supplier activated', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Verification failed', 'error');
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

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const required = KYS_CHECKLIST_ITEMS.filter((i) => i.required);
  const done = required.filter((i) => checklist[i.key]).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/app/suppliers')} className="flex items-center gap-2 text-gray-600 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to suppliers
      </button>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          KYS — {supplier?.companyName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">FC-HQ-P-07 §6.2.3 Know Your Supplier</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-500">Status:</span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              supplier?.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
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
            <div className="h-full bg-primary transition-all" style={{ width: `${(done / required.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Compliance documents */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Compliance Documents</h2>
        <KysDocuments
          documents={supplier?.complianceDocuments || []}
          onUpload={uploadDoc}
          onDelete={deleteDoc}
        />
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        {KYS_CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={!!checklist[item.key]}
              onChange={() => toggle(item.key)}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-medium text-sm">{item.label}</p>
              <p className="text-xs text-gray-400">{item.section}{!item.required && ' (optional)'}</p>
            </div>
            {checklist[item.key] && <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />}
          </label>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={save} disabled={saving} className="flex-1 py-3 bg-gray-800 text-white rounded-lg disabled:opacity-50">
          Save checklist
        </button>
        <button onClick={verify} disabled={saving || done < required.length} className="flex-1 py-3 bg-primary text-white rounded-lg disabled:opacity-50">
          Verify KYS & activate
        </button>
      </div>
    </div>
  );
}
