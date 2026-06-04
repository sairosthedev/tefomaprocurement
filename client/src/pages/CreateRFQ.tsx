import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api, { procurementAPI } from '../lib/api';
import { 
  ArrowLeft, Package, Calendar, Users, Send, 
  Loader2, Plus, X, Search, CheckCircle, AlertCircle,
  Lock, FileText
} from 'lucide-react';

export default function CreateRFQ() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  
  const requisitionId = searchParams.get('requisition');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requisition, setRequisition] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<any[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  
  const [formData, setFormData] = useState({
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
      const req = response.data.data?.find(r => r._id === requisitionId);
      
      if (req) {
        setRequisition(req);
        setFormData(prev => ({
          ...prev,
          title: `RFQ for ${req.title}`,
          description: req.justification || ''
        }));
      } else {
        showToast('Requisition not found or not accepted', 'error');
      }
    } catch (error) {
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
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      showToast('Failed to load suppliers', 'error');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.companyName?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.contactEmail?.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const toggleSupplier = (supplier) => {
    setSelectedSuppliers(prev => {
      const exists = prev.find(s => s._id === supplier._id);
      if (exists) {
        return prev.filter(s => s._id !== supplier._id);
      }
      return [...prev, supplier];
    });
  };

  const handleSubmit = async (e, asDraft = false) => {
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
    }

    try {
      setSubmitting(true);

      const rfqData = {
        title: formData.title,
        description: formData.description,
        purchaseRequisitionId: requisitionId, // Backend expects purchaseRequisitionId, not purchaseRequisition
        items: requisition?.items?.map(item => ({
          description: item.description,
          specifications: item.specification || item.specifications,
          quantity: item.quantity,
          unit: item.unit || 'Each'
        })) || [],
        invitedSuppliers: selectedSuppliers.map(s => s._id),
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
    } catch (error) {
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
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create RFQ</h1>
          <p className="text-gray-500 mt-1">
            {requisition 
              ? `Creating RFQ from requisition ${requisition.requisitionNumber}`
              : 'Request for Quotation'}
          </p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
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
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, submissionDeadline: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, deliveryRequiredBy: e.target.value})}
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
                    {requisition.items.map((item, index) => (
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

            {/* Selected Suppliers */}
            {selectedSuppliers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedSuppliers.map((supplier) => (
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
                onChange={(e) => setSupplierSearch(e.target.value)}
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
                  {filteredSuppliers.map((supplier) => {
                    const isSelected = selectedSuppliers.some(s => s._id === supplier._id);
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
                          <p className="font-medium text-gray-900">{supplier.companyName}</p>
                          <p className="text-sm text-gray-500">{supplier.contactEmail}</p>
                        </div>
                        {supplier.category && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                            {supplier.category}
                          </span>
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
              onChange={(e) => setFormData({...formData, termsAndConditions: e.target.value})}
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
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitting}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                disabled={submitting || selectedSuppliers.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
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







