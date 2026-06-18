import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api, { procurementAPI } from '../lib/api';
import { getCategoryName } from '../lib/constants';
import PageHeader from '../components/PageHeader';
import { 
  Package, Calendar, Users, Send, 
  Loader2, Plus, X, Search, CheckCircle, AlertCircle,
  Lock, FileText, Sparkles
} from 'lucide-react';

export default function CreateRFQ() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  
  const requisitionId = searchParams.get('requisition');
  
  const [loading, setLoading] = useState<any>(true);
  const [submitting, setSubmitting] = useState<any>(false);
  const [requisition, setRequisition] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<any[]>([]);
  const [supplierSearch, setSupplierSearch] = useState<any>('');
  
  const [formData, setFormData] = useState<any>({
    title: '',
    description: '',
    submissionDeadline: '',
    deliveryRequiredBy: '',
    termsAndConditions: '',
    notes: ''
  });

  useEffect(() => {
    if (requisitionId) {
      fetchRequisition();
    } else {
      setLoading(false);
    }
    fetchSuppliers();
  }, [requisitionId]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      // Fetch the requisition details
      const response = await api.get(`/procurement/requisitions?status=accepted`);
      const req = response.data.data?.find((r: any) => r._id === requisitionId);
      
      if (req) {
        setRequisition(req);
        setFormData((prev: any) => ({
          ...prev,
          title: `RFQ for ${req.title}`,
          description: req.justification || ''
        }));
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
      const response = await procurementAPI.getSuppliers({ status: 'active' });
      setSuppliers(response.data.data || []);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      showToast('Failed to load suppliers', 'error');
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

  const supplierMatchedCategories = (supplier: any): string[] => {
    const cats: string[] = supplier?.categories || [];
    return cats.filter((c) => reqCategoryCodes.includes(c));
  };

  // Auto-select suppliers matching the requisition categories (once)
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (autoSelected) return;
    if (reqCategoryCodes.length === 0 || suppliers.length === 0) return;
    const matches = suppliers.filter((s) => supplierMatchedCategories(s).length > 0);
    if (matches.length > 0) {
      setSelectedSuppliers(matches);
    }
    setAutoSelected(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, reqCategoryCodes, autoSelected]);

  const filteredSuppliers = suppliers
    .filter((s: any) =>
      s.companyName?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.contactEmail?.toLowerCase().includes(supplierSearch.toLowerCase())
    )
    // Suppliers matching the requisition's categories float to the top
    .sort((a: any, b: any) => supplierMatchedCategories(b).length - supplierMatchedCategories(a).length);

  const selectSuggested = () => {
    const matches = suppliers.filter((s) => supplierMatchedCategories(s).length > 0);
    setSelectedSuppliers((prev: any) => {
      const ids = new Set(prev.map((s: any) => s._id));
      return [...prev, ...matches.filter((m) => !ids.has(m._id))];
    });
  };

  const toggleSupplier = (supplier: any) => {
    setSelectedSuppliers((prev: any) => {
      const exists = prev.find((s: any) => s._id === supplier._id);
      if (exists) {
        return prev.filter((s: any) => s._id !== supplier._id);
      }
      return [...prev, supplier];
    });
  };

  const handleSubmit = async (e: any, asDraft = false) => {
    e.preventDefault();

    if (!asDraft) {
      if (selectedSuppliers.length === 0) {
        showToast('Please select at least one supplier', 'error');
        return;
      }
      if (!formData.submissionDeadline) {
        showToast('Please set a submission deadline', 'error');
        return;
      }
      const rfqItems = (requisition?.items || []).filter((item: any) => item.description?.trim());
      if (rfqItems.length === 0) {
        showToast('RFQ must have at least one item before it can be sent to suppliers', 'error');
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
          unit: item.unit || 'Each'
        })) || [],
        invitedSuppliers: selectedSuppliers.map((s: any) => s._id),
        submissionDeadline: formData.submissionDeadline,
        deliveryRequiredBy: formData.deliveryRequiredBy,
        termsAndConditions: formData.termsAndConditions,
        notes: formData.notes,
        status: asDraft ? 'draft' : 'open'
      };

      await procurementAPI.createRFQ(rfqData);
      
      // Update requisition status to sourcing
      if (!asDraft && requisitionId) {
        await api.put(`/procurement/requisitions/${requisitionId}/sourcing`).catch(() => {});
      }

      showToast(asDraft ? 'RFQ saved as draft' : 'RFQ created and sent to suppliers', 'success');
      navigate('/app/rfqs');
    } catch (error: any) {
      console.error('Error creating RFQ:', error);
      showToast(error.response?.data?.message || 'Failed to create RFQ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        onBack={() => navigate(-1)}
        title="Create RFQ"
        subtitle={
          requisition
            ? `Creating RFQ from requisition ${requisition.requisitionNumber}`
            : 'Request for Quotation'
        }
      />

      <form onSubmit={(e: any) => handleSubmit(e, false)}>
        <div className="space-y-6">
          {/* Requisition Info Banner */}
          {requisition && (
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

          {/* RFQ Details */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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

          {/* Items from Requisition - READ ONLY */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">#</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Specification</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Quantity</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requisition.items.map((item: any, index: any) => (
                      <tr key={index} className="bg-gray-50/50">
                        <td className="py-3 px-4 text-sm text-gray-500">{index + 1}</td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-gray-900">{item.description}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.specification || item.specifications || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-gray-900">{item.quantity}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.unit || 'Each'}</td>
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

          {/* Select Suppliers */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
                    Suppliers registered under this requisition's categories
                    ({reqCategoryCodes.map((c) => getCategoryName(c)).join(', ')}) are suggested and pre-selected.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={selectSuggested}
                  className="shrink-0 text-xs font-medium text-amber-800 border border-amber-300 rounded-lg px-2.5 py-1.5 hover:bg-amber-100"
                >
                  Select suggested
                </button>
              </div>
            )}

            {/* Selected Suppliers */}
            {selectedSuppliers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedSuppliers.map((supplier: any) => (
                  <div
                    key={supplier._id}
                    className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full"
                  >
                    <span className="text-sm font-medium">{supplier.companyName}</span>
                    <button
                      type="button"
                      onClick={() => toggleSupplier(supplier)}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                            {matched.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                <Sparkles className="h-3 w-3" /> Suggested
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
                                  matched.includes(c) ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
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

          {/* Terms & Conditions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Terms & Conditions</h2>
            <textarea
              value={formData.termsAndConditions}
              onChange={(e: any) => setFormData({...formData, termsAndConditions: e.target.value})}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Enter terms and conditions for this RFQ..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e: any) => handleSubmit(e, true)}
                disabled={submitting}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                disabled={submitting || selectedSuppliers.length === 0 || enteredItemCount === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
                title={enteredItemCount === 0 ? 'Add at least one item before publishing' : undefined}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                Publish RFQ
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}







