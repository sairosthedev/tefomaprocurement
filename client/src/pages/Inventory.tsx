import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api, { storesAPI } from '../lib/api';
import { 
  Search, Package, AlertTriangle, TrendingDown, 
  TrendingUp, Loader2, Plus, Upload, Download, FileSpreadsheet, PackageCheck, X, ArrowLeft, XCircle,
  ShoppingCart, PackageX
} from 'lucide-react';
import {
  effectiveReorderLevel,
  stockStatus,
  suggestedRestockQuantity,
  isValidCategoryCode,
  USAGE_WINDOW_DAYS
} from '@fossil/shared';
import PageHeader from '../components/PageHeader';
import ViewButton from '../components/ViewButton';
import Modal from '../components/Modal';
import Drawer from '../components/Drawer';
import TableSkeleton from '../components/TableSkeleton';
import { CategorySelect } from '../components/CategorySelect';
import { formatCurrency, UNITS_OF_MEASUREMENT, getCategoryName } from '../lib/constants';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { FormSteps, FormStepNav } from '../components/FormSteps';
import { useDebouncedValue } from '../lib/useDebouncedValue';

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

const ADD_STEPS = [
  { label: 'Item', description: 'What the item is' },
  { label: 'Stock', description: 'Price, quantity, reorder level' },
  { label: 'Review & add', description: 'Check, then add' }
];

const IMPORT_STEPS = [
  { label: 'Upload', description: 'Choose the spreadsheet' },
  { label: 'Preview', description: 'Check the rows' },
  { label: 'Result', description: 'Created, updated, failed' }
];

