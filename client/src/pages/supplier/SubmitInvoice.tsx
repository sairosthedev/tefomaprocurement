import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supplierAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/constants';
import { getCurrentSbuCurrency } from '../../lib/sbu';
import { useToast } from '../../components/Toast';
import PageHeader from '../../components/PageHeader';
import { FormSteps, FormStepNav } from '../../components/FormSteps';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

const STEPS = [
  { label: 'Order & invoice', description: 'Which PO you are billing' },
  { label: 'Lines & VAT', description: 'What you are charging for' },
  { label: 'Review & submit', description: 'Check it against the PO' }
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function SubmitInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  // Opened from a purchase order's "Submit invoice" step, the order is chosen already.
  const [purchaseOrderId, setPurchaseOrderId] = useState(searchParams.get('po') || '');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<any[]>([]);
  const [vatAmount, setVatAmount] = useState<any>(0);
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

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

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
      setVatAmount(fullSubtotal > 0 ? round2((vat * subtotal) / fullSubtotal) : 0);
    } else {
      setItems([]);
      setVatAmount(0);
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

  const validateStep = (index: number) => {
    if (index === 0) {
      if (!purchaseOrderId) {
        showToast('Select the purchase order you are billing', 'error');
        return false;
      }
      if (!invoiceDate) {
        showToast('Enter the invoice date', 'error');
        return false;
      }
    }
    if (index === 1) {
      if (!items.length) {
        showToast('Select a PO and add line items', 'error');
        return false;
      }
      if ((Number(vatAmount) || 0) < 0) {
        showToast('VAT cannot be negative', 'error');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter on an earlier step moves forward instead of submitting.
    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }
    if (!purchaseOrderId || !items.length) {
      showToast('Select a PO and add line items', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await supplierAPI.submitInvoice({
        purchaseOrderId,
        vendorInvoiceNumber,
        invoiceDate,
        items,
        vatAmount: Number(vatAmount) || 0
      });
      showToast('Invoice submitted successfully', 'success');
      navigate('/app/my-invoices');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit invoice', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const poTotal = Number(selectedPo?.totalAmount) || 0;
  const difference = round2(invoiceTotal - poTotal);
  const matches = Math.abs(difference) < 0.01;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        backTo="/app/my-invoices"
        backLabel="Back"
        title="Submit invoice"
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6">
          <FormSteps steps={STEPS} current={step} onSelect={setStep} />

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Purchase order</label>
                <select
                  value={purchaseOrderId}
                  onChange={(e) => setPurchaseOrderId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select PO...</option>
                  {orders.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.poNumber} — {formatCurrency(o.totalAmount, o.currency || getCurrentSbuCurrency())} ({o.status})
                    </option>
                  ))}
                </select>
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
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Invoice date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
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
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Description</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Qty</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2 px-3 border border-gray-200">{item.description}</td>
                        <td className="text-right py-2.5 px-4">{item.quantity}</td>
                        <td className="text-right py-2.5 px-4">{formatCurrency(item.totalPrice, selectedCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                />
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
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap"></th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">Purchase order</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-600 uppercase tracking-wide bg-gray-50 border border-gray-300 whitespace-nowrap">This invoice</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-3 border border-gray-200">Subtotal</td>
                    <td className="text-right py-2.5 px-4">{formatCurrency(poSubtotal, selectedCurrency)}</td>
                    <td className="text-right py-2.5 px-4">{formatCurrency(invoiceSubtotal, selectedCurrency)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-2 px-3 border border-gray-200">VAT</td>
                    <td className="text-right py-2.5 px-4">{formatCurrency(poVat, selectedCurrency)}</td>
                    <td className="text-right py-2.5 px-4">{formatCurrency(Number(vatAmount) || 0, selectedCurrency)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50 font-semibold">
                    <td className="py-2 px-3 border border-gray-200">Total</td>
                    <td className="text-right py-2.5 px-4">{formatCurrency(poTotal, selectedCurrency)}</td>
                    <td className="text-right py-2.5 px-4">{formatCurrency(invoiceTotal, selectedCurrency)}</td>
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
            onBack={() => setStep((s) => Math.max(s - 1, 0))}
            // Deferred so the Next button is not already the submit button
            // by the time the browser finishes handling this click.
            onNext={handleNext}
            onCancel={() => navigate('/app/my-invoices')}
            finishLabel="Submit for three-way match"
            submitting={submitting}
          />
        </form>
      )}
    </div>
  );
}
