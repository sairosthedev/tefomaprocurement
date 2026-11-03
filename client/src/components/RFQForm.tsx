import React, { forwardRef, useState, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useToast } from './Toast';
import api, { procurementAPI } from '../lib/api';
import { getCategoryName } from '../lib/constants';
import { ConfirmModal } from './Modal';
import Drawer from './Drawer';
import { FormSteps, FormStepNav } from './FormSteps';
import {
  Package, Calendar, Users,
  Loader2, X, Search, CheckCircle, AlertCircle,
  Lock, FileText, Sparkles, Save
} from 'lucide-react';

const STEPS = [
  { label: 'Details', description: 'Title, deadline and terms' },
  { label: 'Items', description: 'Lines from the requisition' },
  { label: 'Suppliers', description: 'Who is invited to quote' },
  { label: 'Review & send', description: 'Check, then publish' }
];
const STEP_DETAILS = 0;
const STEP_ITEMS = 1;
const STEP_SUPPLIERS = 2;
const LAST_STEP = STEPS.length - 1;

const EMPTY_FORM = {
  title: '',
  description: '',
  submissionDeadline: '',
  deliveryRequiredBy: '',
  termsAndConditions: '',
  notes: ''
};

export interface RFQFormHandle {
  /** Close the form, first asking to discard when anything has been entered. */
  requestClose: () => void;
}

/**
 * The RFQ wizard: details, items, suppliers, then review. Hosted in a drawer
 * (see CreateRFQDrawer), so it reports back through callbacks rather than
 * navigating away itself. The host routes its close gestures (✕, Escape,
 * backdrop) through `requestClose`, so a half-built RFQ is not lost by accident.
 */
