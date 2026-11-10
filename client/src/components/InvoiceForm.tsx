import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { supplierAPI } from '../lib/api';
import { formatCurrency } from '../lib/constants';
import { getCurrentSbuCurrency } from '../lib/sbu';
import { useToast } from './Toast';
import Drawer from './Drawer';
import { ConfirmModal } from './Modal';
import { FormSteps, FormStepNav } from './FormSteps';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { validateInvoice, type InvoiceInput } from '@fossil/shared';
import FieldError from './FieldError';
import { serverFieldErrors, useFormValidation } from '../lib/useFormValidation';

const STEPS = [
  { label: 'Order & invoice', description: 'Which PO you are billing' },
  { label: 'Lines & VAT', description: 'What you are charging for' },
  { label: 'Review & submit', description: 'Check it against the PO' }
];

/** The step that shows a field, so a problem can be brought into view. */
const stepOfField = (field: string) => (field === 'items' || field.startsWith('items.') || field === 'vatAmount' ? 1 : 0);

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface InvoiceFormHandle {
  /** Close the form, first asking before anything entered is thrown away. */
  requestClose: () => void;
}

/**
 * The supplier's invoice against one of their purchase orders: order and
 * invoice number, lines and VAT, then a check against the PO. Hosted in a
 * drawer, so it reports back through callbacks rather than navigating away
 * itself. The host routes its close gestures (✕, Escape, backdrop) through
 * `requestClose`, so the form can ask before discarding what was entered.
 */