export default function Inventory() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchTermInput, setSearchTerm] = useState(() => searchParams.get('search')?.trim() || '');
  // The box shows what's typed; the list is fetched once typing pauses.
  const searchTerm = useDebouncedValue(searchTermInput);
  const [categoryFilter, setCategoryFilter] = useState<any>('');
  const [stockFilter, setStockFilter] = useState<'' | 'low' | 'out'>(() => {
    const f = searchParams.get('filter');
    return f === 'low' || f === 'out' ? f : '';
  });
  // Restock: the stock row being restocked, and the request being built.
  const [restockFor, setRestockFor] = useState<any>(null);
  const [restockQty, setRestockQty] = useState<string>('');
  const [restockCategory, setRestockCategory] = useState<string>('');
  const [restockNote, setRestockNote] = useState<string>('');
  const [restocking, setRestocking] = useState(false);
  // This site's own levels, edited from the item view.
  const [levelsForm, setLevelsForm] = useState<{ reorderLevel: string; reorderQuantity: string }>({ reorderLevel: '', reorderQuantity: '' });
  const [savingLevels, setSavingLevels] = useState(false);
  const [usage, setUsage] = useState<any>(null);
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalStockValue: 0,
    categoryCount: 0
  });
  const [issuingItemId, setIssuingItemId] = useState<string | null>(null);
  const [addStep, setAddStep] = useState(0);
  const [adding, setAdding] = useState(false);
  const addTopRef = useRef<HTMLDivElement>(null);

  const issueContext = useMemo(() => {
    const prId = searchParams.get('prId');
    const lineIndex = searchParams.get('lineIndex');
    if (!prId || lineIndex === null || lineIndex === '') return null;
    return {
      prId,
      lineIndex: Number(lineIndex),
      prNumber: searchParams.get('prNumber') || '',
      lineQty: Number(searchParams.get('lineQty')) || 0,
      lineUnit: searchParams.get('lineUnit') || 'each',
      lineDescription: searchParams.get('search')?.trim() || ''
    };
  }, [searchParams]);

  const clearIssueContext = () => {
    const next = new URLSearchParams(searchParams);
    ['prId', 'lineIndex', 'prNumber', 'lineQty', 'lineUnit'].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  const issueForRequisition = async (inv: any) => {
    if (!issueContext) return;
    const itemId = inv.item?._id;
    if (!itemId) return;

    const available = inv.quantityOnHand || 0;
    if (available < issueContext.lineQty) {
      showToast(
        `Not enough stock. Need ${issueContext.lineQty} ${issueContext.lineUnit}, only ${available} on hand.`,
        'error'
      );
      return;
    }

    try {
      setIssuingItemId(itemId);
      const res = await storesAPI.issuePurchaseRequisitionLine(issueContext.prId, {
        lineIndex: issueContext.lineIndex,
        itemId,
        notes: `Issued from inventory: ${inv.item?.name || issueContext.lineDescription}`
      });
      showToast(res.data?.message || 'Stock issued', 'success');
      // Back to the IR's review, to carry on with its other lines.
      navigate(`/app/stores-pr-review?review=${issueContext.prId}`);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not issue stock', 'error');
    } finally {
      setIssuingItemId(null);
    }
  };

  // Keep search in sync when arriving from Stores PR Review (or other deep links).
  useEffect(() => {
    const q = searchParams.get('search')?.trim() || '';
    setSearchTerm((prev: string) => (prev === q ? prev : q));
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, stockFilter]);

  useEffect(() => {
    fetchInventory();
  }, [page, limit, searchTerm, categoryFilter, stockFilter]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    // Enter searches straight away, without waiting for the pause.
    fetchInventory({ page: 1, search: searchTermInput.trim() });
  };

  const fetchInventory = async (overrides?: {
    page?: number;
    search?: string;
    category?: string;
    lowStock?: boolean;
  }) => {
    try {
      setLoading(true);
      const filter = overrides?.lowStock === false ? '' : stockFilter;
      const response = await api.get('/stores/inventory', {
        params: {
          search: (overrides?.search ?? searchTerm).trim(),
          category: overrides?.category ?? categoryFilter,
          lowStock: filter === 'low',
          outOfStock: filter === 'out',
          page: overrides?.page ?? page,
          limit
        }
      });
      if (response.data.success) {
        setInventory(response.data.data || []);
        setPagination(parsePagination(response.data.pagination));
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setAddStep(0);
    setShowAddModal(true);
  };

  const goToAddStep = (step: number) => {
    setAddStep(step);
    addTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const validateItemStep = () => {
    if (!formData.name.trim()) {
      showToast('Please enter item name', 'error');
      return false;
    }
    if (!formData.category) {
      showToast('Please select a category', 'error');
      return false;
    }
    return true;
  };

  const nextAddStep = () => {
    if (addStep === 0 && !validateItemStep()) return;
    goToAddStep(addStep + 1);
  };

  const handleAddItem = async () => {
    try {
      if (!validateItemStep()) {
        goToAddStep(0);
        return;
      }

      setAdding(true);
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
      setSearchTerm('');
      setCategoryFilter('');
      setStockFilter('');
      setPage(1);
      fetchInventory({ page: 1, search: '', category: '', lowStock: false });
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to add item', 'error');
    } finally {
      setAdding(false);
    }
  };

  // The spreadsheet library is loaded on use: it is larger than the rest of the app.
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const example = [
      {
        code: 'ITEM-000001',
        name: 'A4 Paper',
        description: '80gsm white printing paper',
        category: 'OFF-STAT',
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
      const [buffer, XLSX] = await Promise.all([file.arrayBuffer(), import('xlsx')]);
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
      setSearchTerm('');
      setCategoryFilter('');
      setStockFilter('');
      setPage(1);
      fetchInventory({ page: 1, search: '', category: '', lowStock: false });
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

  const lowStockCount = stats.lowStockCount;

  const toggleFilter = (next: 'low' | 'out') => {
    const value = stockFilter === next ? '' : next;
    setStockFilter(value);
    const params = new URLSearchParams(searchParams);
    if (value) params.set('filter', value);
    else params.delete('filter');
    setSearchParams(params, { replace: true });
  };

  /** The level that applies to a stock row, and where it came from. */
  const levelOf = (inv: any) => {
    const fallback = effectiveReorderLevel(inv.reorderLevel, inv.item?.reorderLevel);
    return {
      level: typeof inv.effectiveReorderLevel === 'number' ? inv.effectiveReorderLevel : fallback.level,
      source: inv.reorderLevelSource || fallback.source
    };
  };

  const openRestock = (inv: any) => {
    const { level } = levelOf(inv);
    setRestockFor(inv);
    setRestockQty(String(suggestedRestockQuantity(inv.quantityOnHand || 0, level, inv.reorderQuantity)));
    setRestockCategory(isValidCategoryCode(inv.item?.category || '') ? inv.item.category : '');
    setRestockNote('');
  };

  const submitRestock = async () => {
    if (!restockFor) return;
    const quantity = parseInt(restockQty, 10);
    if (!Number.isInteger(quantity) || quantity < 1) {
      showToast('Enter a quantity of at least 1', 'error');
      return;
    }
    if (!restockCategory) {
      showToast('Choose a category so procurement can find suppliers', 'error');
      return;
    }
    try {
      setRestocking(true);
      const res = await storesAPI.createRestock({
        inventoryId: restockFor._id,
        quantity,
        category: restockCategory,
        justification: restockNote.trim() || undefined
      });
      showToast(res.data?.message || 'Restock requested', 'success');
      setRestockFor(null);
      fetchInventory();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not request a restock', 'error');
    } finally {
      setRestocking(false);
    }
  };

  // Opening an item loads its own levels and what it has been used for lately.
  useEffect(() => {
    if (!showViewModal || !selectedItem?._id) return;
    setLevelsForm({
      reorderLevel: typeof selectedItem.reorderLevel === 'number' ? String(selectedItem.reorderLevel) : '',
      reorderQuantity: typeof selectedItem.reorderQuantity === 'number' ? String(selectedItem.reorderQuantity) : ''
    });
    setUsage(null);
    storesAPI
      .getInventoryUsage(selectedItem._id)
      .then((res: any) => setUsage(res.data?.data || null))
      .catch(() => setUsage(null));
  }, [showViewModal, selectedItem?._id]);

  const saveLevels = async () => {
    if (!selectedItem) return;
    try {
      setSavingLevels(true);
      const res = await storesAPI.updateInventoryLevels(selectedItem._id, {
        reorderLevel: levelsForm.reorderLevel.trim() === '' ? null : Number(levelsForm.reorderLevel),
        reorderQuantity: levelsForm.reorderQuantity.trim() === '' ? null : Number(levelsForm.reorderQuantity)
      });
      showToast(res.data?.message || 'Stock levels saved', 'success');
      setShowViewModal(false);
      fetchInventory();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not save the levels', 'error');
    } finally {
      setSavingLevels(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Inventory Management"
        subtitle="View and manage stock levels"
        bottomSpacing="mb-4"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => toggleFilter('low')}
          title="At or below the reorder level, empty shelves included. Click to show only these."
          className={`rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
            stockFilter === 'low'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-gray-100 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${stockFilter === 'low' ? 'bg-amber-200' : 'bg-amber-100'}`}>
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
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
                {formatCurrency(stats.totalStockValue, getCurrentSbuCurrency())}
              </p>
            </div>
          </div>
        </div>

        <div
          onClick={() => toggleFilter('out')}
          title="Nothing on hand. Click to show only these."
          className={`rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
            stockFilter === 'out'
              ? 'bg-red-50 border-red-200'
              : 'bg-white border-gray-100 hover:border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${stockFilter === 'out' ? 'bg-red-200' : 'bg-red-100'}`}>
              <PackageX className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{stats.outOfStockCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {issueContext && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-sm text-gray-800">
            <span className="font-semibold text-primary">Issuing for {issueContext.prNumber}</span>
            <span className="text-gray-500"> — </span>
            {issueContext.lineQty} {issueContext.lineUnit} of &ldquo;{issueContext.lineDescription}&rdquo;
            <p className="text-xs text-gray-500 mt-0.5">Confirm the item below, then click Issue.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/app/stores-pr-review"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to review
            </Link>
            <button
              type="button"
              onClick={clearIssueContext}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-white"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-4">
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="h-4 w-4" />
          Import Excel
        </button>
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row sm:items-center gap-3 md:ml-auto"
        >
          <div className="relative w-full sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTermInput}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
          >
            Search
          </button>
          <div className="w-full sm:w-56">
            <CategorySelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="All Categories"
              clearable
              className="w-full flex items-center justify-between px-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
            />
          </div>
        </form>
      </div>

      {/* Inventory Table */}
      <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item Code</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Name</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Category</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Stock Level</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Reorder Level</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit Price</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton cols={8} />
              ) : inventory.length === 0 ? (
                <tbody><tr><td colSpan={8} className="text-center py-12 text-gray-500">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>No items found</p>
                </td></tr></tbody>
              ) : (
              <tbody>
                {inventory.map((inv: any) => {
                  const item = inv.item || {};
                  // The shared rule: this site's level, else the item's, else the default.
                  const { level, source } = levelOf(inv);
                  const status = stockStatus(inv.quantityOnHand || 0, level);
                  const isLowStock = status !== 'ok';
                  const canIssue =
                    issueContext && (inv.quantityOnHand || 0) >= issueContext.lineQty;
                  const isIssuing = issuingItemId === item._id;
                  return (
                    <tr
                      key={inv._id}
                      className={`transition-colors ${
                        status === 'out'
                          ? 'bg-red-50/60 hover:bg-red-50'
                          : status === 'low'
                          ? 'bg-amber-50/50 hover:bg-amber-50'
                          : 'odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07]'
                      }`}
                    >
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className="font-mono font-medium text-primary">
                          {item.code || `ITM-${inv._id.slice(-6).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{item.name || '-'}</p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{item.description || ''}</p>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className="text-gray-600" title={item.category || ''}>
                          {item.category ? getCategoryName(item.category) : '-'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className={`font-semibold ${status === 'out' ? 'text-red-600' : status === 'low' ? 'text-amber-700' : 'text-gray-900'}`}>
                          {inv.quantityOnHand || 0} {item.unit || 'each'}
                        </span>
                        {(inv.quantityReserved || 0) > 0 && (
                          <span className="block text-xs text-gray-500">{inv.quantityReserved} held for collection</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-500">
                        {level} {item.unit || 'each'}
                        {source === 'default' && (
                          <span className="block text-xs text-amber-700" title="No level set for this item. Set one from View.">default, not set</span>
                        )}
                        {source === 'site' && <span className="block text-xs text-gray-400">this site</span>}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-900">
                        {formatCurrency(inv.unitCost || 0, getCurrentSbuCurrency())}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        {status === 'out' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
                            Out of Stock
                          </span>
                        ) : status === 'low' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          {issueContext && (
                            <button
                              type="button"
                              disabled={!canIssue || isIssuing}
                              title={
                                canIssue
                                  ? `Issue ${issueContext.lineQty} ${issueContext.lineUnit} for ${issueContext.prNumber}`
                                  : `Need ${issueContext.lineQty} on hand (${inv.quantityOnHand || 0} available)`
                              }
                              onClick={() => issueForRequisition(inv)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isIssuing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PackageCheck className="h-3.5 w-3.5" />
                              )}
                              Issue
                            </button>
                          )}
                          {isLowStock && !issueContext && (
                            inv.openRestock ? (
                              <Link
                                to={`/app/requisitions/${inv.openRestock._id}`}
                                title="A restock for this item is already on its way"
                                className="px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap hover:bg-blue-100"
                              >
                                {inv.openRestock.requisitionNumber}
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openRestock({ ...inv, item })}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors whitespace-nowrap"
                              >
                                <ShoppingCart className="h-3.5 w-3.5" />
                                Restock
                              </button>
                            )
                          )}
                          <ViewButton
                            size="xs"
                            showIcon={false}
                            onClick={() => { setSelectedItem({ ...inv, item }); setShowViewModal(true); }}
                          />
                        </div>
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
            itemLabel="items"
          />}
      </div>

      {/* Add Item drawer */}
      <Drawer
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Inventory Item"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Enter on an earlier step moves on rather than adding early.
            if (addStep < ADD_STEPS.length - 1) nextAddStep();
            else handleAddItem();
          }}
        >
        <div ref={addTopRef} className="scroll-mt-4" />
        <FormSteps steps={ADD_STEPS} current={addStep} onSelect={goToAddStep} variant="track" />
        <div className="space-y-4">
          {addStep === 0 && (
            <>
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
                    required
                    className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
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

            </>
          )}

          {addStep === 1 && (
            <>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ({getCurrentSbuCurrency()})</label>
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

            </>
          )}

          {addStep === 2 && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{formData.name}</p>
              </div>
              <div>
                <p className="text-gray-500">Item code</p>
                <p className="font-mono text-gray-900">{formData.itemCode || 'Auto-generated'}</p>
              </div>
              <div>
                <p className="text-gray-500">Category</p>
                <p className="text-gray-900">{formData.category ? getCategoryName(formData.category) : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Unit</p>
                <p className="text-gray-900">{formData.unit}</p>
              </div>
              <div>
                <p className="text-gray-500">Opening quantity</p>
                <p className="text-gray-900">{formData.currentQuantity}</p>
              </div>
              <div>
                <p className="text-gray-500">Reorder level</p>
                <p className="text-gray-900">{formData.reorderLevel}</p>
              </div>
              <div>
                <p className="text-gray-500">Unit price</p>
                <p className="text-gray-900">{formatCurrency(formData.unitPrice || 0, getCurrentSbuCurrency())}</p>
              </div>
              <div>
                <p className="text-gray-500">Opening value</p>
                <p className="font-medium text-green-600">
                  {formatCurrency((formData.unitPrice || 0) * (formData.currentQuantity || 0), getCurrentSbuCurrency())}
                </p>
              </div>
              {formData.description?.trim() && (
                <div className="col-span-2">
                  <p className="text-gray-500">Description</p>
                  <p className="text-gray-900">{formData.description}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <FormStepNav
          current={addStep}
          total={ADD_STEPS.length}
          onBack={() => goToAddStep(addStep - 1)}
          onNext={nextAddStep}
          onCancel={() => setShowAddModal(false)}
          finishLabel={adding ? 'Adding...' : 'Add Item'}
          submitting={adding}
          size="sm"
        />
        </form>
      </Drawer>

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
                <p className="text-gray-900">{formatCurrency(selectedItem.unitCost || 0, getCurrentSbuCurrency())}</p>
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
                {formatCurrency(selectedItem.totalValue || 0, getCurrentSbuCurrency())}
              </p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">Levels at {selectedItem.site?.name || 'this site'}</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                Leave a box blank to use the catalogue level
                {selectedItem.item?.reorderLevel > 0 ? ` (${selectedItem.item.reorderLevel})` : ' (none set, so the default applies)'}
                {' '}and a suggested quantity.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reorder level</label>
                  <input
                    type="number"
                    min="0"
                    value={levelsForm.reorderLevel}
                    onChange={(e: any) => setLevelsForm((f) => ({ ...f, reorderLevel: e.target.value }))}
                    placeholder={String(levelOf(selectedItem).level)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reorder quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={levelsForm.reorderQuantity}
                    onChange={(e: any) => setLevelsForm((f) => ({ ...f, reorderQuantity: e.target.value }))}
                    placeholder="Suggested"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {usage
                  ? usage.issued > 0
                    ? `Issued ${usage.issued} ${selectedItem.item?.unit || 'each'} in the last ${USAGE_WINDOW_DAYS} days, about ${usage.perMonth} a month. A level of about one month's use is a common starting point.`
                    : `Nothing issued in the last ${USAGE_WINDOW_DAYS} days.`
                  : 'Loading recent usage...'}
              </p>
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={saveLevels}
                  disabled={savingLevels}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {savingLevels && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save levels
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Restock: stores asks for its own shelf to be refilled */}
      <Modal
        isOpen={Boolean(restockFor)}
        onClose={() => setRestockFor(null)}
        title="Request a restock"
      >
        {restockFor && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
              <p className="font-medium text-gray-900">{restockFor.item?.name}</p>
              <p className="text-gray-600">
                {restockFor.quantityOnHand || 0} {restockFor.item?.unit || 'each'} on hand at {restockFor.site?.name || 'this site'},
                reorder level {levelOf(restockFor).level}.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to order</label>
              <input
                type="number"
                min="1"
                value={restockQty}
                onChange={(e: any) => setRestockQty(e.target.value)}
                className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="ml-2 text-sm text-gray-500">{restockFor.item?.unit || 'each'}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <CategorySelect
                value={restockCategory}
                onChange={setRestockCategory}
                placeholder="Choose the supplier category"
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note for the approver <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={restockNote}
                onChange={(e: any) => setRestockNote(e.target.value)}
                placeholder="Leave blank to say how low it is"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>
            <p className="text-xs text-gray-500">
              It goes to your department head for approval, then to procurement to buy. When it is delivered it goes
              straight into stock here; nobody needs to collect it.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestockFor(null)}
                className="px-3 py-2 text-sm border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRestock}
                disabled={restocking}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {restocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Request restock
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Import drawer */}
      <Drawer
        isOpen={showImportModal}
        onClose={resetImport}
        title="Bulk Import Inventory"
        size="xl"
        footer={
          <>
            <button
              onClick={resetImport}
              className="px-3 py-[7px] text-sm border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {importResult ? 'Close' : 'Cancel'}
            </button>
            {!importResult && (
              <button
                onClick={doImport}
                disabled={importing || importRows.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import {importRows.length > 0 ? `${importRows.length} rows` : ''}
              </button>
            )}
          </>
        }
      >
        <FormSteps steps={IMPORT_STEPS} current={importResult ? 2 : importRows.length > 0 ? 1 : 0} variant="track" />
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
                  <div className="overflow-x-auto max-h-56 overflow-y-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Name</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Category</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 50).map((r: any, i: number) => (
                          <tr key={i} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                            <td className="py-2 px-3 border-b border-gray-100 text-gray-900">{r.name || r.code}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-gray-500">{r.category || '—'}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-gray-500">{r.unit || 'each'}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-right text-gray-900">{r.quantity ?? '—'}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-right text-gray-900">{r.unitPrice ?? '—'}</td>
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
                <div className="overflow-x-auto max-h-40 overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Row</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.results
                        .filter((r: any) => r.status === 'failed')
                        .map((r: any, i: number) => (
                          <tr key={i} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                            <td className="py-2 px-3 border-b border-gray-100 text-gray-700">Row {r.row}: {r.name}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-red-600">{r.message}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </Drawer>
    </div>
  );
}

