import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import api from '../../lib/api';
import { Loader2, FileText, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EquipmentDetailsView from '../../components/EquipmentDetailsView';
import QuoteLinePhotos from '../../components/QuoteLinePhotos';
import { CURRENCIES, formatCurrency } from '../../lib/constants';
import { getCurrentSbuCurrency } from '../../lib/sbu';
import { FormSteps, FormStepNav } from '../../components/FormSteps';

const STEPS = [
  { label: 'Prices', description: 'A unit price for every item' },
  { label: 'Terms', description: 'Delivery, payment and validity' },
  { label: 'Review & submit', description: 'Check before it is sealed' }
];

export default function SubmitQuotation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const rfqId = searchParams.get('rfq');
  
  const [loading, setLoading] = useState<any>(true);
  const [submitting, setSubmitting] = useState<any>(false);
  const [rfq, setRFQ] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<any>({
    // Quote in the buying business unit's own currency unless the supplier changes it.
    currency: getCurrentSbuCurrency(),
    deliveryDays: 7,
    paymentTerms: 'Net 30',
    validityDays: 30,
    notes: '',
    items: []
  });

  useEffect(() => {
    if (rfqId) {
      fetchRFQ();
    } else {
      navigate('/app/my-rfqs');
    }
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
            unitPrice: 0,
            brand: '',
            notes: ''
          }))
        });
      }
    } catch (error: any) {
      showToast('Failed to load RFQ details', 'error');
      navigate('/app/my-rfqs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

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

  const validateStep = (index: number) => {
    if (index === 0) {
      const invalidItems = formData.items.filter((item: any) => !item.unitPrice || item.unitPrice <= 0);
      if (invalidItems.length > 0) {
        showToast('Please enter unit price for all items', 'error');
        return false;
      }
    }
    if (index === 1) {
      if (!(formData.deliveryDays >= 1) || !(formData.validityDays >= 1)) {
        showToast('Delivery and validity must each be at least 1 day', 'error');
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
    try {
      // Validate
      if (!validateStep(0)) {
        setStep(0);
        return;
      }

      setSubmitting(true);
      await api.post('/supplier/quotations', {
        rfqId: rfqId,
        currency: formData.currency,
        deliveryPeriod: formData.deliveryDays,
        paymentTerms: formData.paymentTerms,
        validityPeriod: formData.validityDays,
        notes: formData.notes,
        items: formData.items.map((item: any) => ({
          rfqLineId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: parseFloat(item.unitPrice),
          totalPrice: item.quantity * parseFloat(item.unitPrice),
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

      showToast('Quotation submitted successfully', 'success');
      navigate('/app/my-rfqs', { replace: true });
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to submit quotation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        backTo="/app/my-rfqs"
        backLabel="Back to RFQs"
        title="Submit Quotation"
        subtitle={`For RFQ: ${rfq?.rfqNumber || `RFQ-${rfqId?.slice(-6).toUpperCase()}`}`}
      />

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

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <FormSteps steps={STEPS} current={step} onSelect={setStep} />

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
                >
                  {CURRENCIES.map((curr: any) => (
                    <option key={curr.code} value={curr.code}>{curr.code} - {curr.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items Pricing */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">Item Pricing</label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Item</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Qty</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Unit Price *</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Brand</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item: any, index: any) => (
                      <React.Fragment key={index}>
                      <tr>
                        <td className="py-2 px-3 border border-gray-200">
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
                        <td className="py-2 px-3 border border-gray-200 text-gray-600">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 px-3 border border-gray-200">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e: any) => updateItemPrice(index, 'unitPrice', e.target.value)}
                            className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="py-2 px-3 border border-gray-200">
                          <input
                            type="text"
                            value={item.brand}
                            onChange={(e: any) => updateItemPrice(index, 'brand', e.target.value)}
                            className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                            placeholder="Brand name"
                          />
                        </td>
                        <td className="py-2 px-3 border border-gray-200 font-medium text-gray-900">
                          {formatCurrency(item.quantity * (parseFloat(item.unitPrice) || 0), formData.currency)}
                        </td>
                      </tr>
                      <tr className="bg-gray-50/60">
                        <td colSpan={5} className="px-4 pb-3">
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
                                />
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
                                />
                              </div>
                              <div className="md:col-span-2">
                                <QuoteLinePhotos
                                  attachments={item.quoteAttachments || []}
                                  onChange={(next: any[]) => updateItemPrice(index, 'quoteAttachments', next)}
                                  onError={(m: string) => showToast(m, 'error')}
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
                      <td className="py-2 px-3 border border-gray-200 text-lg font-bold text-primary">
                        {formatCurrency(calculateTotal(), formData.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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
                  value={formData.deliveryDays}
                  onChange={(e: any) => setFormData({ ...formData, deliveryDays: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e: any) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="Cash">Cash</option>
                  <option value="Net 7">Net 7</option>
                  <option value="Net 14">Net 14</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valid For (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.validityDays}
                  onChange={(e: any) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
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
              />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Currency</dt>
                <dd className="font-medium text-gray-900">{formData.currency}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Delivery</dt>
                <dd className="font-medium text-gray-900">{formData.deliveryDays} days</dd>
              </div>
              <div>
                <dt className="text-gray-500">Payment terms</dt>
                <dd className="font-medium text-gray-900">{formData.paymentTerms}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Valid for</dt>
                <dd className="font-medium text-gray-900">{formData.validityDays} days</dd>
              </div>
            </dl>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Item</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Qty</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Unit Price</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border border-primary whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item: any, index: any) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-2 px-3 border border-gray-200">
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
                      <td className="py-2 px-3 border border-gray-200 text-gray-600">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2 px-3 border border-gray-200 text-gray-600">
                        {formatCurrency(parseFloat(item.unitPrice) || 0, formData.currency)}
                      </td>
                      <td className="py-2 px-3 border border-gray-200 font-medium text-gray-900">
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
                    <td className="py-2 px-3 border border-gray-200 text-lg font-bold text-primary">
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
          onBack={() => setStep((s) => Math.max(s - 1, 0))}
          // Deferred so the Next button is not already the submit button
          // by the time the browser finishes handling this click.
          onNext={handleNext}
          onCancel={() => navigate('/app/my-rfqs')}
          finishLabel="Submit Quotation"
          submitting={submitting}
        />
      </form>
    </div>
  );
}