const InvoiceForm = forwardRef<InvoiceFormHandle, {
  /** Opened from a purchase order's "Submit invoice" step, the order is chosen already. */
  purchaseOrderId?: string | null;
  /** Close without submitting. */
  onCancel: () => void;
  /** Called once the invoice is submitted. */
  onSaved: () => void;
}>(function InvoiceForm({ purchaseOrderId: initialPurchaseOrderId, onCancel, onSaved }, ref) {
  const { showToast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [purchaseOrderId, setPurchaseOrderId] = useState(initialPurchaseOrderId || '');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [items, setItems] = useState<any[]>([]);
  const [vatAmount, setVatAmount] = useState<any>(0);
  // The VAT worked out from the PO below, so only a change to it counts as entered.
  const [suggestedVat, setSuggestedVat] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const selectedPo = orders.find((o) => o._id === purchaseOrderId);
  // An invoice is raised in the currency of the PO it bills.
  const selectedCurrency = selectedPo?.currency || getCurrentSbuCurrency();

  const poSubtotal = (selectedPo?.items || []).reduce(
    (s: number, i: any) => s + (Number(i.totalPrice) || Number(i.quantity) * Number(i.unitPrice) || 0),
    0
  );
  // The supplier's PO list carries the total but not the VAT, so the VAT is
  // whatever the total holds beyond the lines.
  const poVat = selectedPo ? Math.max(0, round2((Number(selectedPo.totalAmount) || 0) - poSubtotal)) : 0;
  const invoiceSubtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const invoiceTotal = invoiceSubtotal + (Number(vatAmount) || 0);

  const values: InvoiceInput = { purchaseOrderId, vendorInvoiceNumber, invoiceDate, items, vatAmount };
  const validation = useFormValidation(validateInvoice, values);
  // A problem with one line, shown under that line of the table.
  const lineError = (index: number) =>
    Object.entries(validation.errors).find(([field]) => field.startsWith(`items.${index}.`))?.[1];

  // Anything entered beyond the order the form was opened with.
  const dirty =
    purchaseOrderId !== (initialPurchaseOrderId || '') ||
    !!vendorInvoiceNumber.trim() ||
    invoiceDate !== today ||
    (Number(vatAmount) || 0) !== suggestedVat;

  // A stray click on the backdrop should not throw away a half-filled invoice.
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onCancel();
  };

  useImperativeHandle(ref, () => ({ requestClose }));

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const po = orders.find((o) => o._id === purchaseOrderId);
    if (po) {
      const lines = po.items.map((item: any, index: number) => ({
        description: item.description,
        quantity: item.quantityReceived || item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: (item.quantityReceived || item.quantity) * item.unitPrice,
        poItemIndex: index
      }));
      setItems(lines);
      // Start from the PO's VAT, in proportion to what is being billed.
      const subtotal = lines.reduce((s: number, i: any) => s + i.totalPrice, 0);
      const fullSubtotal = po.items.reduce(
        (s: number, i: any) => s + (Number(i.totalPrice) || Number(i.quantity) * Number(i.unitPrice) || 0),
        0
      );
      const vat =
        po.vatAmount != null
          ? Number(po.vatAmount) || 0
          : Math.max(0, (Number(po.totalAmount) || 0) - fullSubtotal);
      const suggested = fullSubtotal > 0 ? round2((vat * subtotal) / fullSubtotal) : 0;
      setVatAmount(suggested);
      setSuggestedVat(suggested);
    } else {
      setItems([]);
      setVatAmount(0);
      setSuggestedVat(0);
    }
  }, [purchaseOrderId, orders]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await supplierAPI.getMyPurchaseOrders();
      const payable = res.data.data.filter((o: any) =>
        ['issued', 'partially_received', 'completed'].includes(o.status)
      );
      setOrders(payable);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load purchase orders', 'error');
    } finally {
      setLoading(false);
    }
  };

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
    const failing = Object.keys(validateInvoice(values)).map(stepOfField).filter((s) => s <= through);
    if (!failing.length) return true;
    const first = Math.min(...failing);
    if (first !== step) goTo(first);
    validation.check();
    return false;
  };

  const handleNext = () => {
    if (checkThrough(step)) goTo(Math.min(step + 1, STEPS.length - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter on an earlier step moves forward instead of submitting.
    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }
    if (!checkThrough(STEPS.length - 1)) return;
    try {
      setSubmitting(true);
      await supplierAPI.submitInvoice({
        purchaseOrderId,
        vendorInvoiceNumber: vendorInvoiceNumber.trim(),
        invoiceDate,
        items,
        vatAmount: Number(vatAmount) || 0
      });
      showToast('Invoice submitted successfully', 'success');
      onSaved();
    } catch (error: any) {
      if (validation.fromServer(error)) {
        // Show the step holding the first field the server refused.
        const fields = Object.keys(serverFieldErrors(error) || {});
        const first = Math.min(...fields.map(stepOfField));
        if (first !== step) {
          setStep(first);
          scrollToTop();
        }
      } else {
        showToast(error.response?.data?.message || 'Failed to submit invoice', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const poTotal = Number(selectedPo?.totalAmount) || 0;
  const difference = round2(invoiceTotal - poTotal);
  const matches = Math.abs(difference) < 0.01;

  return (
    <div ref={topRef} className="scroll-mt-6">
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <FormSteps steps={STEPS} current={step} onSelect={goTo} variant="track" />

          <form ref={validation.formRef} onSubmit={handleSubmit} noValidate>
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Purchase order</label>
                  <select
                    value={purchaseOrderId}
                    onChange={(e) => setPurchaseOrderId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    {...validation.invalid('purchaseOrderId')}
                  >
                    <option value="">Select PO...</option>
                    {orders.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.poNumber} — {formatCurrency(o.totalAmount, o.currency || getCurrentSbuCurrency())} ({o.status})
                      </option>
                    ))}
                  </select>
                  <FieldError message={validation.errors.purchaseOrderId} />
                  {!orders.length && (
                    <p className="text-xs text-gray-500 mt-1">
                      No purchase orders are ready to invoice. An order can be invoiced once it has been issued to you.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Your invoice number</label>
                  <input
                    type="text"
                    value={vendorInvoiceNumber}
                    onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Vendor invoice #"
                    maxLength={50}
                    {...validation.invalid('vendorInvoiceNumber')}
                  />
                  <FieldError message={validation.errors.vendorInvoiceNumber} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Invoice date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    {...validation.invalid('invoiceDate')}
                  />
                  <FieldError message={validation.errors.invoiceDate} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Line items (from received quantities)</label>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Description</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Qty</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <React.Fragment key={i}>
                          <tr className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                            <td className="py-2 px-3 border-b border-gray-100">{item.description}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-right">{item.quantity}</td>
                            <td className="py-2 px-3 border-b border-gray-100 text-right">{formatCurrency(item.totalPrice, selectedCurrency)}</td>
                          </tr>
                          {lineError(i) && (
                            <tr>
                              <td colSpan={3} className="px-3 pb-2 border-b border-gray-100">
                                <FieldError message={`Line ${i + 1}: ${lineError(i)}`} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  <FieldError message={validation.errors.items} />
                  <p className="text-sm text-gray-500 mt-2">
                    Subtotal: {formatCurrency(invoiceSubtotal, selectedCurrency)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">VAT</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    {...validation.invalid('vatAmount')}
                  />
                  <FieldError message={validation.errors.vatAmount} />
                  <p className="text-xs text-gray-500 mt-1">
                    The purchase order carries {formatCurrency(poVat, selectedCurrency)} VAT. Charge the same, or the
                    invoice will not match.
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">Purchase order</dt>
                  <dd className="font-medium text-gray-900">{selectedPo?.poNumber}</dd>
                  <dt className="text-gray-500">Your invoice number</dt>
                  <dd className="font-medium text-gray-900">{vendorInvoiceNumber || '—'}</dd>
                  <dt className="text-gray-500">Invoice date</dt>
                  <dd className="font-medium text-gray-900">{invoiceDate}</dd>
                  <dt className="text-gray-500">Lines</dt>
                  <dd className="font-medium text-gray-900">{items.length}</dd>
                </dl>

                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap"></th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">Purchase order</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap">This invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100">Subtotal</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right">{formatCurrency(poSubtotal, selectedCurrency)}</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right">{formatCurrency(invoiceSubtotal, selectedCurrency)}</td>
                    </tr>
                    <tr className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                      <td className="py-2 px-3 border-b border-gray-100">VAT</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right">{formatCurrency(poVat, selectedCurrency)}</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right">{formatCurrency(Number(vatAmount) || 0, selectedCurrency)}</td>
                    </tr>
                    <tr className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors font-semibold">
                      <td className="py-2 px-3 border-b border-gray-100">Total</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right">{formatCurrency(poTotal, selectedCurrency)}</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right">{formatCurrency(invoiceTotal, selectedCurrency)}</td>
                    </tr>
                  </tbody>
                </table>

                {matches ? (
                  <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    The invoice total matches the purchase order.
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      The invoice is {formatCurrency(Math.abs(difference), selectedCurrency)}{' '}
                      {difference > 0 ? 'more' : 'less'} than the purchase order. That is expected when billing a partial
                      delivery; otherwise Finance will see a variance and may reject it. Go back to correct it if needed.
                    </span>
                  </div>
                )}
              </div>
            )}

            <FormStepNav
              current={step}
              total={STEPS.length}
              onBack={() => goTo(Math.max(step - 1, 0))}
              // Deferred so the Next button is not already the submit button
              // by the time the browser finishes handling this click.
              onNext={handleNext}
              onCancel={requestClose}
              finishLabel="Submit for three-way match"
              submitting={submitting}
              size="sm"
            />
          </form>
        </>
      )}

      <ConfirmModal
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={onCancel}
        title="Discard this invoice?"
        message="What you have entered will be lost."
        confirmText="Discard"
      />
    </div>
  );
});

/**
 * The invoice form in a drawer, for the supplier pages that offer "Submit
 * invoice". Close gestures go through the form, so it can ask before
 * discarding what was entered.
 */
export function SubmitInvoiceDrawer({ isOpen, purchaseOrderId, onClose, onSaved }: {
  isOpen: boolean;
  /** The order to bill, when the drawer is opened from one. */
  purchaseOrderId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formRef = useRef<InvoiceFormHandle>(null);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => formRef.current?.requestClose()}
      title="Submit invoice"
      size="xl"
    >
      {/* Mounted only while open, so each opening starts a fresh invoice. */}
      {isOpen && (
        <InvoiceForm ref={formRef} purchaseOrderId={purchaseOrderId} onCancel={onClose} onSaved={onSaved} />
      )}
    </Drawer>
  );
}

export default InvoiceForm;
