import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api from '../lib/api';
import { Plus, Trash2, Save } from 'lucide-react';
import { UNITS_OF_MEASUREMENT, formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { CategorySelect } from '../components/CategorySelect';
import { ItemSelect, type CatalogItem } from '../components/ItemSelect';
import PageHeader from '../components/PageHeader';
import EquipmentDetailsPanel from '../components/EquipmentDetailsPanel';
import { FormSteps, FormStepNav } from '../components/FormSteps';
import { categoryNeedsEquipmentDetails } from '@fossil/shared';

const emptyItem = () => ({
  description: '',
  category: '',
  quantity: 1,
  unit: 'Each',
  // Rough figure from the requester. It is what the budget check uses before a
  // supplier has quoted, so an approximate number is far more useful than none.
  estimatedUnitPrice: '',
  package: '',
  specification: '',
  equipment: {} as Record<string, string>,
  attachments: [] as any[],
  catalogItem: null as CatalogItem | null
});

const STEPS = [
  { label: 'Details', description: 'What the request is for' },
  { label: 'Items', description: 'What to buy, and rough prices' },
  { label: 'Review & submit', description: 'Check, then send for approval' }
];

export default function CreateRequisition() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState<any>(false);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<any>({
    title: '',
    workOrder: '',
    description: '',
    urgency: 'normal',
    items: [emptyItem()]
  });

  /** What this request is worth, used for the running total shown below. */
  const estimatedTotal = (formData.items || []).reduce(
    (sum: number, item: any) =>
      sum + (Number(item.estimatedUnitPrice) || 0) * (Number(item.quantity) || 0),
    0
  );

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, emptyItem()]
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

  const updateEquipmentField = (index: number, key: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      equipment: { ...(newItems[index].equipment || {}), [key]: value }
    };
    setFormData({ ...formData, items: newItems });
  };

  const updateAttachments = (index: number, attachments: any[]) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], attachments };
    setFormData({ ...formData, items: newItems });
  };

  const goTo = (index: number) => {
    setStep(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** The checks handleSave runs on submit, run per step so problems show where they are. */
  const stepIsComplete = (index: number) => {
    if (index === 0 && !formData.title.trim()) {
      showToast('Please enter a title', 'error');
      return false;
    }
    if (index === 1) {
      const validItems = formData.items.filter((item: any) => item.description.trim());
      if (validItems.length === 0) {
        showToast('Please add at least one item before submitting', 'error');
        return false;
      }
      if (validItems.some((item: any) => !item.category)) {
        showToast('Please select a category for every item', 'error');
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (stepIsComplete(step)) goTo(Math.min(step + 1, STEPS.length - 1));
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
          estimatedUnitPrice: Number(item.estimatedUnitPrice) || 0,
          specification: item.specification,
          equipment: item.equipment,
          attachments: item.attachments
        })),
        status: submit ? 'pending' : 'draft'
      });

      if (response.data.success) {
        showToast(
          submit ? 'Requisition submitted for approval' : 'Requisition saved as draft',
          'success'
        );
        const createdId = response.data.data?._id;
        navigate(createdId ? `/app/requisitions/${createdId}` : '/app/requisitions');
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

      <FormSteps steps={STEPS} current={step} onSelect={goTo} />

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) goNext();
          else handleSave(true);
        }}
        onKeyDown={(e) => {
          // Enter in a field moves on a step instead of submitting early.
          const target = e.target as HTMLElement;
          if (e.key === 'Enter' && target.tagName === 'INPUT' && step < STEPS.length - 1) {
            e.preventDefault();
            goNext();
          }
        }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6"
      >
        {/* Basic Info */}
        {step === 0 && (
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
        )}

        {/* Items */}
        {step === 1 && (
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

                <div className="grid grid-cols-12 gap-4">
                  {/* Category first — determines what type of item is being requested */}
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <CategorySelect
                      value={item.category || ''}
                      onChange={(code) => updateItem(index, 'category', code)}
                      placeholder="Select category"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-7">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Description <span className="text-red-500">*</span>
                    </label>
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
                      className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {item.catalogItem && (
                      <p className="text-xs text-emerald-600 mt-1">
                        Linked to catalog · {item.catalogItem.quantityAvailable} available at your site
                      </p>
                    )}
                  </div>

                  <div className="col-span-4 md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Package</label>
                    <input
                      type="text"
                      value={item.package}
                      onChange={(e: any) => updateItem(index, 'package', e.target.value)}
                      placeholder="e.g. Box"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e: any) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e: any) => updateItem(index, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      {UNITS_OF_MEASUREMENT.map((unit: any) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-8 md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Est. unit price <span className="text-gray-400 font-normal text-xs">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.estimatedUnitPrice}
                      onChange={(e: any) => updateItem(index, 'estimatedUnitPrice', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2 flex flex-col justify-end">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Line total</label>
                    <div className="px-3 py-2 text-sm text-gray-700 font-medium tabular-nums border border-gray-200 rounded-lg bg-gray-50">
                      {(Number(item.estimatedUnitPrice) || 0) * (Number(item.quantity) || 0)
                        ? formatCurrency(
                            (Number(item.estimatedUnitPrice) || 0) * (Number(item.quantity) || 0),
                            getCurrentSbuCurrency()
                          )
                        : '—'}
                    </div>
                  </div>

                  <div className="col-span-12">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Specification <span className="text-gray-400 font-normal text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={item.specification}
                      onChange={(e: any) => updateItem(index, 'specification', e.target.value)}
                      placeholder="e.g., 80gsm white"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  <EquipmentDetailsPanel
                    equipment={item.equipment || {}}
                    attachments={item.attachments || []}
                    onEquipmentChange={(key, value) => updateEquipmentField(index, key, value)}
                    onAttachmentsChange={(next) => updateAttachments(index, next)}
                    defaultOpen={categoryNeedsEquipmentDetails(item.category)}
                    onError={(message) => showToast(message, 'error')}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Running total, so the requester sees the size of what they are
              asking for before it reaches an approver. */}
          {estimatedTotal > 0 && (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm">
              <span className="text-gray-500">Estimated total</span>
              <span className="text-lg font-semibold text-gray-900 tabular-nums">
                {formatCurrency(estimatedTotal, getCurrentSbuCurrency())}
              </span>
            </div>
          )}
          {estimatedTotal === 0 && (formData.items || []).length > 0 && (
            <p className="mt-3 text-xs text-gray-500 text-right">
              Add estimated prices so this request can be checked against your department budget.
            </p>
          )}
        </div>
        )}

        {/* Review: everything the approver will see, before it is sent. */}
        {step === 2 && (
          <div className="space-y-6">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="md:col-span-2">
                <dt className="text-gray-500">Title</dt>
                <dd className="font-medium text-gray-900">{formData.title}</dd>
              </div>
              {formData.description && (
                <div className="md:col-span-2">
                  <dt className="text-gray-500">Description</dt>
                  <dd className="text-gray-900 whitespace-pre-line">{formData.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Work Order</dt>
                <dd className="text-gray-900">{formData.workOrder || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Urgency</dt>
                <dd className="text-gray-900">{formData.urgency === 'high' ? 'High Priority' : 'Normal'}</dd>
              </div>
            </dl>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Item</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Category</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Qty</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Est. unit</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items
                    .filter((item: any) => item.description.trim())
                    .map((item: any, index: number) => {
                      const lineTotal = (Number(item.estimatedUnitPrice) || 0) * (Number(item.quantity) || 0);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="py-2 px-3 border border-gray-200 text-gray-900">
                            {item.description}
                            {item.specification && <span className="block text-xs text-gray-500">{item.specification}</span>}
                          </td>
                          <td className="py-2 px-3 border border-gray-200 text-gray-700">{item.category}</td>
                          <td className="py-2 px-3 border border-gray-200 text-right tabular-nums">{item.quantity} {item.unit}</td>
                          <td className="py-2 px-3 border border-gray-200 text-right tabular-nums">
                            {Number(item.estimatedUnitPrice) ? formatCurrency(Number(item.estimatedUnitPrice), getCurrentSbuCurrency()) : '—'}
                          </td>
                          <td className="py-2 px-3 border border-gray-200 text-right tabular-nums font-medium">
                            {lineTotal ? formatCurrency(lineTotal, getCurrentSbuCurrency()) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 text-sm">
              <span className="text-gray-500">Estimated total</span>
              <span className="text-lg font-semibold text-gray-900 tabular-nums">
                {estimatedTotal > 0 ? formatCurrency(estimatedTotal, getCurrentSbuCurrency()) : '—'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Submitting sends this to your department head for approval. Save a draft to finish it later.
            </p>
          </div>
        )}

        <FormStepNav
          current={step}
          total={STEPS.length}
          onBack={() => goTo(step - 1)}
          onNext={goNext}
          onCancel={() => navigate('/app/requisitions')}
          finishLabel={loading ? 'Submitting...' : 'Submit for Approval'}
          submitting={loading}
          extra={
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
          }
        />
      </form>
    </div>
  );
}

