import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { 
  Search, Package, AlertTriangle, TrendingDown, 
  TrendingUp, Loader2, Edit, Plus, Upload, Download, FileSpreadsheet, XCircle
} from 'lucide-react';
import ViewButton from '../components/ViewButton';
import Modal from '../components/Modal';
import { CategorySelect } from '../components/CategorySelect';
import { formatCurrency, UNITS_OF_MEASUREMENT, getCategoryName } from '../lib/constants';

// Map a spreadsheet row (any header casing/variant) to our canonical fields.
const TEMPLATE_HEADERS = ['code', 'name', 'description', 'category', 'unit', 'reorderLevel', 'quantity', 'unitPrice'];

const COLUMN_ALIASES: Record<string, string> = {
  code: 'code', itemcode: 'code', 'item code': 'code', sku: 'code',
  name: 'name', item: 'name', 'item name': 'name', itemname: 'name',
  description: 'description', desc: 'description', details: 'description',
  category: 'category', cat: 'category',
  unit: 'unit', uom: 'unit', units: 'unit',
  reorderlevel: 'reorderLevel', reorder: 'reorderLevel', 'reorder level': 'reorderLevel', min: 'reorderLevel', minimum: 'reorderLevel',
  quantity: 'quantity', qty: 'quantity', 'on hand': 'quantity', onhand: 'quantity', stock: 'quantity', opening: 'quantity', 'opening balance': 'quantity',
  unitprice: 'unitPrice', 'unit price': 'unitPrice', price: 'unitPrice', cost: 'unitPrice', 'unit cost': 'unitPrice'
};

function mapRow(raw: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const key of Object.keys(raw)) {
    const canonical = COLUMN_ALIASES[key.trim().toLowerCase()];
    if (canonical && raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      mapped[canonical] = typeof raw[key] === 'string' ? raw[key].trim() : raw[key];
    }
  }
  return mapped;
}

