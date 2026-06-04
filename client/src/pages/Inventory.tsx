import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { 
  Search, Package, AlertTriangle, TrendingDown, 
  TrendingUp, Loader2, Edit, Plus
} from 'lucide-react';
import ViewButton from '../components/ViewButton';
import Modal from '../components/Modal';
import { formatCurrency, UNITS_OF_MEASUREMENT } from '../lib/constants';

export default function Inventory() {
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    itemCode: '',
    name: '',
    description: '',
    category: '',
    unit: 'Each',
    reorderLevel: 10,
    currentQuantity: 0,
    unitPrice: 0
  });

  useEffect(() => {
    fetchInventory();
  }, [searchTerm, categoryFilter, showLowStock]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stores/inventory', {
        params: { 
          search: searchTerm, 
          category: categoryFilter,
          lowStock: showLowStock 
        }
      });
      if (response.data.success) {
        setInventory(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    try {
      if (!formData.name.trim()) {
        showToast('Please enter item name', 'error');
        return;
      }

      await api.post('/stores/inventory', formData);
      showToast('Item added to inventory', 'success');
      setShowAddModal(false);
      setFormData({
        itemCode: '',
        name: '',
        description: '',
        category: '',
        unit: 'Each',
        reorderLevel: 10,
        currentQuantity: 0,
        unitPrice: 0
      });
      fetchInventory();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to add item', 'error');
    }
  };

  const lowStockCount = inventory.filter(inv => {
    const item = inv.item || {};
    return inv.quantityOnHand <= (item.reorderLevel || 0);
  }).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-1">View and manage stock levels</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setShowLowStock(!showLowStock)}
          className={`rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
            showLowStock 
              ? 'bg-red-50 border-red-200' 
              : 'bg-white border-gray-100 hover:border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${showLowStock ? 'bg-red-200' : 'bg-red-100'}`}>
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Stock Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(inventory.reduce((sum, inv) => 
                  sum + (inv.totalValue || 0), 0
                ))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <TrendingDown className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Categories</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(inventory.map(inv => inv.item?.category).filter(Boolean)).size}
              </p>
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
              placeholder="Search by name or item code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Categories</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="IT Equipment">IT Equipment</option>
            <option value="Furniture">Furniture</option>
            <option value="Cleaning">Cleaning</option>
            <option value="Stationery">Stationery</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : inventory.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Item Code</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Name</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Stock Level</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Reorder Level</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Unit Price</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventory.map((inv) => {
                  const item = inv.item || {};
                  const isLowStock = inv.quantityOnHand <= (item.reorderLevel || 0);
                  return (
                    <tr key={inv._id} className={`hover:bg-gray-50 ${isLowStock ? 'bg-red-50/50' : ''}`}>
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm font-medium text-primary">
                          {item.code || `ITM-${inv._id.slice(-6).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">{item.name || '-'}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">{item.description || ''}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-600">{item.category || '-'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                          {inv.quantityOnHand || 0} {item.unit || 'each'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {item.reorderLevel || 0} {item.unit || 'each'}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900">
                        {formatCurrency(inv.unitCost || 0)}
                      </td>
                      <td className="py-4 px-6">
                        {isLowStock ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <ViewButton
                          onClick={() => { setSelectedItem({ ...inv, item }); setShowViewModal(true); }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Inventory Item"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
              <input
                type="text"
                value={formData.itemCode}
                onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Auto-generated if empty"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Select Category</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="IT Equipment">IT Equipment</option>
                <option value="Furniture">Furniture</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Stationery">Stationery</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              placeholder="e.g., A4 Paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {UNITS_OF_MEASUREMENT.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Quantity</label>
              <input
                type="number"
                min="0"
                value={formData.currentQuantity}
                onChange={(e) => setFormData({ ...formData, currentQuantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark"
            >
              Add Item
            </button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Item Details"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Item Code</label>
                <p className="font-mono font-medium text-primary">
                  {selectedItem.item?.code || `ITM-${selectedItem._id.slice(-6).toUpperCase()}`}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Category</label>
                <p className="text-gray-900">{selectedItem.item?.category || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Current Stock</label>
                <p className="text-xl font-bold text-gray-900">
                  {selectedItem.quantityOnHand || 0} {selectedItem.item?.unit || 'each'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Unit Price</label>
                <p className="text-gray-900">{formatCurrency(selectedItem.unitCost || 0)}</p>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-500">Name</label>
              <p className="text-gray-900 font-medium">{selectedItem.item?.name || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Description</label>
              <p className="text-gray-900">{selectedItem.item?.description || 'No description'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Total Value</label>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(selectedItem.totalValue || 0)}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

