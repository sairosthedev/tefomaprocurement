import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useToast } from './Toast';
import api from '../lib/api';
import { Loader2, AlertTriangle } from 'lucide-react';
import EquipmentDetailsView from './EquipmentDetailsView';
import QuoteLinePhotos from './QuoteLinePhotos';
import { CURRENCIES, formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { FormSteps, FormStepNav } from './FormSteps';
import { ConfirmModal } from './Modal';
import Drawer from './Drawer';
import FactsCard from './supplier/FactsCard';
import FieldError from './FieldError';
import { serverFieldErrors, useFormValidation } from '../lib/useFormValidation';
import { TEXT_LIMITS, firstError, hasErrors, lineField, validateQuotation, type FieldErrors } from '@fossil/shared';

const STEPS = [
  { label: 'Prices', description: 'A unit price for every item' },
  { label: 'Terms', description: 'Delivery, payment and validity' },
  { label: 'Review & submit', description: 'Check before it is sealed' }
];

// Terms a new quotation starts with; changing any of them counts as unsaved work.
const DEFAULT_TERMS = { deliveryDays: 7, paymentTerms: 'Net 30', validityDays: 30 };

const STEP_PRICES = 0;
const STEP_TERMS = 1;
const TERM_FIELDS = ['deliveryPeriod', 'paymentTerms', 'validityPeriod', 'notes'];

/** The step a field is entered on, so a refused field can be shown; -1 for none. */
function stepOfField(field: string): number {
  if (field === 'currency' || field === 'items' || field.startsWith('items.')) return STEP_PRICES;
  return TERM_FIELDS.includes(field) ? STEP_TERMS : -1;
}

/** A typed number as a number, so the API gets one; anything else as it was, for the check to name. */
const asNumber = (value: any) =>
  typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value;

export interface QuotationFormHandle {
  /** Close the form, first asking to discard when anything has been entered. */
  requestClose: () => void;
}

/**
 * A supplier's quotation for one RFQ: prices, terms, then review. Hosted in a
 * drawer on the supplier's RFQ pages, so it reports back through callbacks
 * rather than navigating away itself. The host routes its close gestures (✕,
 * Escape, backdrop) through `requestClose`, so entered prices are not lost.
 */
const QuotationForm = forwardRef<QuotationFormHandle, {
  rfqId: string;
  /** Close without submitting. Also called when the RFQ cannot be loaded. */
  onCancel: () => void;
  /** Called once the quotation is submitted. */
  onSaved: () => void;
}>(function QuotationForm({ rfqId, onCancel, onSaved }, ref) {
  const { showToast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState<any>(true);
  const [submitting, setSubmitting] = useState<any>(false);
  const [rfq, setRFQ] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const [formData, setFormData] = useState<any>({
    // Quote in the buying business unit's own currency unless the supplier changes it.
    currency: getCurrentSbuCurrency(),
    ...DEFAULT_TERMS,
    notes: '',
    items: []
  });

  useEffect(() => {
    fetchRFQ();
  }, [rfqId]);

  const fetchRFQ = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/supplier/rfqs/${rfqId}`);
      if (response.data.success) {
        const rfqData = response.data.data;
        setRFQ(rfqData);
        setFormData({
          ...formData,
          items: rfqData.items.map((item: any) => ({
            itemId: item._id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            // Carried for display so the supplier can price against the exact machine
            specifications: item.specifications,
            equipment: item.equipment,
            attachments: item.attachments,
            unitPrice: '',
            brand: '',
            notes: ''
          }))
        });
      }
    } catch (error: any) {
      showToast('Failed to load RFQ details', 'error');
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  // Anything the supplier has typed: a price or detail on any line, or terms
  // moved off their defaults.
  const dirty =
    formData.items.some(
      (item: any) =>
        Number(item.unitPrice) > 0 ||
        !!item.brand?.trim() ||
        !!item.isAlternative ||
        (item.quoteAttachments || []).length > 0
    ) ||
    formData.currency !== getCurrentSbuCurrency() ||
    String(formData.deliveryDays) !== String(DEFAULT_TERMS.deliveryDays) ||
    formData.paymentTerms !== DEFAULT_TERMS.paymentTerms ||
    String(formData.validityDays) !== String(DEFAULT_TERMS.validityDays) ||
    !!formData.notes.trim();

  // A stray click on the backdrop should not throw away entered prices, and
  // closing mid-submit would hide whether the quotation went in.
  const requestClose = () => {
    if (submitting) return;
    if (dirty) setConfirmClose(true);
    else onCancel();
  };

  useImperativeHandle(ref, () => ({ requestClose }));

  const updateItemPrice = (index: any, field: any, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum: any, item: any) =>
      sum + (item.quantity * (parseFloat(item.unitPrice) || 0)), 0
    );
  };

  // What is sent to the API, and what the shared check reads.
  const toPayload = (data: any) => ({
    rfqId: rfqId,
    currency: data.currency,
    deliveryPeriod: asNumber(data.deliveryDays),
    paymentTerms: data.paymentTerms,
    validityPeriod: asNumber(data.validityDays),
    notes: data.notes,
    items: data.items.map((item: any) => ({
      rfqLineId: item.itemId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: asNumber(item.unitPrice),
      totalPrice: item.quantity * (parseFloat(item.unitPrice) || 0),
      brand: item.brand,
      notes: item.notes,
      vatIncluded: false,
      isAlternative: Boolean(item.isAlternative),
      alternativeDescription: item.alternativeDescription,
      alternativePartNumber: item.alternativePartNumber,
      attachments: item.quoteAttachments
    })),
    totalAmount: calculateTotal()
  });

  const validation = useFormValidation(validateQuotation, toPayload(formData));

  /** Moves to a step. Its messages start afresh unless `keepMessages`, as when showing a refused field. */
  const goTo = (index: number, keepMessages = false) => {
    if (!keepMessages) validation.reset();
    setStep(index);
    // Scrolls whichever container holds the form, page or drawer.
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  /** Opens the earliest step holding a refused field. False when no step shows one. */
  const openStepWithError = (errors: FieldErrors): boolean => {
    const steps = Object.keys(errors).map(stepOfField).filter((s) => s >= 0);
    if (steps.length === 0) return false;
    const target = Math.min(...steps);
    if (target !== step) goTo(target, true);
    return true;
  };

  // Next checks this step's fields; later steps wait their turn.
  const handleNext = () => {
    const payload = toPayload(formData);
    const errors = validateQuotation(payload);
    if (Object.keys(errors).some((field) => stepOfField(field) === step)) {
      validation.check(payload);
      return;
    }
    goTo(Math.min(step + 1, STEPS.length - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter on an earlier step moves forward instead of submitting.
    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }
    const payload = toPayload(formData);
    const errors = validateQuotation(payload);
    if (hasErrors(errors)) {
      if (!openStepWithError(errors)) showToast(firstError(errors), 'error');
      validation.check(payload);
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/supplier/quotations', payload);

      showToast('Quotation submitted successfully', 'success');
      onSaved();
    } catch (error: any) {
      // Field errors show under their field, on its step; anything else is a toast.
      const fields = serverFieldErrors(error);
      if (fields && openStepWithError(fields)) validation.fromServer(error);
      else showToast(error.response?.data?.message || 'Failed to submit quotation', 'error');
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
      <FormSteps steps={STEPS} current={step} onSelect={goTo} variant="track" />

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Important Notice</p>
            <p className="text-sm text-amber-600">
              Once submitted, your quotation cannot be edited. Please review all prices carefully before submitting.
            </p>
          </div>
        </div>
      </div>

      <form ref={validation.formRef} onSubmit={handleSubmit} noValidate>
        <div className="space-y-6">
        {/* RFQ Info */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 mb-2">{rfq?.title}</h3>
          <p className="text-sm text-gray-600">{rfq?.description}</p>
        </div>

        {step === 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e: any) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  {...validation.invalid('currency')}
                >
                  {CURRENCIES.map((curr: any) => (
                    <option key={curr.code} value={curr.code}>{curr.code} - {curr.name}</option>
                  ))}
                </select>
                <FieldError message={validation.errors.currency} />
              </div>
            </div>

            {/* Items Pricing */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">Item Pricing</label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit Price *</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Brand</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item: any, index: any) => (
                      <React.Fragment key={index}>
                      {/* The item and its alternative-part row share one stripe, divided from the next item only. */}
                      <tr className={index % 2 ? 'bg-primary/[0.035]' : 'bg-white'}>
                        <td className="py-2 px-3">
                          <p className="font-medium text-gray-900">{item.description}</p>
                          {item.specifications && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.specifications}</p>
                          )}
                          <EquipmentDetailsView
                            equipment={item.equipment}
                            attachments={item.attachments}
                            compact
                          />
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e: any) => updateItemPrice(index, 'unitPrice', e.target.value)}
                            className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                            placeholder="0.00"
                            {...validation.invalid(lineField('items', index, 'unitPrice'))}
                          />
                          <FieldError
                            className="max-w-[9rem]"
                            message={
                              validation.errors[lineField('items', index, 'unitPrice')] ||
                              validation.errors[lineField('items', index, 'quantity')] ||
                              validation.errors[lineField('items', index, 'rfqLineId')]
                            }
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.brand}
                            onChange={(e: any) => updateItemPrice(index, 'brand', e.target.value)}
                            className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                            placeholder="Brand name"
                            maxLength={TEXT_LIMITS.name}
                            {...validation.invalid(lineField('items', index, 'brand'))}
                          />
                          <FieldError className="max-w-[9rem]" message={validation.errors[lineField('items', index, 'brand')]} />
                        </td>
                        <td className="py-2 px-3 font-medium text-gray-900">
                          {formatCurrency(item.quantity * (parseFloat(item.unitPrice) || 0), formData.currency)}
                        </td>
                      </tr>
                      <tr className={index % 2 ? 'bg-primary/[0.035]' : 'bg-white'}>
                        <td colSpan={5} className="px-3 pb-3 border-b border-gray-100">
                          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={Boolean(item.isAlternative)}
                              onChange={(e: any) => updateItemPrice(index, 'isAlternative', e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary/30"
                            />
                            I am offering an equivalent / alternative part for this line
                          </label>

                          {item.isAlternative && (
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  What are you supplying?
                                </label>
                                <input
                                  type="text"
                                  value={item.alternativeDescription || ''}
                                  onChange={(e: any) => updateItemPrice(index, 'alternativeDescription', e.target.value)}
                                  placeholder="e.g. Donaldson equivalent filter"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                  maxLength={TEXT_LIMITS.short}
                                  {...validation.invalid(lineField('items', index, 'alternativeDescription'))}
                                />
                                <FieldError message={validation.errors[lineField('items', index, 'alternativeDescription')]} />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                  Its part number
                                </label>
                                <input
                                  type="text"
                                  value={item.alternativePartNumber || ''}
                                  onChange={(e: any) => updateItemPrice(index, 'alternativePartNumber', e.target.value)}
                                  placeholder="e.g. P552100"
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                  maxLength={TEXT_LIMITS.name}
                                  {...validation.invalid(lineField('items', index, 'alternativePartNumber'))}
                                />
                                <FieldError message={validation.errors[lineField('items', index, 'alternativePartNumber')]} />
                              </div>
                              <div className="md:col-span-2">
                                <QuoteLinePhotos
                                  attachments={item.quoteAttachments || []}
                                  onChange={(next: any[]) => updateItemPrice(index, 'quoteAttachments', next)}
                                  error={validation.errors[lineField('items', index, 'attachments')]}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-4 text-right font-semibold text-gray-700">
                        Grand Total:
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-lg font-bold text-primary">
                        {formatCurrency(calculateTotal(), formData.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <FieldError message={validation.errors.items} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            {/* Quotation Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery (Days)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.deliveryDays}
                  onChange={(e: any) => setFormData({ ...formData, deliveryDays: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  {...validation.invalid('deliveryPeriod')}
                />
                <FieldError message={validation.errors.deliveryPeriod} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e: any) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  {...validation.invalid('paymentTerms')}
                >
                  <option value="Cash">Cash</option>
                  <option value="Net 7">Net 7</option>
                  <option value="Net 14">Net 14</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                </select>
                <FieldError message={validation.errors.paymentTerms} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valid For (Days)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.validityDays}
                  onChange={(e: any) => setFormData({ ...formData, validityDays: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  {...validation.invalid('validityPeriod')}
                />
                <FieldError message={validation.errors.validityPeriod} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e: any) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="Any additional information about your quotation..."
                maxLength={TEXT_LIMITS.long}
                {...validation.invalid('notes')}
              />
              <FieldError message={validation.errors.notes} />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <FactsCard
              facts={[
                { label: 'Currency', value: formData.currency },
                { label: 'Delivery', value: `${formData.deliveryDays} days` },
                { label: 'Payment terms', value: formData.paymentTerms },
                { label: 'Valid for', value: `${formData.validityDays} days` }
              ]}
            />

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Item</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Unit Price</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item: any, index: any) => (
                    <tr key={index} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {(item.brand || item.isAlternative) && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[
                              item.brand,
                              item.isAlternative &&
                                `Alternative: ${[item.alternativeDescription, item.alternativePartNumber].filter(Boolean).join(' · ') || 'details not given'}`
                            ]
                              .filter(Boolean)
                              .join(' — ')}
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-600">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-gray-600">
                        {formatCurrency(parseFloat(item.unitPrice) || 0, formData.currency)}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 font-medium text-gray-900">
                        {formatCurrency(item.quantity * (parseFloat(item.unitPrice) || 0), formData.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-4 text-right font-semibold text-gray-700">
                      Grand Total:
                    </td>
                    <td className="py-2 px-3 border-b border-gray-100 text-lg font-bold text-primary">
                      {formatCurrency(calculateTotal(), formData.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {formData.notes && (
              <div className="text-sm">
                <p className="text-gray-500">Notes</p>
                <p className="text-gray-900 whitespace-pre-line">{formData.notes}</p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              Once submitted, your quotation cannot be edited.
            </div>
          </div>
        )}
        </div>

        <FormStepNav
          current={step}
          total={STEPS.length}
          onBack={() => goTo(Math.max(step - 1, 0))}
          onNext={handleNext}
          onCancel={requestClose}
          finishLabel="Submit Quotation"
          submitting={submitting}
          size="sm"
        />
      </form>

      <ConfirmModal
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={onCancel}
        title="Discard this quotation?"
        message="The prices and terms you have entered will be lost."
        confirmText="Discard"
      />
    </div>
  );
});

/**
 * The quotation form in its drawer, for the supplier's RFQ pages. The form is
 * mounted only while open, so each opening starts from a fresh, unpriced copy
 * of the RFQ.
 */
export function SubmitQuotationDrawer({ isOpen, rfqId, rfq, onClose, onSaved }: {
  isOpen: boolean;
  rfqId: string | null | undefined;
  /** What the host already has of the RFQ, to name it in the drawer header. */
  rfq?: { rfqNumber?: string; title?: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formRef = useRef<QuotationFormHandle>(null);
  const subtitle = rfq && rfqId
    ? [rfq.rfqNumber || `RFQ-${rfqId.slice(-6).toUpperCase()}`, rfq.title].filter(Boolean).join(' · ')
    : undefined;

  return (
    <Drawer
      isOpen={isOpen && !!rfqId}
      // The form decides: it asks before discarding entered prices.
      onClose={() => formRef.current?.requestClose()}
      title="Submit quotation"
      subtitle={subtitle}
      size="xl"
    >
      {rfqId && (
        <QuotationForm key={rfqId} ref={formRef} rfqId={rfqId} onCancel={onClose} onSaved={onSaved} />
      )}
    </Drawer>
  );
}

export default QuotationForm;
