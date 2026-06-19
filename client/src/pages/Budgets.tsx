import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { financeAPI } from '../lib/api';
import { DollarSign, TrendingUp, AlertCircle, Loader2, PieChart, Edit2 } from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

export default function Budgets() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [budgetData, setBudgetData] = useState<any>({
    fiscalYear: new Date().getFullYear(),
    totalBudget: 0,
    utilized: 0,
    committed: 0,
    available: 0,
    departments: []
  });
  const [editDept, setEditDept] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      const response = await financeAPI.getBudgets();
      if (response.data.success) {
        setBudgetData(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch budget data:', error);
      showToast(error.response?.data?.message || 'Failed to load budget data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (dept: any) => {
    setEditDept(dept);
    setEditAmount(String(dept.budget || 0));
  };

  const handleSaveAllocation = async () => {
    if (!editDept) return;
    const amount = Number(editAmount);
    if (Number.isNaN(amount) || amount < 0) {
      showToast('Enter a valid allocation amount', 'error');
      return;
    }

    try {
      setSaving(true);
      await financeAPI.upsertDepartmentBudget({
        departmentId: editDept.departmentId,
        fiscalYear: budgetData.fiscalYear,
        allocatedAmount: amount
      });
      showToast('Budget allocation saved', 'success');
      setEditDept(null);
      fetchBudgetData();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save allocation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalBudget = budgetData.totalBudget || 0;
  const utilizationPercentage = totalBudget > 0
    ? ((budgetData.utilized / totalBudget) * 100).toFixed(1)
    : '0.0';
  const committedPercentage = totalBudget > 0
    ? ((budgetData.committed / totalBudget) * 100).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Budget Management"
        subtitle={`FY ${budgetData.fiscalYear} — live spend from purchase orders and payments`}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Utilized (paid)</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(budgetData.utilized)}</p>
              <p className="text-xs text-gray-400">{utilizationPercentage}% of total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Committed</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(budgetData.committed)}</p>
              <p className="text-xs text-gray-400">{committedPercentage}% of total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <PieChart className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(budgetData.available)}</p>
              <p className="text-xs text-gray-400">
                {totalBudget > 0 ? ((budgetData.available / totalBudget) * 100).toFixed(1) : '0.0'}% remaining
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Budget Utilization</h2>
        <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${utilizationPercentage}%` }}
            />
            <div
              className="bg-amber-500 transition-all duration-500"
              style={{ width: `${committedPercentage}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-600">Utilized ({utilizationPercentage}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full" />
            <span className="text-sm text-gray-600">Committed ({committedPercentage}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 rounded-full" />
            <span className="text-sm text-gray-600">
              Available ({totalBudget > 0 ? ((budgetData.available / totalBudget) * 100).toFixed(1) : '0.0'}%)
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Department Budgets</h2>
          {isAdmin && (
            <p className="text-xs text-gray-500">Click edit to set FY allocations</p>
          )}
        </div>
        {budgetData.departments.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No departments configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Department</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Allocated</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Utilized</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Committed</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Available</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Utilization</th>
                  {isAdmin && <th className="text-right py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgetData.departments.map((dept: any) => (
                  <tr key={dept.departmentId} className="hover:bg-gray-50">
                    <td className="py-4 px-6 font-medium text-gray-900">{dept.name}</td>
                    <td className="py-4 px-6 text-gray-600">{formatCurrency(dept.budget)}</td>
                    <td className="py-4 px-6 text-gray-600">{formatCurrency(dept.utilized)}</td>
                    <td className="py-4 px-6 text-gray-600">{formatCurrency(dept.committed)}</td>
                    <td className="py-4 px-6 text-gray-600">{formatCurrency(dept.available)}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className={`h-full rounded-full ${dept.percentage > 75 ? 'bg-red-500' : dept.percentage > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(dept.percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{dept.percentage}%</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(dept)}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(editDept)}
        onClose={() => setEditDept(null)}
        title={`Set budget — ${editDept?.name || ''}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allocated amount (FY {budgetData.fiscalYear})
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditDept(null)}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAllocation}
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
