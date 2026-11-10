import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { procurementAPI } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { isProcurementHead, validateNewSupplier, type FieldErrors } from '@fossil/shared';
import FilterSelect from '../components/FilterSelect';
import PageHeader from '../components/PageHeader';
import Modal, { ModalFooter } from '../components/Modal';
import Drawer from '../components/Drawer';
import { FormSteps, FormStepNav } from '../components/FormSteps';
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
  Copy,
  Upload,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import Pagination from '../components/Pagination';
import TableSkeleton from '../components/TableSkeleton';
import { DEFAULT_PAGE_SIZE, emptyPagination, parsePagination } from '../lib/pagination';
import {
  parseSupplierFile,
  parsePastedText,
  rowIssues,
  type SupplierImportRow
} from '../lib/supplierImport';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import FieldError from '../components/FieldError';
import { serverFieldErrors, useFormValidation } from '../lib/useFormValidation';
import {
  BUSINESS_TYPE_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  businessTypeLabel,
  entityTypeLabel,
  supplierStatusLabel
} from '../lib/supplierTypes';

const statusColors: any = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-gray-100 text-gray-700',
  blacklisted: 'bg-red-100 text-red-700',
  dormant: 'bg-gray-100 text-gray-700',
  rejected: 'bg-red-100 text-red-700'
};

const statusIcons: any = {
  pending: Clock,
  active: CheckCircle,
  suspended: XCircle,
  blacklisted: XCircle,
  dormant: Clock,
  rejected: XCircle
};

// Filter values that select by onboarding approval rather than by status;
// sent as `approval`, which getSuppliers reads.
const APPROVAL_FILTERS = ['awaiting', 'awaiting_me'];

const ADD_SUPPLIER_STEPS = [
  { label: 'Company & login', description: 'Who they are, and their sign-in' },
  { label: 'Business', description: 'Contact, tax and categories' },
  { label: 'Banking', description: 'First bank account' },
  { label: 'Review', description: 'Check, then create' }
];

/** The fields on each Add Supplier step: Next checks its own, and a problem found later opens its step. */
const ADD_STEP_FIELDS: string[][] = [
  ['companyName', 'registrationNumber', 'firstName', 'lastName', 'email', 'password'],
  ['tradingAs', 'phone', 'taxNumber', 'vatNumber', 'businessType', 'entityType', 'categories', 'physicalAddress', 'city', 'province', 'postalCode'],
  ['bankName', 'bankAccountName', 'bankAccountNumber', 'bankBranchCode'],
  []
];

/** The earliest Add Supplier step (0-based) holding one of these fields, or -1. */
function firstAddStepWith(errors: FieldErrors): number {
  const steps = Object.keys(errors)
    .map((field) => ADD_STEP_FIELDS.findIndex((fields) => fields.includes(field)))
    .filter((n) => n >= 0);
  return steps.length ? Math.min(...steps) : -1;
}

/** The import review grid's columns, with the longest value each accepts. */
const IMPORT_GRID_FIELDS: { field: keyof SupplierImportRow; maxLength?: number }[] = [
  { field: 'companyName', maxLength: 200 },
  { field: 'registrationNumber', maxLength: 50 },
  { field: 'contactPerson', maxLength: 120 },
  { field: 'email', maxLength: 254 },
  { field: 'phone', maxLength: 30 },
  { field: 'categories' }
];

