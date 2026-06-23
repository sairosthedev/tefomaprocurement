import React, { useState, useEffect } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';

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
  const [showViewModal, setShowViewModal] = useState<any>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [selectedSupplierTab, setSelectedSupplierTab] = useState<any>('overview');
  const [supplierEvaluations, setSupplierEvaluations] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<any>(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [actionReason, setActionReason] = useState<any>('');
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

  const closeViewModal = () => {
    if (actionLoading) return;
    setShowViewModal(false);
    setSelectedSupplier(null);
    setSelectedSupplierTab('overview');
    setSupplierEvaluations([]);
    setPendingAction(null);
    setActionReason('');
  };

  const refreshSelected = (updated: any) => {
    setSelectedSupplier(updated);
    setSuppliers((prev: any[]) =>
      prev.map((s: any) => (s._id === updated._id ? { ...s, ...updated } : s))
    );
  };

  const runApprove = async (overrideKys = false) => {
    if (!selectedSupplier) return;
    if (overrideKys && !actionReason.trim()) {
      showToast('A reason is required to activate without KYS', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const res = await procurementAPI.approveSupplier(selectedSupplier._id, {
        overrideKys,
        reason: overrideKys ? actionReason.trim() : undefined
      });
      showToast(
        overrideKys ? 'Supplier activated without KYS (override applied)' : 'Supplier approved',
        'success'
      );
      refreshSelected(res.data.data);
      setPendingAction(null);
      setActionReason('');
    } catch (error: any) {
      if (error.response?.data?.data?.requiresKys) {
        showToast('KYS documents are incomplete. Complete KYS or use the override option.', 'error');
        return;
      }
      showToast(error.response?.data?.message || 'Failed to approve supplier', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const startApprove = (supplier: any) => {
    if (supplier?.kysComplete || supplier?.kysExempt) {
      setPendingAction('approve');
      return;
    }
    showToast('Complete KYS first, or use Activate without KYS if this supplier is exempt.', 'error');
    navigate(`/app/suppliers/${supplier._id}?tab=documents`);
  };

  const startApproveOverride = () => {
    setActionReason('');
    setPendingAction('approveOverride');
  };

  const runSetStatus = async (status: string) => {
    if (!selectedSupplier) return;
    try {
      setActionLoading(true);
      const res = await procurementAPI.setSupplierStatus(selectedSupplier._id, {
        status,
        reason: actionReason || undefined
      });
      showToast(res.data.message || 'Supplier status updated', 'success');
      refreshSelected(res.data.data);
      setPendingAction(null);
      setActionReason('');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update supplier', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const runBlacklist = async () => {
    if (!selectedSupplier) return;
    if (!actionReason.trim()) {
      showToast('A reason is required to blacklist a supplier', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const res = await procurementAPI.blacklistSupplier(selectedSupplier._id, {
        reason: actionReason
      });
      showToast('Supplier blacklisted', 'success');
      refreshSelected(res.data.data);
      setPendingAction(null);
      setActionReason('');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to blacklist supplier', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPendingAction = () => {
    if (pendingAction === 'suspend') return runSetStatus('suspended');
    if (pendingAction === 'reactivate') return runSetStatus('active');
    if (pendingAction === 'dormant') return runSetStatus('dormant');
    if (pendingAction === 'blacklist') return runBlacklist();
    if (pendingAction === 'approve') return runApprove(false);
    if (pendingAction === 'approveOverride') return runApprove(true);
  };

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

  const handleBulkImport = async () => {
    if (!bulkImportData.trim()) {
      showToast('Please provide supplier data', 'error');
      return;
    }

    try {
      setImporting(true);
      let suppliers: any[] = [];

      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(bulkImportData);
        suppliers = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e: any) {
        // If not JSON, try to parse as CSV-like format
        const lines = bulkImportData.trim().split('\n');
        if (lines.length < 2) {
          showToast('Invalid data format. Please provide JSON array or CSV with headers', 'error');
          return;
        }
        
        const headers = lines[0].split(',').map((h: any) => h.trim().toLowerCase().replace(/\s+/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map((v: any) => v.trim());
          const supplier: any = {};
          headers.forEach((header: any, index: any) => {
            supplier[header] = values[index] || '';
          });
          
          // Map CSV headers to API fields
          suppliers.push({
            companyName: supplier.companyname || supplier.company || '',
            tradingAs: supplier.tradingas || supplier.trading || '',
            registrationNumber: supplier.registrationnumber || supplier.regnumber || '',
            taxNumber: supplier.taxnumber || supplier.tax || '',
            vatNumber: supplier.vatnumber || supplier.vat || '',
            contactPerson: supplier.contactperson || supplier.contact || supplier.name || '',
            email: supplier.email || '',
            phone: supplier.phone || '',
            physicalAddress: supplier.address || supplier.physicaladdress || '',
            city: supplier.city || '',
            province: supplier.province || '',
            postalCode: supplier.postalcode || supplier.postcode || '',
            categories: supplier.categories || supplier.category || '',
            bankName: supplier.bankname || supplier.bank || '',
            bankAccountName: supplier.accountname || supplier.bankaccountname || '',
            bankAccountNumber: supplier.accountnumber || supplier.bankaccountnumber || '',
            bankBranchCode: supplier.branchcode || supplier.branch || ''
          });
        }
      }

      if (suppliers.length === 0) {
        showToast('No valid supplier data found', 'error');
        return;
      }

      const response = await procurementAPI.bulkImportSuppliers({ suppliers });
      
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
            setBulkImportData('');
            setBulkImportResults(null);
          }
        }}
        title="Bulk Import Suppliers"
        size="lg"
      >
        <div className="space-y-4">
          {!bulkImportResults ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Data (JSON or CSV format)
                </label>
                <textarea
                  value={bulkImportData}
                  onChange={(e: any) => setBulkImportData(e.target.value)}
                  placeholder={`JSON Format:
[
  {
    "companyName": "Company ABC",
    "registrationNumber": "REG123",
    "contactPerson": "John Doe",
    "email": "john@company.com",
    "phone": "1234567890"
  }
]

Or CSV Format (first line headers):
companyName,registrationNumber,contactPerson,email,phone
Company ABC,REG123,John Doe,john@company.com,1234567890`}
                  rows={12}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium mb-1">Required fields: companyName, registrationNumber, contactPerson, email</p>
                    <p>Optional fields: tradingAs, taxNumber, vatNumber, phone, physicalAddress, city, province, postalCode, categories, bankName, bankAccountName, bankAccountNumber, bankBranchCode</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkImportModal(false);
                    setBulkImportData('');
                  }}
                  disabled={importing}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={importing || !bulkImportData.trim()}
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
                      Import Suppliers
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

      {/* Supplier Detail / Actions Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={closeViewModal}
        title="Supplier Details"
        size="xl"
      >
        {selectedSupplier && (() => {
          const s = selectedSupplier;
          const StatusIcon = statusIcons[s.status] || Clock;
          const checklist = s.kysChecklist || {};
          const checklistKeys = Object.keys(checklist).filter(
            (k: string) => typeof checklist[k] === 'boolean'
          );
          const ticked = checklistKeys.filter((k: string) => checklist[k]).length;
          const docCount = Array.isArray(s.complianceDocuments) ? s.complianceDocuments.length : 0;
          const evaluationCount = Array.isArray(supplierEvaluations) ? supplierEvaluations.length : 0;
          const addressParts = [
            s.address?.street || s.physicalAddress,
            s.address?.city || s.city,
            s.address?.province || s.province,
            s.address?.postalCode || s.postalCode,
            s.address?.country
          ].filter(Boolean);
          const bankDetails = s.bankDetails || s.bankingDetails || {};
          const contactPeople = Array.isArray(s.contactPersons) ? s.contactPersons : [];
          const references = Array.isArray(s.clientReferrals) ? s.clientReferrals : [];
          const documents = Array.isArray(s.complianceDocuments) ? s.complianceDocuments : [];
          const latestEvaluation = supplierEvaluations?.[0];
          const performanceScore = latestEvaluation?.overallScore > 0
            ? `${latestEvaluation.overallScore}/5`
            : '—';
          const kysLabel = s.kysExempt ? 'Exempt' : s.kysComplete ? 'Verified' : 'Pending';

          const detailTabs = [
            { value: 'overview', label: 'Overview' },
            { value: 'verification', label: 'Verification' },
            { value: 'corporate', label: 'Corporate' },
            { value: 'banking', label: 'Banking' },
            { value: 'trade', label: 'Trade' },
            { value: 'directors', label: 'Directors', count: contactPeople.length },
            { value: 'references', label: 'References', count: references.length },
            { value: 'documents', label: 'Documents', count: docCount },
            { value: 'performance', label: 'Performance', count: evaluationCount }
          ];

          const renderKeyValue = (label: string, value: any) => (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-gray-900">{value || '-'}</p>
            </div>
          );

          return (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{s.companyName}</p>
                    {s.tradingAs && <p className="text-sm text-gray-500">Trading as {s.tradingAs}</p>}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColors[s.status]}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500">Performance score</p>
                  <p className="text-2xl font-bold text-gray-900">{performanceScore}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500">KYS status</p>
                  <p className="text-2xl font-bold text-gray-900">{kysLabel}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500">Documents</p>
                  <p className="text-2xl font-bold text-gray-900">{docCount}</p>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                  <p className="text-xs text-gray-500">Evaluations</p>
                  <p className="text-2xl font-bold text-gray-900">{evaluationCount}</p>
                </div>
              </div>

              <Tabs
                tabs={detailTabs}
                activeTab={selectedSupplierTab}
                onTabChange={setSelectedSupplierTab}
                variant="pills"
              />

              {selectedSupplierTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {renderKeyValue('Registration No.', s.registrationNumber)}
                    {renderKeyValue('Tax / VAT', `${s.taxNumber || '-'}${s.vatNumber ? ` / ${s.vatNumber}` : ''}`)}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact</p>
                      <p className="text-gray-900 flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" />{s.user?.email || s.email || '-'}</p>
                      <p className="text-gray-900 flex items-center gap-2 mt-1"><Phone className="h-4 w-4 text-gray-400" />{s.user?.phone || s.phone || '-'}</p>
                    </div>
                    {renderKeyValue('Address', addressParts.join(', '))}
                    {renderKeyValue('Bank', `${bankDetails.bankName || s.bankName || '-'}${bankDetails.accountNumber || s.bankAccountNumber ? ` · ${bankDetails.accountNumber || s.bankAccountNumber}` : ''}`)}
                    {renderKeyValue('Registered', new Date(s.createdAt).toLocaleDateString('en-ZA'))}
                    {renderKeyValue('Supplier Status', s.status.charAt(0).toUpperCase() + s.status.slice(1))}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.categories?.length ? (
                        s.categories.map((cat: any, idx: any) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600" title={cat}>
                            {getCategoryName(cat)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">No categories</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedSupplierTab === 'verification' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {s.kysExempt
                            ? 'KYS Exempt (override applied)'
                            : s.kysComplete
                              ? 'KYS Verified'
                              : 'KYS Incomplete'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.kysExempt && s.kysExemptReason
                            ? s.kysExemptReason
                            : `${ticked}/${checklistKeys.length} checklist items complete · ${docCount} document${docCount === 1 ? '' : 's'}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/app/suppliers/${s._id}?tab=documents`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Open KYS
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    {renderKeyValue('Required Checklist Items', checklistKeys.length)}
                    {renderKeyValue('Completed Items', ticked)}
                    {renderKeyValue('Documents Uploaded', docCount)}
                  </div>
                  {s.kysExempt && s.kysExemptReason && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                      <span className="font-medium">KYS override: </span>{s.kysExemptReason}
                    </div>
                  )}
                </div>
              )}

              {selectedSupplierTab === 'corporate' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {renderKeyValue('Legal Name', s.companyName)}
                  {renderKeyValue('Trading Name', s.tradingAs || s.tradingName)}
                  {renderKeyValue('Incorporation', s.incorporationDate ? new Date(s.incorporationDate).toLocaleDateString('en-ZA') : 'Not captured in this system')}
                  {renderKeyValue('Country', s.address?.country || 'Zimbabwe')}
                  {renderKeyValue('Website', s.website || 'Not captured in this system')}
                  {renderKeyValue('Department', s.department?.name || s.department || 'Not captured in this system')}
                  {renderKeyValue('Services / Products', s.businessDescription || s.notes || s.categories?.map((cat: string) => getCategoryName(cat)).join(', ') || 'Not captured in this system')}
                  {renderKeyValue('Primary Contact', s.contactPerson || `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim() || 'Not captured in this system')}
                </div>
              )}

              {selectedSupplierTab === 'banking' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {renderKeyValue('Bank Name', bankDetails.bankName || s.bankName)}
                  {renderKeyValue('Account Name', bankDetails.accountName || s.bankAccountName)}
                  {renderKeyValue('Account Number', bankDetails.accountNumber || s.bankAccountNumber)}
                  {renderKeyValue('Branch Code', bankDetails.branchCode || s.bankBranchCode)}
                  {renderKeyValue('Account Type', bankDetails.accountType || 'Not captured in this system')}
                </div>
              )}

              {selectedSupplierTab === 'trade' && (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderKeyValue('Proposed Business', s.proposedBusiness || 'Not captured in this system')}
                    {renderKeyValue('Volume / Quantity', s.tradeVolume || 'Not captured in this system')}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Products / Goods</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.tradeProducts?.length ? (
                        s.tradeProducts.map((item: any, idx: any) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">{item}</span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">Not captured in this system</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">Trade details are mapped from the current supplier profile fields where available.</div>
                </div>
              )}

              {selectedSupplierTab === 'directors' && (
                <div className="space-y-3 text-sm">
                  {contactPeople.length > 0 ? (
                    contactPeople.map((person: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-gray-50 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{person.name}</p>
                          <p className="text-xs text-gray-500">{person.position || 'Director / contact role not captured'}</p>
                          <p className="text-xs text-gray-500 mt-1">{person.email || '-'}</p>
                          <p className="text-xs text-gray-500">{person.phone || '-'}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                          {person.isPrimary ? 'Primary' : 'Member'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-gray-500">
                      No directors captured in the current supplier profile.
                    </div>
                  )}
                </div>
              )}

              {selectedSupplierTab === 'references' && (
                <div className="space-y-3 text-sm">
                  {references.length > 0 ? (
                    references.map((reference: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">{reference.clientName || reference.name || 'Reference'}</p>
                            <p className="text-xs text-gray-500">{reference.contactPerson || 'Contact not captured'}</p>
                            <p className="text-xs text-gray-500">{reference.contactEmail || reference.email || '-'}</p>
                            <p className="text-xs text-gray-500">{reference.contactPhone || reference.phone || '-'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-gray-500">
                      No trade references captured in the current supplier profile.
                    </div>
                  )}
                </div>
              )}

              {selectedSupplierTab === 'documents' && (
                <div className="space-y-3 text-sm">
                  {documents.length > 0 ? (
                    documents.map((document: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-gray-100 p-4 bg-gray-50 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{document.fileName || document.documentType || 'Document'}</p>
                          <p className="text-xs text-gray-500">{document.documentType || 'unknown type'}</p>
                          <p className="text-xs text-gray-500 mt-1">Uploaded {document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString('en-ZA') : 'date unavailable'}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${document.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {document.verified ? 'Verified' : 'Uploaded'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-gray-500">
                      No compliance documents captured yet.
                    </div>
                  )}
                </div>
              )}

              {selectedSupplierTab === 'performance' && (
                <div className="space-y-4 text-sm">
                  {latestEvaluation ? (
                    <div className="rounded-xl border border-gray-100 p-4 bg-gray-50 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">Latest Evaluation</p>
                          <p className="text-xs text-gray-500">{latestEvaluation.evaluationType} · {new Date(latestEvaluation.createdAt).toLocaleDateString('en-ZA')}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          {latestEvaluation.recommendation}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {Object.entries(latestEvaluation.scores || {})
                          .filter(([key]) => key !== 'otherNotes')
                          .map(([key, value]) => (
                            <div key={key} className="rounded-lg border border-gray-200 bg-white p-3">
                              <p className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                              <p className="text-lg font-semibold text-gray-900">{String(value)}</p>
                            </div>
                          ))}
                      </div>
                      {latestEvaluation.scores?.otherNotes && (
                        <div className="text-xs text-gray-600">Notes: {latestEvaluation.scores.otherNotes}</div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-gray-500">
                      No supplier evaluations captured yet.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {renderKeyValue('Total Evaluations', evaluationCount)}
                    {renderKeyValue('Last Evaluation', latestEvaluation ? new Date(latestEvaluation.createdAt).toLocaleDateString('en-ZA') : 'Not captured')}
                    {renderKeyValue('Next Review', latestEvaluation?.nextReviewDue ? new Date(latestEvaluation.nextReviewDue).toLocaleDateString('en-ZA') : 'Not captured')}
                  </div>
                </div>
              )}

              {s.kysExempt && s.kysExemptReason && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                  <span className="font-medium">KYS override: </span>{s.kysExemptReason}
                </div>
              )}

              {s.status === 'blacklisted' && s.blacklistReason && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  <span className="font-medium">Blacklist reason: </span>{s.blacklistReason}
                </div>
              )}

              {/* Reason input when an action needs confirmation */}
              {pendingAction && (
                <div className="p-4 border border-gray-200 rounded-xl space-y-3">
                  <p className="text-sm font-medium text-gray-900">
                    {pendingAction === 'suspend' && 'Suspend this supplier?'}
                    {pendingAction === 'reactivate' && 'Reactivate this supplier?'}
                    {pendingAction === 'dormant' && 'Mark this supplier as dormant?'}
                    {pendingAction === 'blacklist' && 'Blacklist this supplier?'}
                    {pendingAction === 'approve' && 'Approve and activate this supplier?'}
                    {pendingAction === 'approveOverride' && 'Activate this supplier without KYS?'}
                  </p>
                  {(pendingAction === 'suspend' || pendingAction === 'blacklist' || pendingAction === 'approveOverride') && (
                    <textarea
                      value={actionReason}
                      onChange={(e: any) => setActionReason(e.target.value)}
                      rows={3}
                      placeholder={
                        pendingAction === 'blacklist'
                          ? 'Reason for blacklisting (required)'
                          : pendingAction === 'approveOverride'
                            ? 'Reason for KYS override (required) — e.g. existing trusted supplier, one-off engagement'
                            : 'Reason for suspension (required)'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setPendingAction(null); setActionReason(''); }}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmPendingAction}
                      disabled={actionLoading || (pendingAction === 'approveOverride' && !actionReason.trim())}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                        pendingAction === 'blacklist'
                          ? 'bg-red-600 hover:bg-red-700'
                          : pendingAction === 'approveOverride'
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-primary hover:bg-primary/90'
                      }`}
                    >
                      {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!pendingAction && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                  {s.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => startApprove(s)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve & Activate
                      </button>
                      <button
                        type="button"
                        onClick={startApproveOverride}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Activate without KYS
                      </button>
                    </>
                  )}
                  {s.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => setPendingAction('suspend')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Suspend
                    </button>
                  )}
                  {(s.status === 'suspended' || s.status === 'dormant') && (
                    <button
                      type="button"
                      onClick={() => setPendingAction('reactivate')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Reactivate
                    </button>
                  )}
                  {s.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => setPendingAction('dormant')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Clock className="h-4 w-4" />
                      Mark Dormant
                    </button>
                  )}
                  {s.status !== 'blacklisted' && (
                    <button
                      type="button"
                      onClick={() => setPendingAction('blacklist')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Blacklist
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/app/suppliers/${s._id}?tab=documents`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 ml-auto"
                  >
                    <FileText className="h-4 w-4" />
                    Manage KYS
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

