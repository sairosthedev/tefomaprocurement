import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { procurementAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { COO_POLICY_NOTE } from '../lib/cooApproval';
import { useToast } from './Toast';
import Drawer from './Drawer';
import { ConfirmModal } from './Modal';
import { FormSteps, FormStepNav } from './FormSteps';
import { Loader2, Search } from 'lucide-react';
import { todayKey, validatePurchaseOrder, type PurchaseOrderInput } from '@fossil/shared';
import FieldError from './FieldError';
import { serverFieldErrors, useFormValidation } from '../lib/useFormValidation';

const PICK_STEP = { label: 'Quotation', description: 'Which accepted quote to order' };
const ORDER_STEPS = [
  { label: 'Delivery', description: 'Where and when' },
  { label: 'Terms', description: 'Terms and notes' },
  { label: 'Review', description: 'Check, then create' }
];

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary';

type OrderFields = {
  deliveryAddress: { street: string; city: string; province: string; postalCode: string };
  expectedDeliveryDate: string;
  termsAndConditions: string;
  notes: string;
};

const EMPTY_FIELDS: OrderFields = {
  deliveryAddress: { street: '', city: '', province: '', postalCode: '' },
  expectedDeliveryDate: '',
  termsAndConditions: '',
  notes: ''
};

/** Delivery, terms and notes start from the quotation and its site, so the order needs little typing. */
function fieldsFromQuotation(quotation: any): OrderFields {
  const site = quotation.site || quotation.rfq?.site;
  return {
    deliveryAddress: {
      // An older site may hold its address as a single line of text.
      street: typeof site?.address === 'string' ? site.address : site?.address?.street || '',
      city: site?.address?.city || site?.city || '',
      province: site?.address?.province || site?.province || '',
      postalCode: site?.address?.postalCode || site?.postalCode || ''
    },
    expectedDeliveryDate: quotation.deliveryPeriod
      ? new Date(Date.now() + quotation.deliveryPeriod * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : '',
    termsAndConditions: quotation.paymentTerms || '',
    notes: quotation.notes || ''
  };
}

export interface PurchaseOrderFormHandle {
  /** Close the form, first asking before anything entered is thrown away. */
  requestClose: () => void;
}

/**
 * Raising a purchase order from an accepted quotation: delivery, terms, then a
 * review. Opened without a quotation it first lists the accepted quotations
 * that have no order yet. Hosted in a drawer, so it reports back through
 * callbacks; the host routes its close gestures through `requestClose`.
 */
const PurchaseOrderForm = forwardRef<PurchaseOrderFormHandle, {
  /** Opened from a quotation, the quotation is chosen already. */
  quotationId?: string | null;
  /** Close without creating. */
  onCancel: () => void;
  /** Called with the new order's id once it is created. */
  onSaved: (purchaseOrderId?: string) => void;
}>(function PurchaseOrderForm({ quotationId: initialQuotationId, onCancel, onSaved }, ref) {
  const { showToast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);
  const picking = !initialQuotationId;
  const steps = picking ? [PICK_STEP, ...ORDER_STEPS] : ORDER_STEPS;
  // Step numbers past the optional pick step.
  const first = picking ? 1 : 0;
  const [step, setStep] = useState(0);
  const [quotationId, setQuotationId] = useState(initialQuotationId || '');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(picking);
  const [filter, setFilter] = useState('');
  const [quotation, setQuotation] = useState<any>(null);
  const [loadingQuotation, setLoadingQuotation] = useState(!!initialQuotationId);
  const [fields, setFields] = useState<OrderFields>(EMPTY_FIELDS);
  const [prefilled, setPrefilled] = useState<OrderFields>(EMPTY_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // The lines are the loaded quotation's, so they are checked as well as what is typed.
  const values: PurchaseOrderInput = {
    quotationId,
    ...fields,
    items: quotation && quotation._id === quotationId ? quotation.items : undefined
  };
  const validation = useFormValidation(validatePurchaseOrder, values);

  /** The step that shows a field, so a problem can be brought into view. */
  const stepOfField = (field: string) => {
    if (field === 'quotationId') return 0;
    if (field === 'termsAndConditions' || field === 'notes') return first + 1;
    if (field === 'items' || field.startsWith('items.')) return first + 2;
    return first;
  };

  // The quotation's lines have no fields here, so their problems are listed on the review.
  const lineErrors = Object.entries(validation.errors)
    .filter(([field]) => field.startsWith('items.'))
    .map(([field, message]) => `Line ${Number(field.split('.')[1]) + 1}: ${message}`);

  // Anything entered beyond the quotation the form was opened with and what it filled in.
  const dirty =
    quotationId !== (initialQuotationId || '') || JSON.stringify(fields) !== JSON.stringify(prefilled);

  // A stray click on the backdrop should not throw away a half-filled order.
  const requestClose = () => {
    if (submitting) return;
    if (dirty) setConfirmClose(true);
    else onCancel();
  };

  useImperativeHandle(ref, () => ({ requestClose }));

  useEffect(() => {
    if (!picking) return;
    (async () => {
      try {
        const res = await procurementAPI.getQuotations({ status: 'accepted', withoutPurchaseOrder: 'true', limit: 100 });
        setCandidates(res.data.data);
      } catch (error: any) {
        showToast(error.response?.data?.message || 'Failed to load accepted quotations', 'error');
      } finally {
        setLoadingCandidates(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!quotationId) {
      setQuotation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingQuotation(true);
        const res = await procurementAPI.getQuotation(quotationId);
        if (cancelled) return;
        const q = res.data.data;
        setQuotation(q);
        const start = fieldsFromQuotation(q);
        setFields(start);
        setPrefilled(start);
      } catch (error: any) {
        if (!cancelled) showToast(error.response?.data?.message || 'Failed to load the quotation', 'error');
      } finally {
        if (!cancelled) setLoadingQuotation(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quotationId]);

  const scrollToTop = () => {
    // Scrolls whichever container holds the form, page or drawer.
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const goTo = (index: number) => {
    setStep(index);
    validation.reset();
    scrollToTop();
  };

  /**
   * Checks the steps up to and including `through`. When one has a problem it
   * is brought into view with its fields marked, and false is returned.
   */
  const checkThrough = (through: number) => {
    const failing = Object.keys(validatePurchaseOrder(values)).map(stepOfField).filter((s) => s <= through);
    if (!failing.length) return true;
    const firstFailing = Math.min(...failing);
    if (firstFailing !== step) goTo(firstFailing);
    validation.check();
    return false;
  };

  // The chosen quotation has loaded and has no order yet.
  const quotationReady = () => {
    if (!picking) return true;
    if (quotation?._id !== quotationId) {
      showToast('Choose the quotation to order', 'error');
      return false;
    }
    if (quotation.existingPurchaseOrder) {
      showToast(`This quotation already has ${quotation.existingPurchaseOrder.poNumber}`, 'error');
      return false;
    }
    return true;
  };

  const readyThrough = (through: number) => checkThrough(through) && quotationReady();

  const handleNext = () => {
    if (readyThrough(step)) goTo(Math.min(step + 1, steps.length - 1));
  };

  // Moving ahead by the step track checks each step passed over.
  const selectStep = (index: number) => {
    if (index > step && !readyThrough(index - 1)) return;
    goTo(index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter on an earlier step moves forward instead of creating the order.
    if (step < steps.length - 1) {
      handleNext();
      return;
    }
    if (!readyThrough(steps.length - 1)) return;
    try {
      setSubmitting(true);
      const created = await procurementAPI.createPurchaseOrder({ quotationId, ...fields });
      showToast('Purchase Order created — submit it for approval', 'success');
      onSaved(created.data?.data?._id);
    } catch (error: any) {
      if (validation.fromServer(error)) {
        // Show the step holding the first field the server refused.
        const refused = Object.keys(serverFieldErrors(error) || {});
        const firstRefused = Math.min(...refused.map(stepOfField));
        if (firstRefused !== step) {
          setStep(firstRefused);
          scrollToTop();
        }
      } else {
        showToast(error.response?.data?.message || 'Failed to create purchase order', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const setAddress = (key: keyof OrderFields['deliveryAddress'], value: string) =>
    setFields({ ...fields, deliveryAddress: { ...fields.deliveryAddress, [key]: value } });

  const shown = candidates.filter((q) => {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return [q.quotationNumber, q.supplier?.companyName, q.rfq?.rfqNumber, q.rfq?.title]
      .some((v) => String(v || '').toLowerCase().includes(term));
  });

  if (!picking && loadingQuotation && !quotation) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div ref={topRef} className="scroll-mt-6">
      <FormSteps steps={steps} current={step} onSelect={selectStep} variant="track" />

      <form ref={validation.formRef} onSubmit={handleSubmit} noValidate>
        {picking && step === 0 && (
          <div className="space-y-3">
            {loadingCandidates ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No accepted quotations are waiting for an order. A quotation can be ordered once it has been
                selected, authorized and accepted on its RFQ.
              </p>
            ) : (
              <>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search quotation, supplier or RFQ..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-[7px] text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                  {shown.map((q) => (
                    <label
                      key={q._id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                        quotationId === q._id ? 'bg-primary/[0.06]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="quotation"
                        checked={quotationId === q._id}
                        onChange={() => setQuotationId(q._id)}
                        className="text-primary focus:ring-primary"
                        {...validation.invalid('quotationId')}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          {q.quotationNumber} <span className="font-normal text-gray-500">· {q.supplier?.companyName || '—'}</span>
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {q.rfq?.rfqNumber}{q.rfq?.title ? ` · ${q.rfq.title}` : ''}
                        </p>
                      </div>
                      <span className="font-medium text-gray-900 whitespace-nowrap">
                        {formatCurrency(q.totalAmount || 0, q.currency || getCurrentSbuCurrency())}
                      </span>
                    </label>
                  ))}
                  {shown.length === 0 && (
                    <p className="text-sm text-gray-500 px-3 py-4">No accepted quotation matches “{filter}”.</p>
                  )}
                </div>
                <FieldError message={validation.errors.quotationId} />
                {loadingQuotation && (
                  <p className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading the quotation…
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {step === first && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Street</label>
                <input type="text" value={fields.deliveryAddress.street} onChange={(e) => setAddress('street', e.target.value)} className={INPUT} maxLength={200} {...validation.invalid('deliveryAddress.street')} />
                <FieldError message={validation.errors['deliveryAddress.street']} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input type="text" value={fields.deliveryAddress.city} onChange={(e) => setAddress('city', e.target.value)} className={INPUT} maxLength={80} {...validation.invalid('deliveryAddress.city')} />
                <FieldError message={validation.errors['deliveryAddress.city']} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Province</label>
                <input type="text" value={fields.deliveryAddress.province} onChange={(e) => setAddress('province', e.target.value)} className={INPUT} maxLength={80} {...validation.invalid('deliveryAddress.province')} />
                <FieldError message={validation.errors['deliveryAddress.province']} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                <input type="text" value={fields.deliveryAddress.postalCode} onChange={(e) => setAddress('postalCode', e.target.value)} className={INPUT} maxLength={20} {...validation.invalid('deliveryAddress.postalCode')} />
                <FieldError message={validation.errors['deliveryAddress.postalCode']} />
              </div>
            </div>
            <FieldError message={validation.errors.deliveryAddress} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Delivery Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fields.expectedDeliveryDate}
                onChange={(e) => setFields({ ...fields, expectedDeliveryDate: e.target.value })}
                min={todayKey()}
                className={INPUT}
                {...validation.invalid('expectedDeliveryDate')}
              />
              <FieldError message={validation.errors.expectedDeliveryDate} />
            </div>
          </div>
        )}

        {step === first + 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Terms & Conditions</label>
              <textarea
                value={fields.termsAndConditions}
                onChange={(e) => setFields({ ...fields, termsAndConditions: e.target.value })}
                rows={3}
                className={INPUT}
                maxLength={2000}
                {...validation.invalid('termsAndConditions')}
              />
              <FieldError message={validation.errors.termsAndConditions} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={fields.notes}
                onChange={(e) => setFields({ ...fields, notes: e.target.value })}
                rows={2}
                className={INPUT}
                maxLength={2000}
                {...validation.invalid('notes')}
              />
              <FieldError message={validation.errors.notes} />
            </div>
          </div>
        )}

        {step === first + 2 && (
          <div className="space-y-4">
            {/* Read-only summary from the quotation — no re-entry needed */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Supplier</p>
                <p className="font-medium text-gray-900">{quotation?.supplier?.companyName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                <p className="font-medium text-gray-900">{formatCurrency(quotation?.totalAmount || 0, quotation?.currency || getCurrentSbuCurrency())}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
                <p className="font-medium text-gray-900">{quotation?.paymentTerms || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Delivery Period</p>
                <p className="font-medium text-gray-900">{quotation?.deliveryPeriod ? `${quotation.deliveryPeriod} days` : '—'}</p>
              </div>
              <p className="col-span-2 text-xs text-gray-500">{COO_POLICY_NOTE}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Deliver to</p>
                <p className="font-medium text-gray-900">
                  {[
                    fields.deliveryAddress.street,
                    fields.deliveryAddress.city,
                    fields.deliveryAddress.province,
                    fields.deliveryAddress.postalCode
                  ].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Expected delivery</p>
                <p className="font-medium text-gray-900">
                  {fields.expectedDeliveryDate ? new Date(fields.expectedDeliveryDate).toLocaleDateString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                <p className="font-medium text-gray-900 whitespace-pre-line">{fields.notes || '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Terms &amp; Conditions</p>
                <p className="font-medium text-gray-900 whitespace-pre-line">{fields.termsAndConditions || '—'}</p>
              </div>
            </div>
            <FieldError message={validation.errors.items} />
            {lineErrors.map((message) => (
              <FieldError key={message} message={message} />
            ))}
          </div>
        )}

        <FormStepNav
          current={step}
          total={steps.length}
          onBack={() => goTo(Math.max(step - 1, 0))}
          onNext={handleNext}
          onCancel={requestClose}
          finishLabel="Create Purchase Order"
          submitting={submitting}
          size="sm"
        />
      </form>

      <ConfirmModal
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={onCancel}
        title="Discard this purchase order?"
        message="What you have entered will be lost."
        confirmText="Discard"
      />
    </div>
  );
});

/**
 * The purchase order form in a drawer, for the Purchase Orders list and a
 * quotation's "Create purchase order" step. Close gestures go through the
 * form, so it can ask before discarding what was entered.
 */
export function CreatePurchaseOrderDrawer({ isOpen, quotationId, onClose, onSaved }: {
  isOpen: boolean;
  /** The quotation to order, when the drawer is opened from one. */
  quotationId?: string | null;
  onClose: () => void;
  onSaved: (purchaseOrderId?: string) => void;
}) {
  const formRef = useRef<PurchaseOrderFormHandle>(null);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => formRef.current?.requestClose()}
      title="Create purchase order"
      subtitle="From an accepted quotation"
      size="lg"
    >
      {/* Mounted only while open, so each opening starts a fresh order. */}
      {isOpen && (
        <PurchaseOrderForm ref={formRef} quotationId={quotationId} onCancel={onClose} onSaved={onSaved} />
      )}
    </Drawer>
  );
}

export default PurchaseOrderForm;
