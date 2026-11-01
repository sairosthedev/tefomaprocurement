import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api, { adminAPI } from '../lib/api';
import { Building2, Plus, Loader2 } from 'lucide-react';
import Modal, { ModalFooter } from '../components/Modal';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

export default function Departments() {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [showModal, setShowModal] = useState<any>(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [departmentHeads, setDepartmentHeads] = useState<any[]>([]);
  const [loadingHeads, setLoadingHeads] = useState<any>(false);
  const [formData, setFormData] = useState<any>({
    name: '',
    code: '',
    description: '',
    head: ''
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    fetchDepartments();
    fetchDepartmentHeads();
  }, [page]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/departments', { params: { page, limit: DEFAULT_PAGE_SIZE } });
      if (response.data.success) {
        setDepartments(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      }
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save department', 'error');
    }
  };

  const handleEdit = (dept: any) => {
    setEditingDepartment(dept);
    setFormData({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
      head: dept.head?._id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: any) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    
    try {
      await api.delete(`/admin/departments/${id}`);
      showToast('Department deleted successfully', 'success');
      fetchDepartments();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to delete department', 'error');
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Departments"
        subtitle="Manage organization departments"
        actions={
          <button
            onClick={() => { setEditingDepartment(null); setFormData({ name: '', code: '', description: '', head: '' }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Department
          </button>
        }
      />

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
        <>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Code</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Name</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Description</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Head</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Members</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept: any) => (
                <tr key={dept._id} className="hover:bg-gray-50">
                  <td className="py-2 px-3 border border-gray-200 font-mono text-xs text-gray-500">{dept.code || '—'}</td>
                  <td className="py-2 px-3 border border-gray-200 font-medium">{dept.name}</td>
                  <td className="py-2 px-3 border border-gray-200 text-gray-500">{dept.description || '—'}</td>
                  <td className="py-2 px-3 border border-gray-200">
                    {dept.head?.firstName ? `${dept.head.firstName} ${dept.head.lastName || ''}` : <span className="text-gray-400 italic">None</span>}
                  </td>
                  <td className="py-2 px-3 border border-gray-200">{dept.userCount || 0}</td>
                  <td className="py-2 px-3 border border-gray-200">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(dept._id)}
                        className="px-2 py-1 text-xs border border-red-300 rounded hover:bg-red-50 text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="departments"
        />
        </>
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
              onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g., Finance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e: any) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="e.g., FIN"
              maxLength={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
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
                onChange={(e: any) => setFormData({ ...formData, head: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">Select a department head (optional)</option>
                {departmentHeads.map((user: any) => (
                  <option key={user._id} value={user._id}>
                    {user.firstName} {user.lastName} {user.email ? `(${user.email})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <ModalFooter>
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
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