export default function Inventory() {
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchTerm, setSearchTerm] = useState<any>('');
  const [categoryFilter, setCategoryFilter] = useState<any>('');
  const [showLowStock, setShowLowStock] = useState<any>(false);
  const [showAddModal, setShowAddModal] = useState<any>(false);
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    itemCode: '',
    name: '',
    description: '',
    category: '',
    unit: 'Each',
    reorderLevel: 10,
    currentQuantity: 0,
    unitPrice: 0
  });
  const [showImportModal, setShowImportModal] = useState<any>(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState<any>('');
  const [importing, setImporting] = useState<any>(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [parseError, setParseError] = useState<any>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (error: any) {
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
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to add item', 'error');
    }
  };

  const downloadTemplate = () => {
    const example = [
      {
        code: 'ITEM-000001',
        name: 'A4 Paper',
        description: '80gsm white printing paper',
        category: 'Office Supplies',
        unit: 'box',
        reorderLevel: 10,
        quantity: 50,
        unitPrice: 4.5
      }
    ];
    const ws = XLSX.utils.json_to_sheet(example, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, 'inventory-import-template.xlsx');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setImportResult(null);
    setImportFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      const rows = rawRows.map(mapRow).filter((r) => r.name || r.code);
      if (rows.length === 0) {
        setParseError('No valid rows found. Make sure your file has a "name" column.');
        setImportRows([]);
        return;
      }
      setImportRows(rows);
    } catch (err: any) {
      setParseError('Could not read this file. Use the .xlsx or .csv template.');
      setImportRows([]);
    }
  };

  const doImport = async () => {
    if (importRows.length === 0) return;
    try {
      setImporting(true);
      const res = await api.post('/stores/inventory/bulk', { items: importRows });
      setImportResult(res.data);
      showToast(res.data.message || 'Import complete', res.data.summary?.failed ? 'info' : 'success');
      fetchInventory();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setShowImportModal(false);
    setImportRows([]);
    setImportFileName('');
    setImportResult(null);
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const lowStockCount = inventory.filter((inv: any) => {
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-primary text-primary rounded-xl font-medium hover:bg-primary/5 transition-colors"
          >
            <Upload className="h-5 w-5" />
            Import Excel
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Item
          </button>
        </div>
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
                {formatCurrency(inventory.reduce((sum: any, inv: any) => 
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
                {new Set(inventory.map((inv: any) => inv.item?.category).filter(Boolean)).size}
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
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e: any) => setCategoryFilter(e.target.value)}
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
                {inventory.map((inv: any) => {
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
                        <span className="text-sm text-gray-600" title={item.category || ''}>
                          {item.category ? getCategoryName(item.category) : '-'}
                        </span>
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
                onChange={(e: any) => setFormData({ ...formData, itemCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Auto-generated if empty"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <CategorySelect
                value={formData.category}
                onChange={(code) => setFormData({ ...formData, category: code })}
                placeholder="Select Category"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              placeholder="e.g., A4 Paper"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e: any) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {UNITS_OF_MEASUREMENT.map((unit: any) => (
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
                onChange={(e: any) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
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
                onChange={(e: any) => setFormData({ ...formData, currentQuantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e: any) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
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
                <p className="text-gray-900">{selectedItem.item?.category ? getCategoryName(selectedItem.item.category) : '-'}</p>
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

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={resetImport}
        title="Bulk Import Inventory"
      >
        <div className="space-y-4">
          {!importResult && (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">How it works</p>
                <p className="text-blue-700">
                  Upload an Excel/CSV with columns: <span className="font-mono text-xs">code, name, description, category, unit, reorderLevel, quantity, unitPrice</span>.
                  Existing items (matched by code or name) are updated; new ones are created. Quantity sets the opening stock balance.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
                >
                  <Download className="h-4 w-4" /> Download template
                </button>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  className="hidden"
                  id="inventory-import-file"
                />
                <label
                  htmlFor="inventory-import-file"
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-8 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <FileSpreadsheet className="h-8 w-8 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {importFileName || 'Click to choose an Excel or CSV file'}
                  </span>
                  <span className="text-xs text-gray-400">.xlsx, .xls or .csv</span>
                </label>
              </div>

              {parseError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> {parseError}
                </p>
              )}

              {importRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Preview — {importRows.length} row{importRows.length > 1 ? 's' : ''}
                  </p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold text-gray-600">Name</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-600">Category</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-600">Unit</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-600">Qty</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-600">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importRows.slice(0, 50).map((r: any, i: number) => (
                          <tr key={i}>
                            <td className="py-1.5 px-3 text-gray-900">{r.name || r.code}</td>
                            <td className="py-1.5 px-3 text-gray-500">{r.category || '—'}</td>
                            <td className="py-1.5 px-3 text-gray-500">{r.unit || 'each'}</td>
                            <td className="py-1.5 px-3 text-right text-gray-900">{r.quantity ?? '—'}</td>
                            <td className="py-1.5 px-3 text-right text-gray-900">{r.unitPrice ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importRows.length > 50 && (
                    <p className="text-xs text-gray-400 mt-1">Showing first 50 of {importRows.length} rows.</p>
                  )}
                </div>
              )}
            </>
          )}

          {importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.summary?.created || 0}</p>
                  <p className="text-xs text-gray-500">Created</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{importResult.summary?.updated || 0}</p>
                  <p className="text-xs text-gray-500">Updated</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{importResult.summary?.failed || 0}</p>
                  <p className="text-xs text-gray-500">Failed</p>
                </div>
              </div>
              {importResult.results?.some((r: any) => r.status === 'failed') && (
                <div className="border border-red-100 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-red-50">
                      {importResult.results
                        .filter((r: any) => r.status === 'failed')
                        .map((r: any, i: number) => (
                          <tr key={i} className="bg-red-50/40">
                            <td className="py-1.5 px-3 text-gray-700">Row {r.row}: {r.name}</td>
                            <td className="py-1.5 px-3 text-red-600">{r.message}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={resetImport}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
            >
              {importResult ? 'Close' : 'Cancel'}
            </button>
            {!importResult && (
              <button
                onClick={doImport}
                disabled={importing || importRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import {importRows.length > 0 ? `${importRows.length} rows` : ''}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

