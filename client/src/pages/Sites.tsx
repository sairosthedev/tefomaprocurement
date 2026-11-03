import React, { useEffect, useState } from 'react';
import { adminAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import PageHeader from '../components/PageHeader';
import { ModalFooter } from '../components/Modal';
import Drawer from '../components/Drawer';
import TableSkeleton from '../components/TableSkeleton';
import { MapPin, Plus } from 'lucide-react';
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
        bottomSpacing="mb-4"
      />

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add site
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Code</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Name</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Type</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Location</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton cols={6} />
          ) : sites.length === 0 ? (
            <tbody><tr><td colSpan={6} className="text-center py-12 text-gray-500">
              <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>No sites configured yet.</p>
            </td></tr></tbody>
          ) : (
            <tbody>
              {sites.map((site) => (
                <tr key={site._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                  <td className="py-2 px-3 border-b border-gray-100 font-mono text-xs text-gray-500">{site.code}</td>
                  <td className="py-2 px-3 border-b border-gray-100 font-medium text-gray-900">{site.name}</td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 uppercase">{site.type}</span>
                      {site.hasLocalStore && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Local store</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${site.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {site.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100 text-gray-600">
                    {site.address?.city ? [site.address.city, site.address.province].filter(Boolean).join(', ') : '—'}
                  </td>
                  <td className="py-2 px-3 border-b border-gray-100 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(site)}
                        className="px-2 py-1 text-xs border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(site._id)}
                        className="px-2 py-1 text-xs border border-red-200 rounded text-red-700 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit site' : 'Add site'} size="lg">
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
          <ModalFooter>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </ModalFooter>
        </div>
      </Drawer>
    </div>
  );
}
