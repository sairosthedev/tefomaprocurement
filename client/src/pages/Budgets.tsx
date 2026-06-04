import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { DollarSign, TrendingUp, AlertCircle, Loader2, PieChart } from 'lucide-react';
import { formatCurrency } from '../lib/constants';

export default function Budgets() {
  const [loading, setLoading] = useState<any>(true);
  const [budgetData, setBudgetData] = useState<any>({
    totalBudget: 500000,
    utilized: 125000,
    committed: 75000,
    available: 300000,
    departments: []
  });

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const fetchBudgetData = async () => {
    try {
      setLoading(true);
      // In production, this would fetch from API
      // const response = await api.get('/finance/budgets');
      
      // Mock data for demonstration
      setBudgetData({
        totalBudget: 500000,
        utilized: 125000,
        committed: 75000,
        available: 300000,
        departments: [
          { name: 'Operations', budget: 150000, utilized: 45000, percentage: 30 },
          { name: 'IT', budget: 100000, utilized: 35000, percentage: 35 },
          { name: 'Admin', budget: 80000, utilized: 25000, percentage: 31 },
          { name: 'Finance', budget: 70000, utilized: 20000, percentage: 29 },
          { name: 'HR', budget: 50000, utilized: 0, percentage: 0 }
        ]
      });
    } catch (error: any) {
      console.error('Failed to fetch budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const utilizationPercentage = ((budgetData.utilized / budgetData.totalBudget) * 100).toFixed(1);
  const committedPercentage = ((budgetData.committed / budgetData.totalBudget) * 100).toFixed(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Budget Management</h1>
        <p className="text-gray-500 mt-1">Monitor and manage procurement budgets</p>
      </div>

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetData.totalBudget)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Utilized</p>
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
              <p className="text-xs text-gray-400">{((budgetData.available / budgetData.totalBudget) * 100).toFixed(1)}% remaining</p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Progress */}
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
            <span className="text-sm text-gray-600">Available ({((budgetData.available / budgetData.totalBudget) * 100).toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Department Budgets */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Department Budgets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Department</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Allocated Budget</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Utilized</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Remaining</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {budgetData.departments.map((dept: any, index: any) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="py-4 px-6 font-medium text-gray-900">{dept.name}</td>
                  <td className="py-4 px-6 text-gray-600">{formatCurrency(dept.budget)}</td>
                  <td className="py-4 px-6 text-gray-600">{formatCurrency(dept.utilized)}</td>
                  <td className="py-4 px-6 text-gray-600">{formatCurrency(dept.budget - dept.utilized)}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                        <div 
                          className={`h-full rounded-full ${dept.percentage > 75 ? 'bg-red-500' : dept.percentage > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${dept.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{dept.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

