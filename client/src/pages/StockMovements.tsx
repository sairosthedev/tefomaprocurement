import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useToast } from '../components/Toast';
import { 
  Search, ArrowUpRight, ArrowDownLeft, Package, 
  Loader2, Calendar, Filter
} from 'lucide-react';
import { formatCurrency } from '../lib/constants';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import TableSkeleton from '../components/TableSkeleton';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

const movementTypes: any = {
  'stock-in': { label: 'Stock In', color: 'text-green-600 bg-green-100', icon: ArrowDownLeft },
  'stock-out': { label: 'Stock Out', color: 'text-red-600 bg-red-100', icon: ArrowUpRight },
  'adjustment': { label: 'Adjustment', color: 'text-amber-600 bg-amber-100', icon: Package },
  'transfer': { label: 'Transfer', color: 'text-blue-600 bg-blue-100', icon: Package }
};

export default function StockMovements() {
  const { showToast } = useToast();
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [typeFilter, setTypeFilter] = useState<any>('');
  const [dateRange, setDateRange] = useState<any>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [searchTerm, typeFilter, dateRange]);

  useEffect(() => {
    fetchMovements();
  }, [page, limit, searchTerm, typeFilter, dateRange]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stores/movements', {
        params: { search: searchTerm, type: typeFilter, range: dateRange, page, limit }
      });
      if (response.data.success) {
        setMovements(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
      }
    } catch (error: any) {
      console.error('Failed to fetch movements:', error);
      showToast('Failed to load stock movements', 'error');
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Stock Movements"
        subtitle="Complete history of all stock transactions"
      />

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
                {movements.filter((m: any) => m.type === 'stock-in').length}
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
                {movements.filter((m: any) => m.type === 'stock-out').length}
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
                {movements.filter((m: any) => m.type === 'adjustment').length}
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
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by item name, code, or reference..."
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e: any) => setTypeFilter(e.target.value)}
            className="px-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Types</option>
            <option value="stock-in">Stock In</option>
            <option value="stock-out">Stock Out</option>
            <option value="adjustment">Adjustment</option>
            <option value="transfer">Transfer</option>
          </select>
          <select
            value={dateRange}
            onChange={(e: any) => setDateRange(e.target.value)}
            className="px-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      {/* Movements List */}
      <div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Type</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Reference</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Performed By</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Date</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Notes</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={7} />
            ) : movements.length === 0 ? (
              <tbody><tr><td colSpan={7} className="text-center py-12 text-gray-500">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p>No stock movements found</p>
              </td></tr></tbody>
            ) : (
              <tbody>
                {movements.map((movement: any) => {
                  const typeInfo = movementTypes[movement.type] || movementTypes['adjustment'];
                  const Icon = typeInfo.icon;
                  return (
                    <tr key={movement._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{movement.item?.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{movement.item?.itemCode}</p>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className={`font-semibold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.unit}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className="font-mono text-primary">{movement.reference}</span>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-600">
                        {movement.performedBy?.firstName} {movement.performedBy?.lastName}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-500">
                        {new Date(movement.createdAt).toLocaleDateString('en-ZA')}
                        <br />
                        <span className="text-xs">{new Date(movement.createdAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-500 max-w-xs truncate">
                        {movement.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
        {!loading && <Pagination
          page={page}
          pages={pagination.pages}
          total={pagination.total}
          onPageChange={setPage}
          pageSize={limit}
          onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
          itemLabel="movements"
        />}
      </div>
    </div>
  );
}