const EMPTY_SUPPLIER_FORM = {
  companyName: '',
  tradingAs: '',
  registrationNumber: '',
  taxNumber: '',
  vatNumber: '',
  // Optional; empty is sent as "not specified".
  businessType: '',
  entityType: '',
  firstName: '',
  lastName: '',
  email: '',
  // Blank means the server generates a random one; there is no shared default.
  password: '',
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
  const { user } = useAuth();
  // The COO and admins read the supplier base; only procurement maintains it.
  const canManage = user?.role === 'procurement_officer' || isProcurementHead(user);
  // The Head of Procurement and the COO approve activations.
  const canDecide = user?.role === 'coo' || isProcurementHead(user);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState<any>(true);
  const [searchInput, setSearch] = useState<any>('');
  // The box shows what's typed; the list is fetched once typing pauses.
  const search = useDebouncedValue(searchInput);
  const [statusFilter, setStatusFilter] = useState<any>(() => {
    // The dashboard's "awaiting your activation approval" links here.
    const approval = searchParams.get('approval');
    if (approval && APPROVAL_FILTERS.includes(approval)) return approval;
    const fromUrl = searchParams.get('status');
    if (fromUrl) return fromUrl;
    if (searchParams.get('kys') === 'pending') return 'pending';
    return '';
  });
  const [showAddModal, setShowAddModal] = useState<any>(false);
  const [submitting, setSubmitting] = useState<any>(false);
  const [formData, setFormData] = useState<any>(EMPTY_SUPPLIER_FORM);
  const [showPassword, setShowPassword] = useState<any>(false);
  const [addStep, setAddStep] = useState(0);
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
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(emptyPagination());
  // A generated login, shown to the creator once after Add Supplier.
  const [createdCredentials, setCreatedCredentials] = useState<{
    id: string;
    companyName: string;
    email: string;
    password: string;
  } | null>(null);

  // One effect for filters and paging. With a separate "reset to page 1"
  // effect, a filter change on page 3 fetched twice: once with the stale page,
  // then again after the reset.
  const filterKey = JSON.stringify([search, statusFilter]);
  const lastFilterKey = useRef(filterKey);
  // StrictMode mounts effects twice in development; the repeat of a request
  // that is already in flight is skipped rather than sent again.
  const inFlightKey = useRef<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    const key = JSON.stringify([filterKey, page, limit]);
    if (inFlightKey.current === key) return;
    inFlightKey.current = key;
    fetchSuppliers().finally(() => {
      if (inFlightKey.current === key) inFlightKey.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filterKey]);

  const fetchSuppliers = async () => {
    // Only the latest request may update the list, so a slow earlier response
    // cannot overwrite a newer one.
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      const byApproval = APPROVAL_FILTERS.includes(statusFilter);
      const response = await procurementAPI.getSuppliers({
        search,
        status: byApproval ? '' : statusFilter,
        approval: byApproval ? statusFilter : undefined,
        page,
        limit
      });
      if (seq !== requestSeq.current) return;
      setSuppliers(response.data.data);
      setPagination(parsePagination(response.data.pagination));
    } catch (error: any) {
      if (seq !== requestSeq.current) return;
      console.error('Error fetching suppliers:', error);
      showToast(error.response?.data?.message || 'Could not load suppliers', 'error');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
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

  // Next checks the step on screen (the first holds every required field);
  // Create, on the review step, checks them all.
  const addValidation = useFormValidation((values: any) => {
    const errors = validateNewSupplier(values);
    if (addStep >= ADD_SUPPLIER_STEPS.length - 1) return errors;
    const fields = ADD_STEP_FIELDS[addStep];
    return Object.fromEntries(Object.entries(errors).filter(([field]) => fields.includes(field)));
  }, formData);

  const openAddModal = () => {
    addValidation.reset();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setShowAddModal(false);
    setFormData(EMPTY_SUPPLIER_FORM);
    setShowPassword(false);
    setAddStep(0);
    addValidation.reset();
  };

  const goToAddStep = (next: number) => {
    addValidation.reset();
    setAddStep(next);
  };

  const nextAddStep = () => {
    if (!addValidation.check()) return;
    goToAddStep(Math.min(ADD_SUPPLIER_STEPS.length - 1, addStep + 1));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    // Enter in a field on an earlier step moves on rather than creating.
    if (addStep < ADD_SUPPLIER_STEPS.length - 1) {
      nextAddStep();
      return;
    }

    if (!addValidation.check()) {
      // Open the step holding the first problem; its messages show there.
      const target = firstAddStepWith(validateNewSupplier(formData));
      if (target >= 0) setAddStep(target);
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
        showToast('Supplier created — complete KYS to activate them', 'success');
        setShowAddModal(false);
        setFormData(EMPTY_SUPPLIER_FORM);
        setShowPassword(false);
        setAddStep(0);
        const created = response.data.data;
        const newId = created?.id;
        // A generated password exists nowhere else the creator can see, so it
        // is shown once before moving on.
        if (newId && created?.passwordGenerated && created?.password) {
          setCreatedCredentials({
            id: String(newId),
            companyName: created.companyName,
            email: created.email,
            password: created.password
          });
          return;
        }
        if (newId) {
          // KYS is the new supplier's next step.
          navigate(`/app/suppliers/${newId}?tab=documents`);
          return;
        }
        fetchSuppliers();
      }
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      const fields = serverFieldErrors(error);
      const target = fields ? firstAddStepWith(fields) : -1;
      if (target >= 0 && addValidation.fromServer(error)) {
        setAddStep(target);
      } else {
        showToast(
          error.response?.data?.message || 'Failed to create supplier',
          'error'
        );
      }
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
        bottomSpacing="mb-4"
      />

      {/* Filters */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {canManage && (
            <>
              <button
                type="button"
                onClick={openAddModal}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add Supplier
              </button>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4" />
                Bulk Import
              </button>
            </>
          )}
          {/* Pushed to the right edge, with or without the button beside it. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:ml-auto">
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Name, code or reg no..."
                value={searchInput}
                onChange={(e: any) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <FilterSelect
              size="sm"
              label="Status"
              options={[
                { value: '', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'awaiting', label: 'Awaiting approval' },
                ...(canDecide ? [{ value: 'awaiting_me', label: 'Awaiting my approval' }] : []),
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'blacklisted', label: 'Blacklisted' },
                { value: 'rejected', label: 'Rejected' }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
      </div>

      {/* Suppliers List */}
      <div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">
                    Supplier
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">
                    Contact
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">
                    Vendor status
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
            {loading ? (
              <TableSkeleton cols={4} />
            ) : suppliers.length === 0 ? (
              <tbody><tr><td colSpan={4} className="text-center py-12 text-gray-500">
                <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">No suppliers found</p>
                <p className="mt-1">Get started by adding your first supplier</p>
              </td></tr></tbody>
            ) : (
                <tbody>
                  {suppliers.map((supplier: any) => {
                    const StatusIcon = statusIcons[supplier.status] || Clock;
                    const kys = kysStatus(supplier);
                    const kysPending = needsKysAttention(supplier);
                    const statusLabel = supplierStatusLabel(supplier);
                    const identifiers = [supplier.supplierCode, supplier.registrationNumber || 'No registration no.']
                      .filter(Boolean)
                      .join(' · ');

                    return (
                      <tr key={supplier._id} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100">
                          <div className="flex items-center gap-3 min-w-0 max-w-md">
                            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate" title={supplier.companyName}>
                                {supplier.companyName}
                              </p>
                              <p className="text-sm text-gray-500 truncate" title={identifiers}>
                                {identifiers}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-3 border-b border-gray-100">
                          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 max-w-xs">
                            <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="truncate" title={supplier.user?.email}>
                              {supplier.user?.email || '—'}
                            </span>
                          </div>
                        </td>

                        <td className="py-2 px-3 border-b border-gray-100">
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

                        <td className="py-2 px-3 border-b border-gray-100 text-right">
                          <button
                            type="button"
                            onClick={() => openSupplierProfile(supplier)}
                            className="px-2 py-1 text-xs border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors"
                          >
                            View
                          </button>
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
          itemLabel="suppliers"
        />}
      </div>

      {/* Add Supplier drawer */}
      <Drawer
        isOpen={showAddModal}
        onClose={closeAddModal}
        title="Add New Supplier"
        size="xl"
      >
        <form ref={addValidation.formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormSteps steps={ADD_SUPPLIER_STEPS} current={addStep} onSelect={goToAddStep} />

          {addStep === 0 && (
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  maxLength={200}
                  {...addValidation.invalid('companyName')}
                />
                <FieldError message={addValidation.errors.companyName} />
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  maxLength={50}
                  {...addValidation.invalid('registrationNumber')}
                />
                <FieldError message={addValidation.errors.registrationNumber} />
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  maxLength={120}
                  {...addValidation.invalid('firstName')}
                />
                <FieldError message={addValidation.errors.firstName} />
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  maxLength={120}
                  {...addValidation.invalid('lastName')}
                />
                <FieldError message={addValidation.errors.lastName} />
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
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                maxLength={254}
                {...addValidation.invalid('email')}
              />
              <FieldError message={addValidation.errors.email} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                  placeholder="Leave blank to generate one"
                  className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  {...addValidation.invalid('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <FieldError message={addValidation.errors.password} />
              <p className="text-xs text-gray-500 mt-0.5">Leave blank to generate one. It is shown to you once and emailed to the supplier.</p>
            </div>
          </div>
          )}

          {addStep === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">All optional. They can be completed later on the supplier's profile.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Trading As</label>
                    <input
                      type="text"
                      name="tradingAs"
                      value={formData.tradingAs}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      maxLength={200}
                      {...addValidation.invalid('tradingAs')}
                    />
                    <FieldError message={addValidation.errors.tradingAs} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      maxLength={30}
                      {...addValidation.invalid('phone')}
                    />
                    <FieldError message={addValidation.errors.phone} />
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
                      maxLength={50}
                      {...addValidation.invalid('taxNumber')}
                    />
                    <FieldError message={addValidation.errors.taxNumber} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">VAT Number</label>
                    <input
                      type="text"
                      name="vatNumber"
                      value={formData.vatNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      maxLength={50}
                      {...addValidation.invalid('vatNumber')}
                    />
                    <FieldError message={addValidation.errors.vatNumber} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Business Type</label>
                    <select
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                      {...addValidation.invalid('businessType')}
                    >
                      <option value="">Not specified</option>
                      {BUSINESS_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <FieldError message={addValidation.errors.businessType} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
                    <select
                      name="entityType"
                      value={formData.entityType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
                      {...addValidation.invalid('entityType')}
                    >
                      <option value="">Not specified</option>
                      {ENTITY_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <FieldError message={addValidation.errors.entityType} />
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
                    invalid={!!addValidation.errors.categories}
                  />
                  <FieldError message={addValidation.errors.categories} />
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
                    maxLength={200}
                    {...addValidation.invalid('physicalAddress')}
                  />
                  <FieldError message={addValidation.errors.physicalAddress} />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="City"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        maxLength={80}
                        {...addValidation.invalid('city')}
                      />
                      <FieldError message={addValidation.errors.city} />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="province"
                        value={formData.province}
                        onChange={handleInputChange}
                        placeholder="Province"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        maxLength={80}
                        {...addValidation.invalid('province')}
                      />
                      <FieldError message={addValidation.errors.province} />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                        placeholder="Postal Code"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        maxLength={20}
                        {...addValidation.invalid('postalCode')}
                      />
                      <FieldError message={addValidation.errors.postalCode} />
                    </div>
                  </div>
                </div>
              </div>
          )}

          {addStep === 2 && (
                <div className="space-y-3">
                <p className="text-xs text-gray-500">Optional. Bank details entered here are the supplier's first account; later changes go through bank-change approval.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      maxLength={120}
                      {...addValidation.invalid('bankName')}
                    />
                    <FieldError message={addValidation.errors.bankName} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
                    <input
                      type="text"
                      name="bankAccountName"
                      value={formData.bankAccountName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      maxLength={200}
                      {...addValidation.invalid('bankAccountName')}
                    />
                    <FieldError message={addValidation.errors.bankAccountName} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      name="bankAccountNumber"
                      value={formData.bankAccountNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      maxLength={42}
                      {...addValidation.invalid('bankAccountNumber')}
                    />
                    <FieldError message={addValidation.errors.bankAccountNumber} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Branch Code</label>
                    <input
                      type="text"
                      name="bankBranchCode"
                      value={formData.bankBranchCode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      maxLength={40}
                      {...addValidation.invalid('bankBranchCode')}
                    />
                    <FieldError message={addValidation.errors.bankBranchCode} />
                  </div>
                </div>
                </div>
          )}

          {addStep === 3 && (
            <div className="space-y-3 text-sm">
              {[
                {
                  title: 'Company & login',
                  step: 0,
                  rows: [
                    ['Company', formData.companyName],
                    ['Registration no.', formData.registrationNumber],
                    ['Contact', `${formData.firstName} ${formData.lastName}`.trim()],
                    ['Email', formData.email]
                  ]
                },
                {
                  title: 'Business details',
                  step: 1,
                  rows: [
                    ['Trading as', formData.tradingAs],
                    ['Phone', formData.phone],
                    ['Tax / VAT', [formData.taxNumber, formData.vatNumber].filter(Boolean).join(' / ')],
                    ['Business / entity', [businessTypeLabel(formData.businessType), entityTypeLabel(formData.entityType)].filter(Boolean).join(' / ')],
                    ['Categories', (formData.categories || []).map((c: string) => getCategoryName(c)).join(', ')],
                    ['Address', [formData.physicalAddress, formData.city, formData.province, formData.postalCode].filter(Boolean).join(', ')]
                  ]
                },
                {
                  title: 'Banking',
                  step: 2,
                  rows: [
                    ['Bank', formData.bankName],
                    ['Account name', formData.bankAccountName],
                    ['Account number', formData.bankAccountNumber],
                    ['Branch code', formData.bankBranchCode]
                  ]
                }
              ].map((section) => (
                <div key={section.title} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{section.title}</p>
                    <button type="button" onClick={() => goToAddStep(section.step)} className="text-xs font-medium text-primary hover:underline">
                      Edit
                    </button>
                  </div>
                  <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
                    {section.rows.map(([label, value]) => (
                      <React.Fragment key={label}>
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="col-span-2 text-gray-900 break-words">{value || '—'}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </div>
              ))}
              <p className="text-xs text-gray-500">
                The supplier is created as pending. Its profile opens next, to complete KYS and submit it for activation, which the Head of Procurement or the COO approves.
              </p>
            </div>
          )}

          <FormStepNav
            current={addStep}
            total={ADD_SUPPLIER_STEPS.length}
            onBack={() => goToAddStep(Math.max(0, addStep - 1))}
            onNext={nextAddStep}
            onCancel={closeAddModal}
            finishLabel={submitting ? 'Creating...' : 'Create Supplier'}
            submitting={submitting}
          />
        </form>
      </Drawer>

      {/* Bulk Import drawer */}
      <Drawer
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
                        <p className="mb-1">
                          Optional: businessType ({BUSINESS_TYPE_OPTIONS.map((o) => o.value).join(', ')}) and entityType (company, individual). A row with any other value is not imported.
                        </p>
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
                        const bad = importRows.filter((r) => Object.keys(rowIssues(r)).length > 0).length;
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

                  <div className="overflow-auto max-h-[45vh]">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap w-8">#</th>
                          {IMPORT_GRID_FIELDS.map(({ field: f }) => (
                            <th key={f} className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">
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
                      <tbody>
                        {importRows.map((row, i) => {
                          const issues = rowIssues(row);
                          // Problems with columns the grid does not show (address, banking, types).
                          const elsewhere = Object.entries(issues)
                            .filter(([field]) => !IMPORT_GRID_FIELDS.some((c) => c.field === field))
                            .map(([, message]) => message);
                          return (
                            <React.Fragment key={i}>
                            <tr className={Object.keys(issues).length > 0 ? 'bg-amber-50/50' : 'odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors'}>
                              <td className="py-1 px-2 border-b border-gray-100 text-gray-400 align-top">{i + 1}</td>
                              {IMPORT_GRID_FIELDS.map(({ field: f, maxLength }) => (
                                <td key={f} className="py-1 px-1 border-b border-gray-100 align-top">
                                  <input
                                    value={row[f]}
                                    onChange={(e) => updateImportCell(i, f, e.target.value)}
                                    maxLength={maxLength}
                                    aria-invalid={issues[f] ? true : undefined}
                                    className={`w-full px-1.5 py-1 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-primary ${
                                      issues[f] ? 'border-amber-400 bg-amber-50' : 'border-transparent hover:border-gray-200'
                                    }`}
                                  />
                                  <FieldError message={issues[f]} className="text-[11px] leading-tight" />
                                </td>
                              ))}
                            </tr>
                            {elsewhere.length > 0 && (
                              <tr className="bg-amber-50/50">
                                <td className="border-b border-gray-100" />
                                <td colSpan={IMPORT_GRID_FIELDS.length} className="pb-1.5 px-2 border-b border-gray-100 text-[11px] text-red-600">
                                  Fix in the file: {elsewhere.join('; ')}
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-gray-500">
                    Rows with a problem are highlighted, with what to fix — those rows will be rejected. Edit them here, or import and fix the rest afterwards.
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
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Company</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkImportResults.success.map((item: any, idx: any) => (
                          <tr key={idx} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                            <td className="py-2 px-3 border-b border-gray-100">{item.companyName}</td>
                            <td className="py-2 px-3 border-b border-gray-100">{item.email}</td>
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
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Company</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Email</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkImportResults.failed.map((item: any, idx: any) => (
                          <tr key={idx} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                            <td className="py-2 px-3 border-b border-gray-100">{item.companyName}</td>
                            <td className="py-2 px-3 border-b border-gray-100">{item.email}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-red-600">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <ModalFooter>
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
              </ModalFooter>
            </div>
          )}
        </div>
      </Drawer>

      {/* Generated login — shown once, then on to the new supplier's KYS */}
      <Modal
        isOpen={!!createdCredentials}
        onClose={() => {
          const id = createdCredentials?.id;
          setCreatedCredentials(null);
          if (id) navigate(`/app/suppliers/${id}?tab=documents`);
        }}
        title="Supplier created"
        subtitle={createdCredentials?.companyName}
        footer={
          <button
            type="button"
            onClick={() => {
              const id = createdCredentials?.id;
              setCreatedCredentials(null);
              if (id) navigate(`/app/suppliers/${id}?tab=documents`);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors"
          >
            Continue to KYS
          </button>
        }
      >
        {createdCredentials && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              A password was generated for this supplier. It has been emailed to them; this is the only time it is shown here.
            </p>
            <dl className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900 break-all">{createdCredentials.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <dt className="text-gray-500">Password</dt>
                <dd className="flex items-center gap-2">
                  <code className="font-mono text-gray-900 break-all">{createdCredentials.password}</code>
                  <button
                    type="button"
                    onClick={() => {
                      // Clipboard access needs a secure context; fall back to selecting it.
                      if (!navigator.clipboard) {
                        showToast('Could not copy — select it instead', 'error');
                        return;
                      }
                      navigator.clipboard.writeText(createdCredentials.password)
                        .then(() => showToast('Password copied', 'success'))
                        .catch(() => showToast('Could not copy — select it instead', 'error'));
                    }}
                    className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
                    aria-label="Copy password"
                    title="Copy password"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </dd>
              </div>
            </dl>
            <p className="text-xs text-gray-500">Ask the supplier to change it after their first sign-in.</p>
          </div>
        )}
      </Modal>

    </div>
  );
}

