import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useToast } from './Toast';
import api from '../lib/api';
import { Plus, Package, Save } from 'lucide-react';
import { formatCurrency, getCategoryName } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import Modal, { ConfirmModal } from './Modal';
import RequisitionItemDrawer, { type RequisitionItem } from './RequisitionItemDrawer';
import { FormSteps, FormStepNav } from './FormSteps';

const STEPS = [
  { label: 'Details', description: 'What the request is for' },
  { label: 'Items', description: 'What to buy, and rough prices' },
  { label: 'Review & submit', description: 'Check, then send for approval' }
];

export interface RequisitionFormHandle {
  /** Close the form, first offering to save a draft when something has been entered. */
  requestClose: () => void;
}

/**
 * The digital IR form: details, items, then review. Hosted in a drawer on the
 * Requisitions page, so it reports back through callbacks rather than
 * navigating away itself. The host routes its close gestures (✕, Escape,
 * backdrop) through `requestClose`, so the form can offer to save a draft.
 */
const RequisitionForm = forwardRef<RequisitionFormHandle, {
  /** Close without saving. */
  onCancel: () => void;
  /** Called once the requisition is stored, with its id when the API returns one. */
  onSaved: (id?: string) => void;
}>(function RequisitionForm({ onCancel, onSaved }, ref) {
  const { showToast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<any>(false);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<any>({
    title: '',
    workOrder: '',
    description: '',
    urgency: 'normal',
    items: [] as RequisitionItem[]
  });
  // Which line the item drawer is open on: an index to edit it, 'new' to add one.
  const [editingItem, setEditingItem] = useState<number | 'new' | null>(null);
  const [removingItem, setRemovingItem] = useState<number | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty =
    !!(formData.title.trim() || formData.description.trim() || formData.workOrder.trim()) ||
    formData.urgency !== 'normal' ||
    formData.items.length > 0;

  // A stray click on the backdrop should not throw away a half-filled form.
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onCancel();
  };

  useImperativeHandle(ref, () => ({ requestClose }));

  /** What this request is worth, used for the running total shown below. */
  const estimatedTotal = (formData.items || []).reduce(
    (sum: number, item: any) =>
      sum + (Number(item.estimatedUnitPrice) || 0) * (Number(item.quantity) || 0),
    0
  );

  /** Add a line from the item drawer, or replace the one it was editing. */
  const saveItem = (item: RequisitionItem) => {
    setFormData((current: any) => ({
      ...current,
      items:
        editingItem === 'new' || editingItem === null
          ? [...current.items, item]
          : current.items.map((existing: RequisitionItem, i: number) => (i === editingItem ? item : existing))
    }));
    setEditingItem(null);
  };

  const removeItem = (index: number) => {
    setFormData((current: any) => ({
      ...current,
      items: current.items.filter((_: RequisitionItem, i: number) => i !== index)
    }));
    setRemovingItem(null);
  };

  const goTo = (index: number) => {
    setStep(index);
    // Scrolls whichever container holds the form, page or drawer.
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
        onSaved(response.data.data?._id);
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to save requisition', 'error');
    } finally {
      setLoading(false);
    }
  };

  /** "Save draft" from the close prompt. A draft still needs a title, so send the user to it. */
  const saveDraftAndClose = async () => {
    if (!formData.title.trim()) {
      setConfirmClose(false);
      goTo(0);
      showToast('Add a title to save this as a draft', 'error');
      return;
    }
    // On success onSaved closes the drawer; on failure the prompt stays for another try.
    await handleSave(false);
  };

  return (
    <div ref={topRef} className="scroll-mt-6">
      <FormSteps steps={STEPS} current={step} onSelect={goTo} variant="track" />

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
        className="space-y-6"
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
              onClick={() => setEditingItem('new')}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          {formData.items.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-300 rounded-xl">
              <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No items yet.</p>
              <button
                type="button"
                onClick={() => setEditingItem('new')}
                className="mt-3 text-sm text-primary font-medium hover:underline"
              >
                Add the first item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">#</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Category</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Est. unit</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Line total</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item: RequisitionItem, index: number) => {
                    const lineTotal = (Number(item.estimatedUnitPrice) || 0) * (Number(item.quantity) || 0);
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-500 tabular-nums">{index + 1}</td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-900">
                          {item.description}
                          {item.specification && <span className="block text-xs text-gray-500">{item.specification}</span>}
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100 text-gray-700">{getCategoryName(item.category)}</td>
                        <td className="py-2 px-3 border-b border-gray-100 text-right tabular-nums whitespace-nowrap">{item.quantity} {item.unit}</td>
                        <td className="py-2 px-3 border-b border-gray-100 text-right tabular-nums whitespace-nowrap">
                          {Number(item.estimatedUnitPrice) ? formatCurrency(Number(item.estimatedUnitPrice), getCurrentSbuCurrency()) : '—'}
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100 text-right tabular-nums font-medium whitespace-nowrap">
                          {lineTotal ? formatCurrency(lineTotal, getCurrentSbuCurrency()) : '—'}
                        </td>
                        <td className="py-2 px-3 border-b border-gray-100">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingItem(index)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => setRemovingItem(index)}
                              className="px-2 py-1 text-xs border border-red-200 rounded hover:bg-red-50 text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

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
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Category</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Est. unit</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items
                    .filter((item: any) => item.description.trim())
                    .map((item: any, index: number) => {
                      const lineTotal = (Number(item.estimatedUnitPrice) || 0) * (Number(item.quantity) || 0);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="py-2 px-3 border-b border-gray-100 text-gray-900">
                            {item.description}
                            {item.specification && <span className="block text-xs text-gray-500">{item.specification}</span>}
                          </td>
                          <td className="py-2 px-3 border-b border-gray-100 text-gray-700">{getCategoryName(item.category)}</td>
                          <td className="py-2 px-3 border-b border-gray-100 text-right tabular-nums">{item.quantity} {item.unit}</td>
                          <td className="py-2 px-3 border-b border-gray-100 text-right tabular-nums">
                            {Number(item.estimatedUnitPrice) ? formatCurrency(Number(item.estimatedUnitPrice), getCurrentSbuCurrency()) : '—'}
                          </td>
                          <td className="py-2 px-3 border-b border-gray-100 text-right tabular-nums font-medium">
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
          onCancel={requestClose}
          finishLabel={loading ? 'Submitting...' : 'Submit for Approval'}
          submitting={loading}
          size="sm"
          extra={
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3 py-[7px] text-sm border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
          }
        />
      </form>

      {editingItem !== null && (
        <RequisitionItemDrawer
          item={editingItem === 'new' ? null : formData.items[editingItem]}
          onClose={() => setEditingItem(null)}
          onSubmit={saveItem}
        />
      )}

      <ConfirmModal
        isOpen={removingItem !== null}
        onClose={() => setRemovingItem(null)}
        onConfirm={() => removingItem !== null && removeItem(removingItem)}
        title="Delete this item?"
        message={
          removingItem !== null
            ? `"${formData.items[removingItem]?.description}" will be removed from this requisition.`
            : ''
        }
        confirmText="Delete"
      />

      <Modal
        isOpen={confirmClose}
        onClose={() => !loading && setConfirmClose(false)}
        size="sm"
        title="Save this requisition?"
        footer={
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="mr-auto px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setConfirmClose(false)}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={saveDraftAndClose}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save draft'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          You have unsaved changes. Save them as a draft to finish later, or discard them.
        </p>
      </Modal>
    </div>
  );
});

export default RequisitionForm;

