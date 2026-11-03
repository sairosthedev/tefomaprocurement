import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { financeAPI } from '../lib/api';
import { DollarSign, TrendingUp, AlertCircle, PieChart } from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import PageHeader from '../components/PageHeader';
import TableSkeleton from '../components/TableSkeleton';
import Modal, { ModalFooter } from '../components/Modal';

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

  // Finance owns budget allocation (BRD FR-B1, "Finance shall allocate a budget
  // to each department"), and the API already accepts finance on this route.
  // Gating the edit control on admin alone left the Finance Manager able to see
  // the page but not do the one thing it exists for.
  const canEditAllocations = user?.role === 'finance' || user?.role === 'admin';

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

  // Budgets are held in the business unit's base currency.
  const currency = budgetData.currency || getCurrentSbuCurrency();
  const totalBudget = budgetData.totalBudget || 0;
  const utilisedTotal = budgetData.utilised ?? budgetData.utilized ?? 0;
  const utilizationPercentage = totalBudget > 0
    ? ((utilisedTotal / totalBudget) * 100).toFixed(1)
    : '0.0';
  const overBudgetCount = budgetData.departmentsOverBudget || 0;
  const committedPercentage = totalBudget > 0
    ? ((budgetData.committed / totalBudget) * 100).toFixed(1)
    : '0.0';

  // While the figures load, each card keeps its shape with a placeholder bar.
  const figure = (node: React.ReactNode, withSubline = false) =>
    loading ? (
      <>
        <span className="block h-7 w-28 mt-1 rounded bg-gray-200 animate-pulse" />
        {withSubline && <span className="block h-3 w-16 mt-1.5 rounded bg-gray-200 animate-pulse" />}
      </>
    ) : (
      node
    );
  const columnCount = canEditAllocations ? 7 : 6;

  return (
    <div className="p-8">
      <PageHeader
        title="Budget Management"
        subtitle={`FY ${budgetData.fiscalYear} — live spend from requisitions, purchase orders and payments`}
      />

      {overBudgetCount > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">
            {overBudgetCount} department{overBudgetCount === 1 ? ' is' : 's are'} over budget
          </span>{' '}
          for FY {budgetData.fiscalYear}. Committed spend includes approved requisitions that have not yet
          reached a purchase order.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              {figure(<p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBudget, currency)}</p>)}
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
              {figure(<>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(utilisedTotal, currency)}</p>
                <p className="text-xs text-gray-400">{utilizationPercentage}% of total</p>
              </>, true)}
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
              {figure(<>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(budgetData.committed, currency)}</p>
                <p className="text-xs text-gray-400">{committedPercentage}% of total</p>
              </>, true)}
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
              {figure(<>
                <p className={`text-2xl font-bold ${budgetData.available < 0 ? 'text-red-600' : 'text-purple-600'}`}>
                  {formatCurrency(budgetData.available, currency)}
                </p>
                <p className="text-xs text-gray-400">
                  {budgetData.available < 0
                    ? 'Over allocation'
                    : `${totalBudget > 0 ? ((budgetData.available / totalBudget) * 100).toFixed(1) : '0.0'}% remaining`}
                </p>
              </>, true)}
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
            <span className="text-sm text-gray-600">Utilized{!loading && ` (${utilizationPercentage}%)`}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full" />
            <span className="text-sm text-gray-600">Committed{!loading && ` (${committedPercentage}%)`}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 rounded-full" />
            <span className="text-sm text-gray-600">
              Available{!loading && ` (${totalBudget > 0 ? ((budgetData.available / totalBudget) * 100).toFixed(1) : '0.0'}%)`}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Department Budgets</h2>
          {canEditAllocations && (
            <p className="text-xs text-gray-500">Click edit to set FY allocations</p>
          )}
        </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Department</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Allocated</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Utilized</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Committed</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Available</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Utilization</th>
                  {canEditAllocations && <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={columnCount} />
              ) : budgetData.departments.length === 0 ? (
                <tbody><tr><td colSpan={columnCount} className="text-center text-gray-500 py-12">
                  No departments configured yet.
                </td></tr></tbody>
              ) : (
              <tbody>
                {budgetData.departments.map((dept: any) => (
                  <tr key={dept.departmentId} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                    <td className="py-2 px-3 border-b border-gray-100 font-medium text-gray-900">
                      {dept.name}
                      {dept.isOverBudget && (
                        <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Over budget
                        </span>
                      )}
                      {dept.budget === 0 && (
                        <span className="ml-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          No allocation
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{formatCurrency(dept.budget, dept.currency || currency)}</td>
                    <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{formatCurrency(dept.utilised ?? dept.utilized, dept.currency || currency)}</td>
                    <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{formatCurrency(dept.committed, dept.currency || currency)}</td>
                    {/* Overspend shows as a negative figure rather than being
                        floored at zero, which hid it entirely. */}
                    <td className={`py-2 px-3 border-b border-gray-100 ${dept.available < 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                      {formatCurrency(dept.available, dept.currency || currency)}
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className={`h-full rounded-full ${dept.percentage > 100 ? 'bg-red-600' : dept.percentage > 75 ? 'bg-red-500' : dept.percentage > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(dept.percentage, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm ${dept.percentage > 100 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                          {dept.percentage}%
                        </span>
                      </div>
                    </td>
                    {canEditAllocations && (
                      <td className="py-2 px-3 border-b border-gray-100 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(dept)}
                          className="px-2 py-1 text-xs border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              )}
            </table>
          </div>
      </div>

      <Modal
        isOpen={Boolean(editDept)}
        onClose={() => setEditDept(null)}
        title={`Set budget — ${editDept?.name || ''}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allocated amount (FY {budgetData.fiscalYear}, {editDept?.currency || currency})
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
          <ModalFooter>
            <button
              type="button"
              onClick={() => setEditDept(null)}
              className="px-4 py-2 text-sm text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAllocation}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
