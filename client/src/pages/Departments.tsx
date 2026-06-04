import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api, { adminAPI } from '../lib/api';
import { Building2, Plus, Edit, Trash2, Users, Loader2 } from 'lucide-react';
import Modal from '../components/Modal';

export default function Departments() {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [departmentHeads, setDepartmentHeads] = useState<any[]>([]);
  const [loadingHeads, setLoadingHeads] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    head: ''
  });

  useEffect(() => {
    fetchDepartments();
    fetchDepartmentHeads();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/departments');
      if (response.data.success) {
        setDepartments(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      showToast('Failed to fetch departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentHeads = async () => {
    try {
      setLoadingHeads(true);
      const response = await adminAPI.getUsers({ role: 'department_head' });
      setDepartmentHeads(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch department heads:', error);
    } finally {
      setLoadingHeads(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name.trim()) {
        showToast('Please enter department name', 'error');
        return;
      }

      if (editingDepartment) {
        await api.put(`/admin/departments/${editingDepartment._id}`, formData);
        showToast('Department updated successfully', 'success');
      } else {
        await api.post('/admin/departments', formData);
        showToast('Department created successfully', 'success');
      }

      setShowModal(false);
      setEditingDepartment(null);
      setFormData({ name: '', code: '', description: '', head: '' });
      fetchDepartments();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to save department', 'error');
    }
  };

  const handleEdit = (dept) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
      head: dept.head?._id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    
    try {
      await api.delete(`/admin/departments/${id}`);
      showToast('Department deleted successfully', 'success');
      fetchDepartments();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete department', 'error');
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 mt-1">Manage organization departments</p>
        </div>
        <button
          onClick={() => { setEditingDepartment(null); setFormData({ name: '', code: '', description: '', head: '' }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Department
        </button>
      </div>

      {/* Departments Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No departments found</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-primary font-medium hover:underline"
          >
            Create your first department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div key={dept._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    {dept.code && (
                      <span className="text-xs font-mono text-gray-400">{dept.code}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(dept)}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept._id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {dept.description && (
                <p className="text-sm text-gray-500 mt-4 line-clamp-2">{dept.description}</p>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  <span>{dept.userCount || 0} member{dept.userCount !== 1 ? 's' : ''}</span>
                </div>
                {dept.head && dept.head.firstName ? (
                  <span className="text-sm text-gray-500">
                    Head: {dept.head.firstName} {dept.head.lastName || ''}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 italic">No head assigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingDepartment(null); }}
        title={editingDepartment ? 'Edit Department' : 'Add Department'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g., Finance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g., FIN"
              maxLength={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Brief description of the department..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department Head
            </label>
            {loadingHeads ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading department heads...
              </div>
            ) : (
              <select
                value={formData.head}
                onChange={(e) => setFormData({ ...formData, head: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">Select a department head (optional)</option>
                {departmentHeads.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.firstName} {user.lastName} {user.email ? `(${user.email})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => { setShowModal(false); setEditingDepartment(null); }}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark"
            >
              {editingDepartment ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

