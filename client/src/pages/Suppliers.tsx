import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import Tabs from '../components/Tabs';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { CategoryMultiSelect } from '../components/CategorySelect';
import { getCategoryName } from '../lib/constants';
import { 
  Search, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock,
  Building2,
  Mail,
  Phone,
  Loader2,
  Users,
  Eye,
  EyeOff,
  Upload,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import {
  parseSupplierFile,
  parsePastedText,
  rowIssues,
  type SupplierImportRow
} from '../lib/supplierImport';

const statusColors: any = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-gray-100 text-gray-700',
  blacklisted: 'bg-red-100 text-red-700',
  dormant: 'bg-gray-100 text-gray-700'
};

const statusIcons: any = {
  pending: Clock,
  active: CheckCircle,
  suspended: XCircle,
  blacklisted: XCircle,
  dormant: Clock
};

function needsKysAttention(supplier: any): boolean {
  return supplier.status === 'pending' || (!supplier.kysComplete && !supplier.kysExempt);
}

function supplierProfilePath(supplier: any): string {
  const id = supplier._id;
  return needsKysAttention(supplier)
    ? `/app/suppliers/${id}?tab=documents`
    : `/app/suppliers/${id}`;
}

function kysStatus(supplier: any): { label: string; className: string } {
  if (supplier.kysExempt) {
    return { label: 'Exempt', className: 'bg-slate-100 text-slate-600 ring-slate-200/80' };
  }
  if (supplier.kysComplete) {
    return { label: 'Verified', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' };
  }
  return { label: 'Pending', className: 'bg-amber-50 text-amber-800 ring-amber-600/10' };
}

export default function Suppliers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [search, setSearch] = useState<any>('');
  const [statusFilter, setStatusFilter] = useState<any>(() => {
    const fromUrl = searchParams.get('status');
    if (fromUrl) return fromUrl;
    if (searchParams.get('kys') === 'pending') return 'pending';
    return '';
  });
  const [showAddModal, setShowAddModal] = useState<any>(false);
  const [submitting, setSubmitting] = useState<any>(false);
  const [formData, setFormData] = useState<any>({
    companyName: '',
    tradingAs: '',
    registrationNumber: '',
    taxNumber: '',
    vatNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    password: 'password',
    phone: '',
    physicalAddress: '',
    city: '',
    province: '',
    postalCode: '',
    categories: [] as string[],
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankBranchCode: ''
  });
  const [showPassword, setShowPassword] = useState<any>(false);
  const [showOptionalFields, setShowOptionalFields] = useState<any>(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState<any>(false);
  const [bulkImportData, setBulkImportData] = useState<any>('');
  const [bulkImportResults, setBulkImportResults] = useState<any>(null);
  const [importing, setImporting] = useState<any>(false);
  // Parsed rows are held for review and correction before anything is written.
  const [importRows, setImportRows] = useState<SupplierImportRow[]>([]);
  const [importWarning, setImportWarning] = useState<string>('');
  const [importFileName, setImportFileName] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const importFileInput = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyPagination());

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [page, search, statusFilter]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await procurementAPI.getSuppliers({ 
        search, 
        status: statusFilter,
        page,
        limit: DEFAULT_PAGE_SIZE
      });
      setSuppliers(response.data.data);
      setPagination(parsePagination(response.data.pagination));
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSupplierProfile = (supplier: any) => {
    navigate(supplierProfilePath(supplier));
  };

  // Supplier detail, approval, status changes and blacklisting all live on the
  // SupplierDetails page (/app/suppliers/:id). This list navigates there rather
  // than duplicating those controls in a modal.

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.companyName || !formData.email || !formData.firstName || !formData.lastName || !formData.registrationNumber) {
      showToast('Company name, email, first name, last name, and registration number are required', 'error');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      setSubmitting(true);
      
      // Categories are stored as canonical category codes
      const categories: string[] = Array.isArray(formData.categories) ? formData.categories : [];

      const response = await procurementAPI.createSupplier({
        ...formData,
        categories
      });

      if (response.data.success) {
        showToast('Supplier created successfully', 'success');
        setShowAddModal(false);
        setFormData({
          companyName: '',
          tradingAs: '',
          registrationNumber: '',
          taxNumber: '',
          vatNumber: '',
          firstName: '',
          lastName: '',
          email: '',
          password: 'password',
          phone: '',
          physicalAddress: '',
          city: '',
          province: '',
          postalCode: '',
          categories: [] as string[],
          bankName: '',
          bankAccountName: '',
          bankAccountNumber: '',
          bankBranchCode: ''
        });
        setShowPassword(false);
        fetchSuppliers();
      }
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      showToast(
        error.response?.data?.message || 'Failed to create supplier',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Load rows from a file the user picked or dropped. */
  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    setImportWarning('');
    setImportFileName(file.name);
    try {
      const { rows, warning } = await parseSupplierFile(file);
      setImportRows(rows);
      if (warning) setImportWarning(warning);
      if (rows.length === 0 && !warning) {
        setImportWarning('No supplier rows found in this file. Check that the first row contains column headers.');
      }
    } catch (error: any) {
      setImportRows([]);
      setImportWarning('Could not read this file. Try saving it as .csv or .xlsx.');
    }
  };

  /** Load rows from the paste box. */
  const handleImportPaste = () => {
    setImportWarning('');
    setImportFileName('');
    const rows = parsePastedText(bulkImportData);
    if (rows.length === 0) {
      showToast('No supplier rows found. Paste JSON, or CSV with a header row.', 'error');
      return;
    }
    setImportRows(rows);
  };

  const updateImportCell = (index: number, field: keyof SupplierImportRow, value: string) => {
    setImportRows((prev: SupplierImportRow[]) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const resetImport = () => {
    setImportRows([]);
    setImportWarning('');
    setImportFileName('');
    setBulkImportData('');
    setBulkImportResults(null);
  };

  const handleBulkImport = async () => {
    if (importRows.length === 0) {
      showToast('Load a file or paste data first', 'error');
      return;
    }

    try {
      setImporting(true);
      const response = await procurementAPI.bulkImportSuppliers({ suppliers: importRows });

      if (response.data.success) {
        setBulkImportResults(response.data.data);
        showToast(`Imported ${response.data.data.success.length} suppliers successfully`, 'success');
        fetchSuppliers();
      }
    } catch (error: any) {
      console.error('Bulk import error:', error);
      showToast(
        error.response?.data?.message || 'Failed to import suppliers',
        'error'
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Suppliers"
        subtitle="Manage and view all registered suppliers"
        actions={
          <>
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-xl transition-colors"
            >
              <Upload className="h-5 w-5" />
              Bulk Import
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Supplier
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
          <Tabs
            className="w-full"
            tabs={[
              { value: '', label: 'All', icon: Users },
              { value: 'pending', label: 'Pending', icon: Clock },
              { value: 'active', label: 'Active', icon: CheckCircle },
              { value: 'suspended', label: 'Suspended', icon: XCircle },
              { value: 'blacklisted', label: 'Blacklisted', icon: XCircle }
            ]}
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
            variant="pills"
          />
        </div>
      </div>

      {/* Suppliers List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No suppliers found</h3>
            <p className="text-gray-500 mt-1">Get started by adding your first supplier</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Vendor status
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map((supplier: any) => {
                    const StatusIcon = statusIcons[supplier.status] || Clock;
                    const kys = kysStatus(supplier);
                    const kysPending = needsKysAttention(supplier);
                    const statusLabel =
                      supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1);

                    return (
                      <tr key={supplier._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 min-w-0 max-w-md">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate" title={supplier.companyName}>
                                {supplier.companyName}
                              </p>
                              <p className="text-sm text-gray-500 truncate" title={supplier.registrationNumber}>
                                {supplier.registrationNumber || 'No registration no.'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 max-w-xs">
                            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="truncate" title={supplier.user?.email}>
                              {supplier.user?.email || '—'}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColors[supplier.status]}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                              {statusLabel}
                            </span>
                            <p className="text-xs text-gray-500">
                              KYS · <span className="font-medium text-gray-700">{kys.label}</span>
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openSupplierProfile(supplier)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title={
                              kysPending
                                ? 'View vendor profile & KYS documents'
                                : 'View vendor profile'
                            }
                            aria-label={
                              kysPending
                                ? 'View vendor profile and KYS documents'
                                : 'View vendor profile'
                            }
                          >
                            <Eye className="h-4 w-4 text-gray-500" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
            page={page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
            itemLabel="suppliers"
          />
          </>
        )}
      </div>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          if (!submitting) {
            setShowAddModal(false);
            setFormData({
              companyName: '',
              tradingAs: '',
              registrationNumber: '',
              taxNumber: '',
              vatNumber: '',
              firstName: '',
              lastName: '',
              email: '',
              password: 'password',
              phone: '',
              physicalAddress: '',
              city: '',
              province: '',
              postalCode: '',
              categories: [] as string[],
              bankName: '',
              bankAccountName: '',
              bankAccountNumber: '',
              bankBranchCode: ''
            });
            setShowPassword(false);
            setShowOptionalFields(false);
          }
        }}
        title="Add New Supplier"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Essential Fields - Always Visible */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Default: "password"</p>
            </div>
          </div>

          {/* Optional Fields - Collapsible */}
          <div className="border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full"
            >
              <span>{showOptionalFields ? '−' : '+'}</span>
              <span>Additional Information {showOptionalFields ? '(Hide)' : '(Show)'}</span>
            </button>

            {showOptionalFields && (
              <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Trading As</label>
                    <input
                      type="text"
                      name="tradingAs"
                      value={formData.tradingAs}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tax Number</label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={formData.taxNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">VAT Number</label>
                    <input
                      type="text"
                      name="vatNumber"
                      value={formData.vatNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Categories of Supply
                  </label>
                  <CategoryMultiSelect
                    value={Array.isArray(formData.categories) ? formData.categories : []}
                    onChange={(codes) => setFormData((prev: any) => ({ ...prev, categories: codes }))}
                    placeholder="Select categories this supplier provides…"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Used to match suppliers to RFQs by category.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    name="physicalAddress"
                    value={formData.physicalAddress}
                    onChange={handleInputChange}
                    placeholder="Street address"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none mb-2"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City"
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <input
                      type="text"
                      name="province"
                      value={formData.province}
                      onChange={handleInputChange}
                      placeholder="Province"
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      placeholder="Postal Code"
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
                    <input
                      type="text"
                      name="bankAccountName"
                      value={formData.bankAccountName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      name="bankAccountNumber"
                      value={formData.bankAccountNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Branch Code</label>
                    <input
                      type="text"
                      name="bankBranchCode"
                      value={formData.bankBranchCode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Supplier'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showBulkImportModal}
        onClose={() => {
          if (!importing) {
            setShowBulkImportModal(false);
            resetImport();
          }
        }}
        title="Bulk Import Suppliers"
        size="xl"
      >
        <div className="space-y-4">
          {!bulkImportResults ? (
            <>
              {importRows.length === 0 ? (
                <>
                  {/* Upload from the computer */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      handleImportFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      dragActive ? 'border-primary bg-primary/5' : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <FileSpreadsheet className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">
                      Drop a file here, or
                      <button
                        type="button"
                        onClick={() => importFileInput.current?.click()}
                        className="text-primary hover:underline ml-1"
                      >
                        browse your computer
                      </button>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Excel (.xlsx, .xls), CSV, JSON, or a legacy database dump (.sql)
                    </p>
                    <input
                      ref={importFileInput}
                      type="file"
                      accept=".csv,.xlsx,.xls,.json,.sql,.dump,.pdf"
                      className="hidden"
                      onChange={(e) => handleImportFile(e.target.files?.[0])}
                    />
                  </div>

                  {importWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">{importWarning}</p>
                    </div>
                  )}

                  {/* Or paste */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Or paste data (JSON, or CSV with a header row)
                    </label>
                    <textarea
                      value={bulkImportData}
                      onChange={(e: any) => setBulkImportData(e.target.value)}
                      placeholder={`companyName,registrationNumber,contactPerson,email,phone,categories
Company ABC,REG123,John Doe,john@company.com,0771234567,"MAINT-LV,IND-TOOLS"

Quote any cell containing a comma, e.g. "Smith, Jones & Co"`}
                      rows={6}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleImportPaste}
                      disabled={!bulkImportData.trim()}
                      className="mt-2 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Preview pasted data
                    </button>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800">
                        <p className="font-medium mb-1">Required: companyName, registrationNumber, contactPerson, email, phone</p>
                        <p>Column names are matched flexibly — "Supplier Name", "reg no" and "mobile" are all understood.</p>
                        <p className="mt-1">Categories accept canonical codes; older free-text values (e.g. "VEHICLE REPAIRS AND SPARES") are translated automatically where recognised. Imported suppliers start as <span className="font-medium">pending</span> and still need KYS before they can be awarded.</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Review grid — nothing is written until this is confirmed */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{importRows.length}</span> row(s) ready
                      {importFileName && <span className="text-gray-500"> from {importFileName}</span>}
                      {(() => {
                        const bad = importRows.filter((r) => rowIssues(r).length > 0).length;
                        return bad > 0 ? (
                          <span className="text-amber-700"> · {bad} need attention</span>
                        ) : null;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={resetImport}
                      className="text-xs text-gray-600 hover:text-gray-900 underline"
                    >
                      Choose a different file
                    </button>
                  </div>

                  {importWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">{importWarning}</p>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg overflow-auto max-h-[45vh]">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-2 font-semibold text-gray-600 w-8">#</th>
                          {(['companyName', 'registrationNumber', 'contactPerson', 'email', 'phone', 'categories'] as (keyof SupplierImportRow)[]).map((f) => (
                            <th key={f} className="text-left py-2 px-2 font-semibold text-gray-600">
                              {f === 'companyName' ? 'Company' :
                               f === 'registrationNumber' ? 'Reg no' :
                               f === 'contactPerson' ? 'Contact' :
                               f === 'categories' ? 'Categories' :
                               f.charAt(0).toUpperCase() + f.slice(1)}
                              <span className="text-red-500 ml-0.5">{f === 'categories' ? '' : '*'}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importRows.map((row, i) => {
                          const issues = rowIssues(row);
                          return (
                            <tr key={i} className={issues.length > 0 ? 'bg-amber-50/50' : ''}>
                              <td className="py-1 px-2 text-gray-400">{i + 1}</td>
                              {(['companyName', 'registrationNumber', 'contactPerson', 'email', 'phone', 'categories'] as (keyof SupplierImportRow)[]).map((f) => (
                                <td key={f} className="py-1 px-1">
                                  <input
                                    value={row[f]}
                                    onChange={(e) => updateImportCell(i, f, e.target.value)}
                                    className={`w-full px-1.5 py-1 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-primary ${
                                      issues.includes(f as any) ? 'border-amber-400 bg-amber-50' : 'border-transparent hover:border-gray-200'
                                    }`}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-gray-500">
                    Highlighted cells are missing a required value — those rows will be rejected. Edit them here, or import and fix the rest afterwards.
                  </p>
                </>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    resetImport();
                  }}
                  disabled={importing}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={importing || importRows.length === 0}
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import {importRows.length > 0 ? `${importRows.length} Supplier(s)` : 'Suppliers'}
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">
                    Import Complete: {bulkImportResults.success.length} successful
                  </h3>
                </div>
                {bulkImportResults.failed.length > 0 && (
                  <p className="text-sm text-green-800">
                    {bulkImportResults.failed.length} failed
                  </p>
                )}
              </div>

              {bulkImportResults.success.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Successfully Imported:</h4>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Company</th>
                          <th className="px-3 py-2 text-left">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bulkImportResults.success.map((item: any, idx: any) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{item.companyName}</td>
                            <td className="px-3 py-2">{item.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {bulkImportResults.failed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-900 mb-2">Failed:</h4>
                  <div className="max-h-40 overflow-y-auto border border-red-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Company</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {bulkImportResults.failed.map((item: any, idx: any) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{item.companyName}</td>
                            <td className="px-3 py-2">{item.email}</td>
                            <td className="px-3 py-2 text-red-600">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setBulkImportData('');
                    setBulkImportResults(null);
                  }}
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}

