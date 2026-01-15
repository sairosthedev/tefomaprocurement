import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { 
  Search, FileCheck, Loader2, Calendar, User, 
  Filter, Eye, LogIn, Edit, Trash2, Plus
} from 'lucide-react';
import Modal from '../components/Modal';

const actionIcons = {
  login: LogIn,
  create: Plus,
  update: Edit,
  delete: Trash2,
  approve: FileCheck,
  reject: Trash2
};

const actionColors = {
  login: 'bg-blue-100 text-blue-600',
  create: 'bg-green-100 text-green-600',
  update: 'bg-amber-100 text-amber-600',
  delete: 'bg-red-100 text-red-600',
  approve: 'bg-green-100 text-green-600',
  reject: 'bg-red-100 text-red-600',
  login_failed: 'bg-red-100 text-red-600'
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [searchTerm, actionFilter, entityFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/audit-logs', {
        params: { search: searchTerm, action: actionFilter, entity: entityFilter }
      });
      if (response.data.success) {
        setLogs(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      // Mock data for demonstration
      setLogs([
        {
          _id: '1',
          action: 'login',
          entity: 'User',
          description: 'User logged in successfully',
          user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          ipAddress: '192.168.1.1',
          createdAt: new Date().toISOString()
        },
        {
          _id: '2',
          action: 'create',
          entity: 'PurchaseOrder',
          description: 'Created new purchase order PO-2026-00123',
          user: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
          ipAddress: '192.168.1.2',
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          _id: '3',
          action: 'approve',
          entity: 'PurchaseOrder',
          description: 'Approved purchase order PO-2026-00122',
          user: { firstName: 'Mike', lastName: 'Finance', email: 'mike@example.com' },
          ipAddress: '192.168.1.3',
          createdAt: new Date(Date.now() - 7200000).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-500 mt-1">Track all system activities and changes</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by description, user, or entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Entities</option>
            <option value="User">Users</option>
            <option value="PurchaseOrder">Purchase Orders</option>
            <option value="RFQ">RFQs</option>
            <option value="Quotation">Quotations</option>
            <option value="SupplierProfile">Suppliers</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Timestamp</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Action</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Description</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">User</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">IP Address</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const Icon = actionIcons[log.action] || FileCheck;
                  const colorClass = actionColors[log.action] || 'bg-gray-100 text-gray-600';
                  
                  return (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-900">
                          {new Date(log.createdAt).toLocaleDateString('en-ZA')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString('en-ZA')}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-gray-900 max-w-xs truncate">{log.description}</p>
                        <p className="text-xs text-gray-500">{log.entity}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-gray-900">
                          {log.user?.firstName} {log.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{log.user?.email}</p>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500 font-mono">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => { setSelectedLog(log); setShowModal(true); }}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Audit Log Details"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Action</label>
                <p className="font-medium text-gray-900 capitalize">{selectedLog.action}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Entity</label>
                <p className="font-medium text-gray-900">{selectedLog.entity}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Timestamp</label>
                <p className="text-gray-900">
                  {new Date(selectedLog.createdAt).toLocaleString('en-ZA')}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">IP Address</label>
                <p className="text-gray-900 font-mono">{selectedLog.ipAddress || 'N/A'}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-gray-500">User</label>
              <p className="text-gray-900">
                {selectedLog.user?.firstName} {selectedLog.user?.lastName} ({selectedLog.user?.email})
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-500">Description</label>
              <p className="text-gray-900">{selectedLog.description}</p>
            </div>

            {selectedLog.previousData && (
              <div>
                <label className="text-sm text-gray-500">Previous Data</label>
                <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto">
                  {JSON.stringify(selectedLog.previousData, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newData && (
              <div>
                <label className="text-sm text-gray-500">New Data</label>
                <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto">
                  {JSON.stringify(selectedLog.newData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

