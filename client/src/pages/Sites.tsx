import React, { useEffect, useState } from 'react';
import { adminAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Building2, Edit, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { PROVINCES } from '../lib/constants';

const emptyForm = {
  code: '',
  name: '',
  type: 'site',
  hasLocalStore: true,
  status: 'active',
  street: '',
  city: '',
  province: '',
  postalCode: ''
};

export default function Sites() {
  const { showToast } = useToast();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getSites({ includeInactive: 'true' });
      setSites(res.data.data || []);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load sites', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (site: any) => {
    setEditing(site);
    setForm({
      code: site.code || '',
      name: site.name || '',
      type: site.type || 'site',
      hasLocalStore: site.hasLocalStore !== false,
      status: site.status || 'active',
      street: site.address?.street || '',
      city: site.address?.city || '',
      province: site.address?.province || '',
      postalCode: site.address?.postalCode || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showToast('Code and name are required', 'error');
      return;
    }

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type,
      hasLocalStore: form.hasLocalStore,
      status: form.status,
      address: {
        street: form.street.trim(),
        city: form.city.trim(),
        province: form.province,
        postalCode: form.postalCode.trim()
      }
    };

    try {
      setSaving(true);
      if (editing) {
        await adminAPI.updateSite(editing._id, payload);
        showToast('Site updated', 'success');
      } else {
        await adminAPI.createSite(payload);
        showToast('Site created', 'success');
      }
      setShowModal(false);
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save site', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this site?')) return;
    try {
      await adminAPI.deleteSite(id);
      showToast('Site deleted', 'success');
      load();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to delete site', 'error');
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Sites & Locations"
        subtitle="Manage HQ and store locations used for inventory and deliveries"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark"
          >
            <Plus className="h-5 w-5" />
            Add site
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No sites configured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <div key={site._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{site.name}</h3>
                    <p className="text-xs font-mono text-gray-400">{site.code}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => openEdit(site)} className="p-2 text-gray-400 hover:text-primary rounded-lg">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(site._id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 uppercase">{site.type}</span>
                <span className={`px-2 py-1 rounded-full ${site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {site.status}
                </span>
                {site.hasLocalStore && (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Local store</span>
                )}
              </div>
              {site.address?.city && (
                <p className="text-sm text-gray-500 mt-3">
                  {[site.address.city, site.address.province].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit site' : 'Add site'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                disabled={Boolean(editing)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm disabled:bg-gray-50"
                placeholder="HQ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              >
                <option value="hq">HQ</option>
                <option value="site">Site</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <select
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Select</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.hasLocalStore}
              onChange={(e) => setForm({ ...form, hasLocalStore: e.target.checked })}
            />
            Has local store inventory
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 rounded-xl hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
