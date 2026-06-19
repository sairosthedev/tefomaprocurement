import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { Plus, Trash2, Save, Send, Package, Loader2 } from 'lucide-react';
import { UNITS_OF_MEASUREMENT } from '../lib/constants';
import { CategorySelect } from '../components/CategorySelect';
import { ItemSelect, type CatalogItem } from '../components/ItemSelect';
import PageHeader from '../components/PageHeader';

export default function CreateRequisition() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<any>(false);
  const [formData, setFormData] = useState<any>({
    title: '',
    workOrder: '',
    description: '',
    urgency: 'normal',
    items: [{ description: '', category: '', quantity: 1, unit: 'Each', package: '', specification: '', catalogItem: null as CatalogItem | null }]
  });

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', category: '', quantity: 1, unit: 'Each', package: '', specification: '', catalogItem: null as CatalogItem | null }]
    });
  };

  const removeItem = (index: any) => {
    if (formData.items.length === 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_: any, i: any) => i !== index)
    });
  };

  const updateItem = (index: any, field: any, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async (submit = false) => {
    try {
      setLoading(true);
      
      // Validate
      if (!formData.title.trim()) {
        showToast('Please enter a title', 'error');
        setLoading(false);
        return;
      }
      
      const validItems = formData.items.filter((item: any) => item.description.trim());
      if (submit && validItems.length === 0) {
        showToast('Please add at least one item before submitting', 'error');
        setLoading(false);
        return;
      }

      // Every requested item must fall under a category (when submitting)
      if (submit) {
        const uncategorized = validItems.filter((item: any) => !item.category);
        if (uncategorized.length > 0) {
          showToast('Please select a category for every item', 'error');
          setLoading(false);
          return;
        }
      }

      const itemsToSave = submit
        ? validItems
        : formData.items.filter((item: any) => item.description.trim());

      const response = await api.post('/department/requisitions', {
        ...formData,
        justification: formData.description,
        items: itemsToSave.map((item: any) => ({
          itemId: item.catalogItem?._id,
          description: item.description,
          category: item.category,
          package: item.package,
          quantity: item.quantity,
          unit: item.unit,
          specification: item.specification
        })),
        status: submit ? 'pending' : 'draft'
      });

      if (response.data.success) {
        showToast(
          submit ? 'Requisition submitted for approval' : 'Requisition saved as draft',
          'success'
        );
        navigate('/app/requisitions');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save requisition', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        backTo="/app/requisitions"
        backLabel="Back to Requisitions"
        title="Internal Requisition"
        subtitle="Request items for your department — digital IR form"
      />

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e: any) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Office Supplies for Q1"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide additional details..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work Order</label>
            <input
              type="text"
              value={formData.workOrder}
              onChange={(e: any) => setFormData({ ...formData, workOrder: e.target.value })}
              placeholder="Job / project reference"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
            <select
              value={formData.urgency}
              onChange={(e: any) => setFormData({ ...formData, urgency: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="normal">Normal</option>
              <option value="high">High Priority</option>
            </select>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-700">
              Items <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {formData.items.map((item: any, index: any) => (
              <div key={index} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Item {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={formData.items.length === 1}
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-xs text-gray-500 mb-1">Details</label>
                    <ItemSelect
                      value={item.catalogItem}
                      freeTextValue={item.description}
                      onChange={(catalogItem) => {
                        const newItems = [...formData.items];
                        newItems[index] = {
                          ...newItems[index],
                          catalogItem,
                          description: catalogItem?.name || newItems[index].description,
                          category: catalogItem?.category || newItems[index].category,
                          unit: catalogItem?.unit
                            ? catalogItem.unit.charAt(0).toUpperCase() + catalogItem.unit.slice(1)
                            : newItems[index].unit
                        };
                        setFormData({ ...formData, items: newItems });
                      }}
                      onFreeText={(text) => updateItem(index, 'description', text)}
                      placeholder="Search stock catalog or type description…"
                      className="w-full"
                    />
                    {item.catalogItem && (
                      <p className="text-xs text-emerald-600 mt-1">
                        Linked to catalog · {item.catalogItem.quantityAvailable} available at your site
                      </p>
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-xs text-gray-500 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <CategorySelect
                      value={item.category || ''}
                      onChange={(code) => updateItem(index, 'category', code)}
                      placeholder="Select category"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white flex items-center justify-between"
                    />
                  </div>

                  <div className="col-span-4 md:col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">Package</label>
                    <input
                      type="text"
                      value={item.package}
                      onChange={(e: any) => updateItem(index, 'package', e.target.value)}
                      placeholder="e.g. Box"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e: any) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e: any) => updateItem(index, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      {UNITS_OF_MEASUREMENT.map((unit: any) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-12">
                    <label className="block text-xs text-gray-500 mb-1">Specification (optional)</label>
                    <input
                      type="text"
                      value={item.specification}
                      onChange={(e: any) => updateItem(index, 'specification', e.target.value)}
                      placeholder="e.g., 80gsm white"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate('/app/requisitions')}
            className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Submit for Approval</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

