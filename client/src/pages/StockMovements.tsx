import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { 
  Search, ArrowUpRight, ArrowDownLeft, Package, 
  Loader2, Calendar, Filter
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';

const movementTypes = {
  'stock-in': { label: 'Stock In', color: 'text-green-600 bg-green-100', icon: ArrowDownLeft },
  'stock-out': { label: 'Stock Out', color: 'text-red-600 bg-red-100', icon: ArrowUpRight },
  'adjustment': { label: 'Adjustment', color: 'text-amber-600 bg-amber-100', icon: Package },
  'transfer': { label: 'Transfer', color: 'text-blue-600 bg-blue-100', icon: Package }
};

export default function StockMovements() {
  const { showToast } = useToast();
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    fetchMovements();
  }, [searchTerm, typeFilter, dateRange]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stores/movements', {
        params: { search: searchTerm, type: typeFilter, range: dateRange }
      });
      if (response.data.success) {
        setMovements(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch movements:', error);
      showToast('Failed to load stock movements', 'error');
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
        <p className="text-gray-500 mt-1">Complete history of all stock transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <ArrowDownLeft className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Stock In</p>
              <p className="text-2xl font-bold text-green-700">
                {movements.filter(m => m.type === 'stock-in').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <ArrowUpRight className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600">Stock Out</p>
              <p className="text-2xl font-bold text-red-700">
                {movements.filter(m => m.type === 'stock-out').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Package className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-600">Adjustments</p>
              <p className="text-2xl font-bold text-amber-700">
                {movements.filter(m => m.type === 'adjustment').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Total Movements</p>
              <p className="text-2xl font-bold text-blue-700">{movements.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by item name, code, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Types</option>
            <option value="stock-in">Stock In</option>
            <option value="stock-out">Stock Out</option>
            <option value="adjustment">Adjustment</option>
            <option value="transfer">Transfer</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Movements List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No stock movements found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Type</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Item</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Quantity</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Reference</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Performed By</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((movement) => {
                  const typeInfo = movementTypes[movement.type] || movementTypes['adjustment'];
                  const Icon = typeInfo.icon;
                  return (
                    <tr key={movement._id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">{movement.item?.name}</p>
                        <p className="text-sm text-gray-500 font-mono">{movement.item?.itemCode}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`font-semibold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.unit}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm text-primary">{movement.reference}</span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">
                        {movement.performedBy?.firstName} {movement.performedBy?.lastName}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {new Date(movement.createdAt).toLocaleDateString('en-ZA')}
                        <br />
                        <span className="text-xs">{new Date(movement.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500 max-w-xs truncate">
                        {movement.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

