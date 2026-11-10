import React, { useState } from 'react';
import { UNITS_OF_MEASUREMENT, PACKAGE_TYPES, formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { ItemSelect, type CatalogItem } from './ItemSelect';
import EquipmentDetailsPanel from './EquipmentDetailsPanel';
import Drawer from './Drawer';
import FieldError from './FieldError';
import { TEXT_LIMITS, categoryNeedsEquipmentDetails, validateRequisitionLine } from '@fossil/shared';
import { useFormValidation } from '../lib/useFormValidation';

export const emptyItem = () => ({
  description: '',
  // Set from the catalogue item when one is picked. Stores categorises the
  // rest during review; requesters are not asked for it.
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

export type RequisitionItem = ReturnType<typeof emptyItem>;

/** A line while it is being typed: the quantity box holds whatever was entered. */
type DraftItem = Omit<RequisitionItem, 'quantity'> & { quantity: number | string };

/** One line as the API takes it, which is also what the shared validator checks. */
export const linePayload = (item: DraftItem) => ({
  itemId: item.catalogItem?._id,
  description: item.description,
  category: item.category,
  package: item.package,
  quantity: item.quantity,
  unit: item.unit,
  estimatedUnitPrice: item.estimatedUnitPrice,
  specification: item.specification,
  equipment: item.equipment,
  attachments: item.attachments
});

/**
 * A line without its photos' contents. The form watches its values for
 * changes, and a few inline images would make that slow on every keystroke.
 */
export const withoutFileData = (item: DraftItem) => ({
  ...item,
  catalogItem: item.catalogItem?._id || null,
  attachments: (item.attachments || []).map(({ fileData, ...rest }: any) => ({
    ...rest,
    size: String(fileData || '').length
  }))
});

/**
 * One requisition line, added or edited in a drawer stacked over the
 * requisition form. Works on a copy, so Cancel leaves the line as it was.
 * Mount it only while open; it takes its starting values on mount.
 */
export default function RequisitionItemDrawer({ item, onClose, onSubmit }: {
  /** The line to edit, or null to add a new one. */
  item: RequisitionItem | null;
  onClose: () => void;
  onSubmit: (item: RequisitionItem) => void;
}) {
  const isEdit = !!item;
  const [draft, setDraft] = useState<DraftItem>(() =>
    item ? { ...item, equipment: { ...(item.equipment || {}) }, attachments: [...(item.attachments || [])] } : emptyItem()
  );
  // The validator reads the draft itself; the hook is given a light copy to watch.
  const validation = useFormValidation(() => validateRequisitionLine(linePayload(draft)), withoutFileData(draft));

  const update = (patch: Partial<DraftItem>) => setDraft((current) => ({ ...current, ...patch }));

  const lineTotal = (Number(draft.estimatedUnitPrice) || 0) * (Number(draft.quantity) || 0);

  const submit = () => {
    if (!validation.check()) return;
    onSubmit({ ...draft, description: draft.description.trim(), quantity: Number(draft.quantity) });
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <Drawer
      isOpen
      onClose={onClose}
      size="md"
      title={isEdit ? 'Item details' : 'Add item'}
      subtitle={isEdit ? 'Change anything, then save.' : 'Find it in the stores catalogue, or add it if it is not there.'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
          >
            {isEdit ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      {/* Rendered in a portal, but React still bubbles its events to the
          requisition form; keep Enter here from moving that form on a step. */}
      <div
        ref={validation.formRef}
        className="grid grid-cols-2 gap-4"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
        }}
      >
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Item <span className="text-red-500">*</span>
          </label>
          <ItemSelect
            value={draft.catalogItem}
            freeTextValue={draft.description}
            onChange={(catalogItem) => {
              update({
                catalogItem,
                description: catalogItem?.name || draft.description,
                // A catalogue item brings its category; a new item leaves it to stores.
                category: catalogItem?.category || '',
                unit: catalogItem?.unit
                  ? catalogItem.unit.charAt(0).toUpperCase() + catalogItem.unit.slice(1)
                  : draft.unit
              });
            }}
            onFreeText={(text) => update({ description: text, category: '' })}
            placeholder="Search the stores catalogue…"
            className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            invalid={!!validation.errors.description}
          />
          <FieldError message={validation.errors.description} />
          {!draft.catalogItem && draft.description.trim() && !validation.errors.description && (
            <p className="text-xs text-gray-500 mt-1">New item: stores will check for it and categorise it.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Package</label>
          <select
            value={draft.package}
            onChange={(e) => update({ package: e.target.value })}
            className={`${inputClass} bg-white`}
            {...validation.invalid('package')}
          >
            <option value="">— Select —</option>
            {PACKAGE_TYPES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {validation.errors.package ? (
            <FieldError message={validation.errors.package} />
          ) : (
            <p className="text-xs text-gray-400 mt-1">The container or pack form the item comes in.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
          <input
            type="number"
            min="1"
            step="1"
            value={draft.quantity}
            onChange={(e) => update({ quantity: e.target.value })}
            className={inputClass}
            {...validation.invalid('quantity')}
          />
          <FieldError message={validation.errors.quantity} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
          <select
            value={draft.unit}
            onChange={(e) => update({ unit: e.target.value })}
            className={`${inputClass} bg-white`}
            {...validation.invalid('unit')}
          >
            {UNITS_OF_MEASUREMENT.map((unit: any) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
          {validation.errors.unit ? (
            <FieldError message={validation.errors.unit} />
          ) : (
            <p className="text-xs text-gray-400 mt-1">How the quantity is measured, e.g. Each, Kg, Litre.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Est. unit price <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.estimatedUnitPrice}
            onChange={(e) => update({ estimatedUnitPrice: e.target.value })}
            placeholder="0.00"
            className={inputClass}
            {...validation.invalid('estimatedUnitPrice')}
          />
          <FieldError message={validation.errors.estimatedUnitPrice} />
        </div>

        <div className="col-span-2 flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50">
          <span className="text-gray-500">Line total</span>
          <span className="font-medium text-gray-900 tabular-nums">
            {lineTotal ? formatCurrency(lineTotal, getCurrentSbuCurrency()) : '—'}
          </span>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Specification <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <input
            type="text"
            value={draft.specification}
            onChange={(e) => update({ specification: e.target.value })}
            placeholder="e.g., 80gsm white"
            maxLength={TEXT_LIMITS.long}
            className={inputClass}
            {...validation.invalid('specification')}
          />
          <FieldError message={validation.errors.specification} />
        </div>

        {/* The panel spans a 12-column grid of its own. */}
        <div className="col-span-2 grid grid-cols-12">
          <EquipmentDetailsPanel
            equipment={draft.equipment || {}}
            attachments={draft.attachments || []}
            onEquipmentChange={(key, value) =>
              setDraft((current) => ({ ...current, equipment: { ...(current.equipment || {}), [key]: value } }))
            }
            onAttachmentsChange={(attachments) => update({ attachments })}
            defaultOpen={categoryNeedsEquipmentDetails(draft.category)}
            errors={validation.errors}
          />
        </div>
      </div>
    </Drawer>
  );
}
