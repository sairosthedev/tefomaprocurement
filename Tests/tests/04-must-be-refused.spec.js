/**
 * "Must be refused" (QA guide): if any of these succeeds, report it as urgent.
 *
 * Each check is made twice where it can be: in the UI (the control is not
 * offered, or the step is blocked with a message) and against the API with
 * the request the control would have sent, because the Scope Document
 * (section 11) says hiding a button is never the only protection.
 *
 * The checks share one requisition that is walked forward through the UI, so
 * the tests run in order.
 */
const { test, expect } = require('../fixtures/test');
const { unitFor } = require('../data/units');
const { ApiClient } = require('../utils/apiClient');
const { qaTitle, runId, money, amountPattern } = require('../utils/testData');
const { requisitionFor, acceptForSourcing, publishRfq, quote } = require('../utils/flows');

/** A refusal: a 4xx status, never a success and never a server error. */
function expectRefused(res, message) {
  expect(res.ok, `${message}: ${JSON.stringify(res.body)}`).toBe(false);
  expect(res.status, message).toBeGreaterThanOrEqual(400);
  expect(res.status, message).toBeLessThan(500);
}

test.describe.serial('Must be refused', () => {
  // Several checks sign in as three or four roles in turn.
  test.describe.configure({ timeout: 600_000 });
  let unit;
  let req;
  let other;
  const doc = {};

  test.beforeAll(({}, testInfo) => {
    unit = unitFor(testInfo);
    // Below the COO limit, so the order is approved after Finance.
    req = requisitionFor(unit, 'refusal checks', { quantity: 2, estimatedUnitPrice: 50 });
    other = requisitionFor(unit, 'second department, other head');
  });

  test('An end user cannot approve their own requisition', async ({ signInAs }) => {
    const requester = await signInAs('requester');
    await requester.requisitions.open();
    doc.pr = await requester.requisitions.raise(req);
    const row = await requester.requisitions.expectRow(doc.pr, { status: 'Pending HOD Approval' });
    // No way to do it in the UI ...
    await expect(row.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    // ... and the API refuses the request the button would send.
    const api = await ApiClient.fromPage(requester.page);
    const list = await api.get(`department/requisitions?search=${encodeURIComponent(doc.pr)}`);
    doc.prId = (list.body.data || []).find((r) => r.requisitionNumber === doc.pr)?._id;
    expect(doc.prId, 'requisition id').toBeTruthy();
    expectRefused(await api.put(`department/requisitions/${doc.prId}/approve`, { comments: 'self approval' }), 'self approval');
    await api.dispose();
  });

  test("A department head cannot approve another department's requisition", async ({ signInAs }) => {
    const requester2 = await signInAs('requester2');
    await requester2.requisitions.open();
    doc.otherPr = await requester2.requisitions.raise(other);
    const api2 = await ApiClient.fromPage(requester2.page);
    const list = await api2.get(`department/requisitions?search=${encodeURIComponent(doc.otherPr)}`);
    const otherId = (list.body.data || []).find((r) => r.requisitionNumber === doc.otherPr)?._id;
    await api2.dispose();

    const head = await signInAs('head');
    await head.requisitions.open('team');
    await head.requisitions.expectAbsent(other.title);
    const api = await ApiClient.fromPage(head.page);
    expectRefused(await api.put(`department/requisitions/${otherId}/approve`, { comments: 'not my department' }), 'cross-department approval');
    await api.dispose();
  });

  test('A head rejects with a reason; the requester sees the reason', async ({ signInAs }) => {
    const reason = `Rejected for run ${other.id}: duplicate request`;
    const otherHead = await signInAs('otherHead');
    await otherHead.requisitions.open('team');
    await otherHead.requisitions.reject(doc.otherPr, reason);
    await otherHead.requisitions.expectRow(doc.otherPr, { status: 'Rejected' });

    const requester2 = await signInAs('requester2');
    await requester2.dashboard.open();
    await expect(requester2.dashboard.attentionItems().filter({ hasText: /reject/i }).first()).toBeVisible();
    await requester2.requisitions.open();
    await requester2.requisition.open(doc.otherPr, requester2.requisitions);
    await expect(requester2.page.getByText(reason)).toBeVisible();
  });

  test('Stores cannot forward a requisition with an uncategorised line', async ({ signInAs }) => {
    const head = await signInAs('head');
    await head.requisitions.open('team');
    await head.requisitions.approve(doc.pr);

    const stores = await signInAs('stores');
    await stores.storesReview.open();
    const drawer = await stores.storesReview.openReview(doc.pr);
    await stores.storesReview.expectForwardRefused(drawer);
    // Then do it properly so the checks below can go on.
    await stores.storesReview.categorise(drawer, req.items[0].description, req.items[0].category);
    await stores.storesReview.forward(drawer);
  });

  test('Bids are sealed until the RFQ closes', async ({ signInAs }) => {
    const buyer = await acceptForSourcing(signInAs, doc.pr);
    // Invite three, but only one will quote.
    const rfq = await publishRfq(buyer, req, unit.quotingSuppliers);
    Object.assign(doc, { rfqUrl: rfq.url, rfq: rfq.number });

    const winner = unit.quotingSuppliers[0];
    doc.unitPrice = money(40);
    await quote(signInAs, winner.email, doc.rfq, { unitPrices: [doc.unitPrice], deliveryDays: 4, notes: `Single quote, run ${req.id}` });

    await buyer.base.goto(doc.rfqUrl);
    await buyer.rfq.expectSealed();
    await buyer.base.goto('/app/quotations');
    // The search box does not match RFQ numbers, so page through the list.
    const sealedRow = (await buyer.base.findRow(doc.rfq)).first();
    await expect(sealedRow).toContainText('Sealed bid');
    await expect(sealedRow).not.toContainText(amountPattern(doc.unitPrice * 2));
  });

  test('An award with fewer than three quotes and no waiver is refused', async ({ signInAs }) => {
    const buyer = await signInAs('buyer');
    await buyer.base.goto(doc.rfqUrl);
    await buyer.rfq.closeAndReveal();
    await buyer.rfq.openQuotationOf(unit.quotingSuppliers[0].company);
    doc.quotationUrl = buyer.page.url();
    doc.quotationId = doc.quotationUrl.split('/').pop();
    await expect(buyer.page.getByText('1 quotations on this RFQ').or(buyer.page.getByText(/1 quotation/)).first()).toBeVisible();
    await expect(buyer.quotation.selectButton).toBeDisabled();

    const api = await ApiClient.fromPage(buyer.page);
    const rfqId = doc.rfqUrl.split('/').pop();
    doc.rfqId = rfqId;
    expectRefused(
      await api.put(`procurement/rfqs/${rfqId}/select-quotation`, { quotationId: doc.quotationId, justification: 'Only one quote' }),
      'award without three quotes or a waiver'
    );
    await api.dispose();
  });

  test('The Head of Procurement cannot authorise a quote they selected', async ({ signInAs }) => {
    const procHead = await signInAs('procHead');
    await procHead.base.goto(doc.quotationUrl);
    await procHead.quotation.approveWaiver(`Single source for run ${req.id}`);

    const api = await ApiClient.fromPage(procHead.page);
    const selected = await api.put(`procurement/rfqs/${doc.rfqId}/select-quotation`, {
      quotationId: doc.quotationId,
      justification: 'Selected by the Head of Procurement'
    });
    expect(selected.ok, JSON.stringify(selected.body)).toBe(true);
    const authorized = await api.put(`procurement/rfqs/${doc.rfqId}/authorize-quotation`, { quotationId: doc.quotationId });
    expectRefused(authorized, 'self authorisation');
    expect(authorized.body.message).toMatch(/someone else must authorize/i);
    await api.dispose();

    await procHead.authorizations.open();
    await expect(await procHead.authorizations.findRow(doc.rfq)).toContainText('You selected this');
  });

  // Known gap, found 11 Nov 2026: once the Head of Procurement has selected a
  // quote, the selection box is gone for everyone, so a buyer cannot select
  // again on screen; and the Head of Procurement may not authorise their own
  // selection. The award is stuck unless someone re-selects through the API.
  test('A buyer can re-select a quote the Head of Procurement selected', async ({ signInAs }) => {
    test.fail(true, 'Known gap: no way on screen to change a selection made by the Head of Procurement');
    const buyer = await signInAs('buyer');
    await buyer.base.goto(doc.quotationUrl);
    await expect(buyer.page.getByPlaceholder('Justification for selecting this quotation (required)')).toBeVisible({ timeout: 10_000 });
  });

  test('With a different selector, the award goes through', async ({ signInAs }) => {
    const justification = `Only supplier able to deliver, run ${req.id}`;
    // Re-select as the buyer through the API, which accepts it (see the gap above).
    const buyer = await signInAs('buyer');
    const api = await ApiClient.fromPage(buyer.page);
    const res = await api.put(`procurement/rfqs/${doc.rfqId}/select-quotation`, { quotationId: doc.quotationId, justification });
    expect(res.ok, JSON.stringify(res.body)).toBe(true);
    await api.dispose();
    await buyer.context.close();

    // The Head of Procurement sees the buyer's reason and can now authorise.
    const procHead = await signInAs('procHead');
    await procHead.base.goto(doc.quotationUrl);
    await expect(procHead.page.getByText(`Justification: ${justification}`)).toBeVisible();
    await procHead.quotation.authorize();
  });

  test('The COO cannot approve an order before Finance', async ({ signInAs }) => {
    const buyer = await signInAs('buyer');
    await buyer.base.goto(doc.quotationUrl);
    const quotationNumber = await buyer.quotation.quotationNumber();
    await buyer.quotation.accept();
    await buyer.purchaseOrders.open();
    await buyer.purchaseOrders.createFromQuotation({ quotationNumber, supplier: unit.quotingSuppliers[0].company });
    doc.poUrl = buyer.page.url();
    doc.poId = doc.poUrl.split('/').pop();
    doc.po = await buyer.purchaseOrder.poNumber();
    await buyer.purchaseOrder.submitForApproval();

    // Waiting for the Head of Procurement: the COO is refused.
    const coo = await signInAs('coo');
    const cooApi = await ApiClient.fromPage(coo.page);
    expectRefused(await cooApi.put(`coo/purchase-orders/${doc.poId}/approve`, { comments: 'too early' }), 'COO before Head of Procurement');

    const procHead = await signInAs('procHead');
    await procHead.base.goto(doc.poUrl);
    await procHead.purchaseOrder.approve();
    await procHead.purchaseOrder.expectStatus('Pending Finance');

    // Waiting for Finance: still refused, and no Approve button for the COO.
    expectRefused(await cooApi.put(`coo/purchase-orders/${doc.poId}/approve`, { comments: 'before finance' }), 'COO before Finance');
    await coo.base.goto(doc.poUrl);
    await expect(coo.purchaseOrder.approveButton).toHaveCount(0);
    await cooApi.dispose();

    const finance = await signInAs('finance');
    await finance.base.goto(doc.poUrl);
    await finance.purchaseOrder.approve();
    // Below the limit, the COO step is skipped.
    await finance.purchaseOrder.expectStatus('Approved');
  });

  test('An invoice whose VAT differs is flagged, and goods never received cannot be approved', async ({ signInAs }) => {
    const supplier = await signInAs(unit.quotingSuppliers[0].email);
    await supplier.supplierOrders.open();
    await supplier.supplierOrders.acknowledge(doc.po);
    await supplier.supplierInvoices.open();
    doc.invoice = await supplier.supplierInvoices.submit(doc.po, {
      vendorInvoiceNumber: `SUP-VAT-${req.id}`,
      vat: 15,
      expectMatch: false
    });

    const finance = await signInAs('finance');
    await finance.invoices.open();
    await finance.invoices.search('Search invoice number...', doc.invoice);
    await expect(finance.invoices.row(doc.invoice)).toContainText('Variance');
    await finance.invoices.openInvoice(doc.invoice);
    await expect(finance.invoices.matchBox()).toHaveClass(/bg-amber-50/);
    // No GRV: Approve is not offered, and the API refuses it.
    await expect(finance.page.getByText('None — stores has not receipted these goods')).toBeVisible();
    await expect(finance.page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    const api = await ApiClient.fromPage(finance.page);
    const invoiceId = finance.page.url().split('/').pop();
    const res = await api.put(`finance/invoices/${invoiceId}/approve`, { forceApprove: true, comments: 'force it' });
    expectRefused(res, 'invoice approved for goods never received');
    expect(res.body.message).toMatch(/GRV|receipt/i);
    await api.dispose();
  });

  test('Two requisitions submitted at the same moment get different numbers', async ({ signInAs }) => {
    const requester = await signInAs('requester');
    const api = await ApiClient.fromPage(requester.page);
    const id = runId();
    const body = (n) => ({
      title: qaTitle(`concurrent submit ${n}`, id),
      justification: 'Concurrency check',
      urgency: 'normal',
      status: 'draft',
      items: [{ description: qaTitle(`concurrency item ${n}`, id), quantity: 1, unit: 'Each', estimatedUnitPrice: 1 }]
    });
    const [a, b] = await Promise.all([api.post('department/requisitions', body(1)), api.post('department/requisitions', body(2))]);
    expect(a.ok, JSON.stringify(a.body)).toBe(true);
    expect(b.ok, JSON.stringify(b.body)).toBe(true);
    const numbers = [a.body.data?.requisitionNumber, b.body.data?.requisitionNumber];
    expect(numbers[0]).toBeTruthy();
    expect(numbers[0]).not.toBe(numbers[1]);
    await api.dispose();
  });

  test.fixme('Awarding a supplier whose KYS is incomplete is refused', async () => {
    // Needs a supplier on the unit that is invited but not spend-authorised.
    // None of the guide's test suppliers is set up that way; add one, invite
    // it with two others, have it win, and expect the authorisation to fail.
  });

  test.fixme('Stores cannot hand over more than is in stock', async () => {
    // Needs a store requisition for more than the shelf holds. Expect the
    // toast "Not enough stock here for: <item> (need n, have m) ... Nothing
    // was issued." and Inventory unchanged (StoreRequisitionsPage.expectHandOverRefused).
  });
});