const RFQForm = forwardRef<RFQFormHandle, {
  /** The accepted requisition the RFQ is raised from; its items become the RFQ's. */
  requisitionId?: string | null;
  /** Close without saving. */
  onCancel: () => void;
  /** Called once the RFQ is stored, with its id when the API returns one. */
  onSaved: (rfqId?: string) => void;
  /** Called with the requisition once it has loaded, so the host can name it. */
  onRequisitionLoaded?: (requisition: any) => void;
}>(function RFQForm({ requisitionId, onCancel, onSaved, onRequisitionLoaded }, ref) {
  const { showToast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState<any>(true);
  const [submitting, setSubmitting] = useState<any>(false);
  const [requisition, setRequisition] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<any[]>([]);
  const [supplierSearch, setSupplierSearch] = useState<any>('');
  // Server-side category match: the invitation proposal pre-ticks exact-code
  // matches, topped up from related categories to the competitive minimum.
  // Anything beyond the top-up is suggested but left unchecked.
  const [matchByType, setMatchByType] = useState<Record<string, 'exact' | 'related'>>({});
  const [matchedNames, setMatchedNames] = useState<Record<string, string[]>>({});
  const [relatedCount, setRelatedCount] = useState(0);
  // Officer-facing explanation of how this list was arrived at, and whether it
  // reaches the minimum number of quotations.
  const [proposalSummary, setProposalSummary] = useState<string>('');
  const [belowMinimum, setBelowMinimum] = useState(false);
  // Same company name under two registration numbers. Both stay selectable —
  // dropping a possibly-real supplier is the worse error — but they count as
  // one supplier against the three-quote rule.
  const [suspectedDuplicates, setSuspectedDuplicates] = useState<any[]>([]);
  const [step, setStep] = useState(STEP_DETAILS);

  const [formData, setFormData] = useState<any>(EMPTY_FORM);
  // What the form held before the officer touched it: blank, or the title and
  // description carried over from the requisition.
  const [prefill, setPrefill] = useState<any>(EMPTY_FORM);
  // Set once the officer adds or removes a supplier from the proposed list.
  const [selectionChanged, setSelectionChanged] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty =
    step > STEP_DETAILS ||
    selectionChanged ||
    Object.keys(EMPTY_FORM).some((field) => formData[field] !== prefill[field]);

  // A stray click on the backdrop should not throw away a half-built RFQ.
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onCancel();
  };

  useImperativeHandle(ref, () => ({ requestClose }));

  useEffect(() => {
    if (requisitionId) {
      fetchRequisition();
    } else {
      setLoading(false);
    }
    fetchSuppliers();
    fetchMatches();
  }, [requisitionId]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      // Fetch the requisition details
      const response = await api.get(`/procurement/requisitions?status=accepted`);
      const req = response.data.data?.find((r: any) => r._id === requisitionId);

      if (req) {
        setRequisition(req);
        const carried = {
          title: `RFQ for ${req.title}`,
          description: req.justification || ''
        };
        setFormData((prev: any) => ({ ...prev, ...carried }));
        setPrefill((prev: any) => ({ ...prev, ...carried }));
        onRequisitionLoaded?.(req);
      } else {
        showToast('Requisition not found or not accepted', 'error');
      }
    } catch (error: any) {
      console.error('Error fetching requisition:', error);
      showToast('Failed to load requisition', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      // Ask for a full page of suppliers: the default page size is small, and
      // anyone outside it could never be found or matched here.
      const response = await procurementAPI.getSuppliers({ status: 'active', limit: 500, view: 'picker' });
      setSuppliers(response.data.data || []);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      showToast('Failed to load suppliers', 'error');
    }
  };

  /**
   * Ask the server who should be invited.
   *
   * The same endpoint the API uses when an RFQ arrives with no suppliers named,
   * so the list shown here is the list that would be invited either way — the
   * screen and the server cannot disagree about who was proposed.
   *
   * `proposed` is pre-ticked (exact category matches, topped up from related
   * categories to the minimum of three quotations). `additional` is the rest of
   * the related tree, offered unticked so widening competition is deliberate.
   * Everything stays editable: the officer is accountable for who was invited,
   * and may know things the category tree does not.
   */
  const fetchMatches = async () => {
    if (!requisitionId) return;
    try {
      const res = await procurementAPI.getInvitationProposal({ requisitionId });
      const {
        proposed = [],
        additional = [],
        summary = '',
        belowMinimum: below = false,
        suspectedDuplicates: dupes = []
      } = res.data.data || {};

      const types: Record<string, 'exact' | 'related'> = {};
      const names: Record<string, string[]> = {};
      for (const p of [...proposed, ...additional]) {
        types[p.supplier._id] = p.basis === 'exact_category' ? 'exact' : 'related';
        names[p.supplier._id] = p.matchedCategoryNames;
      }
      setMatchByType(types);
      setMatchedNames(names);
      setRelatedCount(additional.length);
      setProposalSummary(summary);
      setBelowMinimum(below);
      setSuspectedDuplicates(dupes);

      // Merge matched suppliers into the list so any that fell outside the
      // fetched page are still selectable here.
      const matchedSuppliers = [...proposed, ...additional].map((p: any) => p.supplier);
      setSuppliers((prev: any[]) => {
        const seen = new Set(prev.map((s) => s._id));
        return [...prev, ...matchedSuppliers.filter((s: any) => !seen.has(s._id))];
      });

      if (proposed.length > 0) {
        setSelectedSuppliers((prev: any[]) => {
          const seen = new Set(prev.map((s: any) => s._id));
          return [...prev, ...proposed.map((p: any) => p.supplier).filter((s: any) => !seen.has(s._id))];
        });
      }
    } catch (error: any) {
      console.error('Error building the invitation proposal:', error);
      // Matching is an assist, not a gate — leave manual selection working.
    }
  };

  // Category codes pulled from the requisition's line items — used to match
  // and auto-suggest suppliers registered under those categories.
  const reqCategoryCodes = useMemo<string[]>(() => {
    const codes = (requisition?.items || [])
      .map((i: any) => i.category)
      .filter(Boolean);
    return Array.from(new Set(codes));
  }, [requisition]);

  const enteredItemCount = useMemo(
    () => (requisition?.items || []).filter((item: any) => item.description?.trim()).length,
    [requisition]
  );

  const supplierMatchedCategories = (supplier: any): string[] =>
    matchedNames[supplier?._id] || [];

  // Exact matches sort above related, which sort above everything else.
  const matchWeight = (supplier: any): number => {
    const type = matchByType[supplier?._id];
    return type === 'exact' ? 2 : type === 'related' ? 1 : 0;
  };

  const filteredSuppliers = suppliers
    .filter((s: any) =>
      s.companyName?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.contactEmail?.toLowerCase().includes(supplierSearch.toLowerCase())
    )
    .sort((a: any, b: any) => matchWeight(b) - matchWeight(a));

  /** Add the related-category suppliers — useful when exact matches alone
   *  won't reach the three-quotation minimum. */
  const selectSuggested = () => {
    const related = suppliers.filter((s: any) => matchByType[s._id] === 'related');
    setSelectedSuppliers((prev: any) => {
      const ids = new Set(prev.map((s: any) => s._id));
      return [...prev, ...related.filter((m) => !ids.has(m._id))];
    });
    setSelectionChanged(true);
  };

  const toggleSupplier = (supplier: any) => {
    setSelectedSuppliers((prev: any) => {
      const exists = prev.find((s: any) => s._id === supplier._id);
      if (exists) {
        return prev.filter((s: any) => s._id !== supplier._id);
      }
      return [...prev, supplier];
    });
    setSelectionChanged(true);
  };

  useEffect(() => {
    // Scrolls whichever container holds the form, page or drawer.
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step]);

  // Checks a step must pass before the next one opens. The deadline is only
  // demanded at publishing, as before, so a draft can still be saved without it.
  const validateStep = (index: number): boolean => {
    if (index === STEP_DETAILS && !formData.title?.trim()) {
      showToast('Please enter an RFQ title', 'error');
      return false;
    }
    if (index === STEP_ITEMS && enteredItemCount === 0) {
      showToast('RFQ must have at least one item before it can be sent to suppliers', 'error');
      return false;
    }
    if (index === STEP_SUPPLIERS && selectedSuppliers.length === 0) {
      showToast('Please select at least one supplier', 'error');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const handleSubmit = async (e: any, asDraft = false) => {
    e.preventDefault();

    // Enter in a field submits the form; before the last step it means "next".
    if (!asDraft && step < LAST_STEP) {
      goNext();
      return;
    }

    if (!formData.title?.trim()) {
      showToast('Please enter an RFQ title', 'error');
      setStep(STEP_DETAILS);
      return;
    }

    if (!asDraft) {
      if (selectedSuppliers.length === 0) {
        showToast('Please select at least one supplier', 'error');
        setStep(STEP_SUPPLIERS);
        return;
      }
      if (!formData.submissionDeadline) {
        showToast('Please set a submission deadline', 'error');
        setStep(STEP_DETAILS);
        return;
      }
      const rfqItems = (requisition?.items || []).filter((item: any) => item.description?.trim());
      if (rfqItems.length === 0) {
        showToast('RFQ must have at least one item before it can be sent to suppliers', 'error');
        setStep(STEP_ITEMS);
        return;
      }
    }

    try {
      setSubmitting(true);

      const rfqData: any = {
        title: formData.title,
        description: formData.description,
        purchaseRequisitionId: requisitionId, // Backend expects purchaseRequisitionId, not purchaseRequisition
        items: requisition?.items?.map((item: any) => ({
          description: item.description,
          categoryName: item.category, // carry the canonical category code
          specifications: item.specification || item.specifications,
          quantity: item.quantity,
          unit: item.unit || 'Each',
          // Machine identification and data-plate photos travel with the line so
          // suppliers can match the exact part.
          equipment: item.equipment,
          attachments: item.attachments?.map((a: any) => ({
            kind: a.kind,
            fileName: a.fileName,
            fileData: a.fileData,
            mimeType: a.mimeType,
            caption: a.caption
          }))
        })) || [],
        invitedSuppliers: selectedSuppliers.map((s: any) => s._id),
        submissionDeadline: formData.submissionDeadline,
        deliveryRequiredBy: formData.deliveryRequiredBy,
        termsAndConditions: formData.termsAndConditions,
        notes: formData.notes,
        status: asDraft ? 'draft' : 'open'
      };

      const created = await procurementAPI.createRFQ(rfqData);
      const rfqId = created.data?.data?._id;

      // Update requisition status to sourcing
      if (!asDraft && requisitionId) {
        try {
          await api.put(`/procurement/requisitions/${requisitionId}/sourcing`);
        } catch (sourcingError: any) {
          showToast(
            sourcingError.response?.data?.message || 'RFQ created but requisition status was not updated',
            'error'
          );
        }
      }

      showToast(asDraft ? 'RFQ saved as draft' : 'RFQ created and sent to suppliers', 'success');
      onSaved(rfqId);
    } catch (error: any) {
      console.error('Error creating RFQ:', error);
      showToast(error.response?.data?.message || 'Failed to create RFQ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-6">
      <FormSteps steps={STEPS} current={step} onSelect={setStep} variant="track" />

      <form onSubmit={(e: any) => handleSubmit(e, false)}>
        <div className="space-y-6">
          {/* Requisition Info Banner */}
          {requisition && step !== LAST_STEP && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900">
                    From Requisition: {requisition.requisitionNumber}
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Requested by: {requisition.requestedBy?.firstName} {requisition.requestedBy?.lastName}
                    {requisition.department && ` • ${requisition.department.name}`}
                  </p>
                  <p className="text-sm text-blue-600 mt-2">
                    {requisition.justification || requisition.title}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === STEP_DETAILS && (
          <>
          {/* RFQ Details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">RFQ Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RFQ Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e: any) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Enter RFQ title"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description / Requirements
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e: any) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  placeholder="Additional details or requirements for suppliers..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Submission Deadline *
                </label>
                <input
                  type="datetime-local"
                  value={formData.submissionDeadline}
                  onChange={(e: any) => setFormData({...formData, submissionDeadline: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Required By
                </label>
                <input
                  type="date"
                  value={formData.deliveryRequiredBy}
                  onChange={(e: any) => setFormData({...formData, deliveryRequiredBy: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h2>
            <textarea
              value={formData.termsAndConditions}
              onChange={(e: any) => setFormData({...formData, termsAndConditions: e.target.value})}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Enter terms and conditions for this RFQ..."
            />
          </div>
          </>
          )}

          {/* Items from Requisition - READ ONLY */}
          {step === STEP_ITEMS && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Items</h2>
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  <Lock className="h-3 w-3" />
                  From Requisition
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {requisition?.items?.length || 0} items
              </span>
            </div>

            {requisition?.items?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">#</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Specification</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Quantity</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisition.items.map((item: any, index: any) => (
                      <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-500">{index + 1}</td>
                        <td className="py-2 px-3 border-b border-gray-100">
                          <span className="font-medium text-gray-900">{item.description}</span>
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">
                          {item.specification || item.specifications || '-'}
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100">
                          <span className="font-semibold text-gray-900">{item.quantity}</span>
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-600">{item.unit || 'Each'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No items in requisition</p>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Items are locked from the original requisition and cannot be modified
            </p>
          </div>
          )}

          {/* Select Suppliers */}
          {step === STEP_SUPPLIERS && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Invite Suppliers</h2>
              <span className="text-sm text-primary font-medium">
                {selectedSuppliers.length} selected
              </span>
            </div>

            {reqCategoryCodes.length > 0 && (
              <div className="flex items-center justify-between gap-3 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-start gap-2 text-sm text-amber-800">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Invitations pre-selected from this requisition's categories
                    ({reqCategoryCodes.map((c) => getCategoryName(c)).join(', ')}).
                    {' '}You can add or remove anyone before sending.
                    {/* The server's own account of how it arrived at this list,
                        including whether it reaches the competitive minimum. */}
                    {proposalSummary && (
                      <span className="block mt-1 text-amber-700">{proposalSummary}</span>
                    )}
                  </span>
                </div>
                {relatedCount > 0 && (
                  <button
                    type="button"
                    onClick={selectSuggested}
                    className="shrink-0 text-xs font-medium bg-primary text-white rounded-lg px-2.5 py-1.5 hover:bg-primary-dark transition-colors"
                  >
                    Add {relatedCount} related
                  </button>
                )}
              </div>
            )}

            {suspectedDuplicates.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <p className="font-medium">Possible duplicate supplier records</p>
                <ul className="mt-1 space-y-0.5 text-amber-700">
                  {suspectedDuplicates.map((d: any) => (
                    <li key={d.companyName}>
                      <strong>{d.companyName}</strong> appears under{' '}
                      {d.registrationNumbers.join(' and ')}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-amber-700">
                  Both records are listed so you can pick the right one, but each company counts
                  once towards the three-quotation minimum. Worth cleaning up in the supplier
                  register.
                </p>
              </div>
            )}

            {belowMinimum && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                <p className="font-medium">Fewer than 3 suppliers can be invited</p>
                <p className="mt-1 text-red-700">
                  This RFQ will not meet the minimum of three competitive quotations, so awarding it
                  will need an approved quotation waiver. Consider widening the categories on the
                  requisition, or registering more suppliers in this trade first.
                </p>
              </div>
            )}

            {/* Selected Suppliers */}
            {selectedSuppliers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedSuppliers.map((supplier: any) => (
                  <button
                    key={supplier._id}
                    type="button"
                    onClick={() => toggleSupplier(supplier)}
                    title="Remove from this RFQ"
                    className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <span className="text-sm font-medium">{supplier.companyName}</span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}

            {/* Search Suppliers */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={supplierSearch}
                onChange={(e: any) => setSupplierSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Search suppliers..."
              />
            </div>

            {/* Supplier List */}
            <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto">
              {filteredSuppliers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No approved suppliers found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredSuppliers.map((supplier: any) => {
                    const isSelected = selectedSuppliers.some((s: any) => s._id === supplier._id);
                    const matched = supplierMatchedCategories(supplier);
                    return (
                      <div
                        key={supplier._id}
                        onClick={() => toggleSupplier(supplier)}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{supplier.companyName}</p>
                            {matchByType[supplier._id] === 'exact' && (
                              <span
                                title={`Registered under: ${matched.join(', ')}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full"
                              >
                                <Sparkles className="h-3 w-3" /> Category match
                              </span>
                            )}
                            {matchByType[supplier._id] === 'related' && (
                              <span
                                title={`Related category: ${matched.join(', ')}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full"
                              >
                                Related
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{supplier.user?.email || supplier.contactEmail || ''}</p>
                        </div>
                        {supplier.categories?.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end max-w-[45%]">
                            {supplier.categories.slice(0, 2).map((c: string) => (
                              <span
                                key={c}
                                title={c}
                                className={`text-xs px-2 py-1 rounded-full ${
                                  reqCategoryCodes.includes(c)
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {getCategoryName(c)}
                              </span>
                            ))}
                            {supplier.categories.length > 2 && (
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                +{supplier.categories.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Review & send: everything suppliers will receive, in one place */}
          {step === LAST_STEP && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review before sending</h2>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Details
                </h3>
                <button type="button" onClick={() => setStep(STEP_DETAILS)} className="text-xs font-medium text-primary hover:underline">
                  Edit
                </button>
              </div>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="md:col-span-2">
                  <dt className="text-gray-500">Title</dt>
                  <dd className="font-medium text-gray-900">{formData.title || '-'}</dd>
                </div>
                {requisition && (
                  <div>
                    <dt className="text-gray-500">Requisition</dt>
                    <dd className="font-medium text-gray-900">{requisition.requisitionNumber}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Submission deadline</dt>
                  <dd className={`font-medium ${formData.submissionDeadline ? 'text-gray-900' : 'text-red-600'}`}>
                    {formData.submissionDeadline
                      ? new Date(formData.submissionDeadline).toLocaleString()
                      : 'Not set (required to publish)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Delivery required by</dt>
                  <dd className="font-medium text-gray-900">
                    {formData.deliveryRequiredBy ? new Date(formData.deliveryRequiredBy).toLocaleDateString() : '-'}
                  </dd>
                </div>
                {formData.description && (
                  <div className="md:col-span-2">
                    <dt className="text-gray-500">Description / requirements</dt>
                    <dd className="text-gray-700 whitespace-pre-line">{formData.description}</dd>
                  </div>
                )}
                {formData.termsAndConditions && (
                  <div className="md:col-span-2">
                    <dt className="text-gray-500">Terms & conditions</dt>
                    <dd className="text-gray-700 whitespace-pre-line">{formData.termsAndConditions}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Items ({enteredItemCount})
                </h3>
                <button type="button" onClick={() => setStep(STEP_ITEMS)} className="text-xs font-medium text-primary hover:underline">
                  View
                </button>
              </div>
              <ul className="text-sm divide-y divide-gray-100">
                {(requisition?.items || [])
                  .filter((item: any) => item.description?.trim())
                  .map((item: any, index: any) => (
                    <li key={index} className="flex justify-between gap-4 py-1.5">
                      <span className="text-gray-900">{item.description}</span>
                      <span className="text-gray-600 whitespace-nowrap">
                        {item.quantity} {item.unit || 'Each'}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>

            <section className="pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Suppliers invited ({selectedSuppliers.length})
                </h3>
                <button type="button" onClick={() => setStep(STEP_SUPPLIERS)} className="text-xs font-medium text-primary hover:underline">
                  Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedSuppliers.map((supplier: any) => (
                  <span key={supplier._id} className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                    {supplier.companyName}
                  </span>
                ))}
              </div>
              {belowMinimum && (
                <p className="mt-3 text-sm text-red-700 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  Fewer than 3 suppliers: awarding this RFQ will need an approved quotation waiver.
                </p>
              )}
            </section>
          </div>
          )}

          <FormStepNav
            current={step}
            total={STEPS.length}
            onBack={() => setStep((s) => Math.max(s - 1, 0))}
            onNext={goNext}
            onCancel={requestClose}
            finishLabel="Publish RFQ"
            submitting={submitting}
            size="sm"
            extra={
              <button
                type="button"
                onClick={(e: any) => handleSubmit(e, true)}
                disabled={submitting}
                className="flex items-center justify-center gap-1.5 px-3 py-[7px] text-sm border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                Save as Draft
              </button>
            }
          />
        </div>
      </form>

      <ConfirmModal
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={onCancel}
        title="Discard this RFQ?"
        message="Nothing has been saved yet, so what you have entered will be lost."
        confirmText="Discard"
      />
    </div>
  );
});

/**
 * The RFQ form in its drawer, for the RFQ list and the requisition pages. The
 * form is mounted only while open, so each opening starts from a fresh copy of
 * the requisition and a fresh invitation proposal.
 */
export function CreateRFQDrawer({ isOpen, requisitionId, onClose, onSaved }: {
  isOpen: boolean;
  /** The accepted requisition to raise the RFQ from, if any. */
  requisitionId?: string | null;
  /** Close without saving; the form has already asked about discarding. */
  onClose: () => void;
  /** Called once the RFQ is stored, with its id when the API returns one. */
  onSaved: (rfqId?: string) => void;
}) {
  const formRef = useRef<RFQFormHandle>(null);
  // The requisition number is known only once the form has loaded it. Kept with
  // its id, so a number from an earlier opening never names a different one.
  const [loaded, setLoaded] = useState<{ id: string; number: string } | null>(null);
  const subtitle =
    requisitionId && loaded?.id === requisitionId
      ? `From requisition ${loaded.number}`
      : 'Request for Quotation';

  return (
    <Drawer
      isOpen={isOpen}
      // The form decides: it asks before anything entered is thrown away.
      onClose={() => formRef.current?.requestClose()}
      title="Create RFQ"
      subtitle={subtitle}
      size="xl"
    >
      <RFQForm
        key={requisitionId || 'blank'}
        ref={formRef}
        requisitionId={requisitionId}
        onCancel={onClose}
        onSaved={onSaved}
        onRequisitionLoaded={(req) =>
          setLoaded({ id: req._id, number: req.requisitionNumber || `REQ-${req._id.slice(-6).toUpperCase()}` })
        }
      />
    </Drawer>
  );
}

export default RFQForm;
