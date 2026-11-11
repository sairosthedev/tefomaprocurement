/**
 * The main run-through from the QA Testing Guide (steps 1 to 21), which is
 * the 20-step process in the Project Scope Document, section 6.
 *
 * It runs twice per unit: once with an order of USD 5,000 or more (the COO
 * approves) and once below (the COO step is skipped). Every step signs in as
 * the role that owns it and first checks that what the previous role entered
 * appears unchanged, then does its own step.
 */
const { test, expect } = require('../fixtures/test');
const { unitFor } = require('../data/units');
const { buildRunThrough } = require('../data/scenarios');

for (const band of ['above', 'below']) {
  test.describe.serial(`Main run-through, order ${band} the COO limit`, () => {
    /** @type {ReturnType<typeof buildRunThrough>} */
    let run;
    // Document numbers and addresses carried from one step to the next.
    const doc = {};

    test.beforeAll(({}, testInfo) => {
      run = buildRunThrough(unitFor(testInfo), band);
      testInfo.annotations.push({ type: 'run', description: run.id });
    });

    test.afterAll(({}, testInfo) => {
      // Write down each document number, as the guide asks.
      console.log(`[${testInfo.project.name} / ${band}] run ${run.id}:`, JSON.stringify(doc));
    });

    test('1. End user raises and submits the requisition', async ({ signInAs }) => {
      const requester = await signInAs('requester');
      await requester.requisitions.open();
      await expect(requester.requisitions.heading).toHaveText('My Requisitions');

      doc.pr = await requester.requisitions.raise(run.requisition);
      expect(doc.pr).toMatch(/^PR-\d{4}-\d+/);
      await requester.requisitions.expectRow(doc.pr, { title: run.requisition.title, status: 'Pending HOD Approval' });

      // The stored requisition holds exactly what was typed.
      await requester.requisition.open(doc.pr, requester.requisitions);
      await requester.requisition.expectRequisition(run.requisition);
    });

    test('2. Department head sees it unchanged and approves it', async ({ signInAs }) => {
      const head = await signInAs('head');
      await head.requisitions.open('team');
      await expect(head.requisitions.heading).toHaveText('Team Requisitions');
      await head.requisitions.expectRow(doc.pr, { title: run.requisition.title, status: 'Pending HOD Approval' });

      await head.requisition.open(doc.pr, head.requisitions);
      await head.requisition.expectRequisition(run.requisition);

      await head.requisitions.open('team');
      await head.requisitions.approve(doc.pr, `Approved for run ${run.id}`);
      await head.requisitions.expectRow(doc.pr, { status: 'Stores Review' });
    });

    test('3. Stores officer categorises every line and forwards to procurement', async ({ signInAs }) => {
      const stores = await signInAs('stores');
      await stores.storesReview.open();
      const drawer = await stores.storesReview.openReview(doc.pr);
      await stores.storesReview.expectRequisition(drawer, run.requisition);
      // A new item cannot go on uncategorised.
      await expect(drawer.getByText('New item — not in the catalogue')).toBeVisible();
      await stores.storesReview.categorise(drawer, run.line.description, run.line.category);
      await stores.storesReview.forward(drawer);
    });

    test('4-5. Procurement officer accepts it and publishes the RFQ', async ({ signInAs }) => {
      const buyer = await signInAs('buyer');
      await buyer.requisitions.openFiltered('pending_acceptance');
      await expect(buyer.requisitions.heading).toHaveText('Purchase Requisitions');
      await buyer.requisitions.expectRow(doc.pr, { title: run.requisition.title, status: 'Pending Acceptance' });

      await buyer.requisition.open(doc.pr, buyer.requisitions);
      await buyer.requisition.expectRequisition(run.requisition);

      await buyer.requisitions.openFiltered('pending_acceptance');
      await buyer.requisitions.accept(doc.pr, `Accepted for run ${run.id}`);

      // Accepting opens the RFQ form with this requisition already chosen.
      await buyer.rfqDrawer.expectFromRequisition(doc.pr, run.requisition);
      run.rfq.title = await buyer.rfqDrawer.publish({
        description: run.rfq.description,
        deadline: run.rfq.deadline,
        terms: run.rfq.terms,
        items: run.requisition.items,
        suppliers: run.quotes.map((q) => q.company)
      });
      expect(run.rfq.title).toBe(`RFQ for ${run.requisition.title}`);

      doc.rfqUrl = buyer.page.url();
      doc.rfq = await buyer.rfq.rfqNumber();
      expect(doc.rfq).toMatch(/^RFQ-/);
      await buyer.rfq.expectStatus('Open');
      await expect(buyer.page.getByRole('heading', { level: 1 })).toHaveText(run.rfq.title);
      await expect(buyer.page.locator('h3', { hasText: 'Description' }).locator('xpath=following-sibling::*[1]')).toContainText(run.rfq.description);
      // Bids stay sealed until the RFQ closes.
      await buyer.rfq.expectSealed();
    });

    test('6. Three invited suppliers each submit a quotation', async ({ signInAs }) => {
      for (const quote of run.quotes) {
        await test.step(quote.company, async () => {
          const supplier = await signInAs(quote.email);
          await supplier.supplierRfqs.open();
          await supplier.supplierRfqs.expectRfq(doc.rfq, {
            title: run.rfq.title,
            description: run.rfq.description,
            items: run.requisition.items
          });
          const total = await supplier.supplierRfqs.submitQuotation({
            unitPrices: [quote.unitPrice],
            deliveryDays: quote.deliveryDays,
            paymentTerms: quote.paymentTerms,
            validDays: quote.validDays,
            notes: quote.notes
          });
          expect(total).toMatch(quote.totalPattern);

          await supplier.supplierRfqs.open();
          await expect(await supplier.supplierRfqs.rowFor(doc.rfq)).toContainText('Submitted');
          await supplier.context.close();
        });
      }
    });

    test('7. Procurement officer closes the RFQ and sees the quotes ranked', async ({ signInAs }) => {
      const buyer = await signInAs('buyer');
      await buyer.base.goto(doc.rfqUrl);
      await buyer.rfq.closeAndReveal();
      await buyer.rfq.expectRanking(run.quotes);
    });

    test('8. Procurement officer selects the winning quote with a justification', async ({ signInAs }) => {
      const buyer = await signInAs('buyer');
      await buyer.base.goto(doc.rfqUrl);
      await buyer.rfq.openQuotationOf(run.winner.company);
      doc.quotationUrl = buyer.page.url();
      doc.quotation = await buyer.quotation.quotationNumber();

      // The quotation reads exactly as the supplier entered it.
      await buyer.quotation.expectQuotation({
        company: run.winner.company,
        rfqNumber: doc.rfq,
        deliveryDays: run.winner.deliveryDays,
        paymentTerms: run.winner.paymentTerms,
        notes: run.winner.notes,
        totalPattern: run.winner.totalPattern,
        lines: [{ ...run.line, unitPricePattern: run.winner.unitPricePattern }]
      });
      await buyer.quotation.select(run.justification);
      await expect(buyer.quotation.authorizeButton).toHaveCount(0);
    });

    test('9. Head of Procurement authorises the award', async ({ signInAs }) => {
      const procHead = await signInAs('procHead');
      await procHead.authorizations.open();
      await procHead.authorizations.expectAwaiting(doc.rfq, {
        company: run.winner.company,
        quotationNumber: doc.quotation,
        justification: run.justification,
        totalPattern: run.winner.totalPattern
      });
      await procHead.authorizations.openReview(doc.rfq);
      await expect(procHead.page.getByText(`Justification: ${run.justification}`)).toBeVisible();
      await procHead.quotation.authorize();
    });

    test('10. Procurement officer accepts the quotation, raises and submits the PO', async ({ signInAs }) => {
      const buyer = await signInAs('buyer');
      await buyer.base.goto(doc.quotationUrl);
      await buyer.quotation.accept();

      await buyer.purchaseOrders.open();
      const review = await buyer.purchaseOrders.createFromQuotation({
        quotationNumber: doc.quotation,
        supplier: run.winner.company,
        notes: run.po.notes,
        terms: run.po.terms
      });
      expect(review.totalText).toMatch(run.winner.totalPattern);
      doc.poUrl = buyer.page.url();
      doc.po = await buyer.purchaseOrder.poNumber();
      expect(doc.po).toMatch(/^PO-\d{4}-\d+/);

      await buyer.purchaseOrder.expectStatus('Draft');
      await buyer.purchaseOrder.expectOrder({
        supplier: run.winner.company,
        totalPattern: run.winner.totalPattern,
        lines: [{ ...run.line, unitPricePattern: run.winner.unitPricePattern }]
      });
      await buyer.purchaseOrder.submitForApproval();
    });

    test('11. Head of Procurement gives the first approval', async ({ signInAs }) => {
      const procHead = await signInAs('procHead');
      await procHead.approvals.open();
      await procHead.approvals.expectTitle('Head of Procurement Approval');
      await procHead.approvals.approve(doc.po, `HoP approved, run ${run.id}`, {
        supplier: run.winner.company,
        totalPattern: run.winner.totalPattern,
        lines: [{ ...run.line, unitPricePattern: run.winner.unitPricePattern }]
      });
      await procHead.base.goto(doc.poUrl);
      await procHead.purchaseOrder.expectStatus('Pending Finance');
    });

    test('12. Finance gives the second approval', async ({ signInAs }) => {
      const finance = await signInAs('finance');
      await finance.approvals.open();
      await finance.approvals.expectTitle('Finance Approval');
      await finance.approvals.approve(doc.po, `Finance approved, run ${run.id}`, {
        supplier: run.winner.company,
        totalPattern: run.winner.totalPattern,
        lines: [{ ...run.line, unitPricePattern: run.winner.unitPricePattern }]
      });
      await finance.base.goto(doc.poUrl);
      // USD 5,000 or more waits for the COO; below it is approved.
      await finance.purchaseOrder.expectStatus(run.requiresCoo ? 'Pending COO' : 'Approved');
    });

    test('13. COO approves at or above the limit, and only then', async ({ signInAs }) => {
      const coo = await signInAs('coo');
      await coo.approvals.open();
      await coo.approvals.expectTitle('COO Authorization');
      if (!run.requiresCoo) {
        // Urgent if the COO is asked to approve an order under USD 5,000.
        await coo.approvals.expectNotQueued(doc.po);
        return;
      }
      await coo.approvals.rowFor(doc.po);
      // Approve from the PO page itself (changed 3 Nov).
      await coo.base.goto(doc.poUrl);
      await coo.purchaseOrder.expectStatus('Pending COO');
      await coo.purchaseOrder.expectOrder({ supplier: run.winner.company, totalPattern: run.winner.totalPattern, lines: [run.line] });
      await coo.purchaseOrder.approve(`COO approved, run ${run.id}`);
      await coo.purchaseOrder.expectStatus('Approved');
    });

    test('14. Supplier sees the order as approved and acknowledges it', async ({ signInAs }) => {
      const supplier = await signInAs(run.winner.email);
      await supplier.supplierOrders.open();
      await supplier.supplierOrders.expectStatus(doc.po, 'approved');
      await supplier.supplierOrders.expectOrderDetails(doc.po, {
        totalPattern: run.winner.totalPattern,
        lines: [{ ...run.line, unitPricePattern: run.winner.unitPricePattern }]
      });
      await supplier.supplierOrders.acknowledge(doc.po, {
        deliveryNote: run.delivery.deliveryNote,
        totalPattern: run.winner.totalPattern
      });
    });

    test('15. Stores officer receives the goods on a GRV and accepts them into stock', async ({ signInAs }) => {
      const stores = await signInAs('stores');
      await stores.inventory.open();
      doc.stockBefore = await stores.inventory.onHand(run.line.description);

      await stores.deliveries.open();
      doc.grv = await stores.deliveries.receiveAndAccept(doc.po, { ...run.delivery, lines: [run.line] });
      await stores.deliveries.expectGrvStatus(doc.grv, 'Accepted');

      await stores.inventory.open();
      await expect
        .poll(() => stores.inventory.onHand(run.line.description), { message: 'inventory goes up by the received quantity' })
        .toBe(doc.stockBefore + run.line.quantity);
    });

    test('16. Department head asks stores to release the goods', async ({ signInAs }) => {
      const head = await signInAs('head');
      await head.requisitions.open('team');
      await head.requisition.open(doc.pr, head.requisitions);
      await head.requisition.expectStage('Delivered to Stores');
      doc.sr = await head.requisition.requestFromStores();
      expect(doc.sr).toMatch(/^SR-/);
    });

    test('17. Stores officer marks it ready, then hands it over', async ({ signInAs }) => {
      const stores = await signInAs('stores');
      await stores.storeRequisitions.open(doc.sr);
      await stores.storeRequisitions.expectStatus(doc.sr, 'New request');
      const row = await stores.storeRequisitions.rowFor(doc.sr);
      await expect(row).toContainText(`for ${doc.pr}`);
      await expect(row).toContainText(`× ${run.line.quantity}`);

      await stores.storeRequisitions.markReady(doc.sr, `Collect from the main store, run ${run.id}`);
      await stores.storeRequisitions.handOver(doc.sr, run.collection);
      await stores.storeRequisitions.expectHandedOver(doc.sr);

      await stores.inventory.open();
      await expect
        .poll(() => stores.inventory.onHand(run.line.description), { message: 'stock goes back down when handed over' })
        .toBe(doc.stockBefore);
    });

    test('18. Supplier submits an invoice against the order', async ({ signInAs }) => {
      const supplier = await signInAs(run.winner.email);
      await supplier.supplierInvoices.open();
      doc.invoice = await supplier.supplierInvoices.submit(doc.po, run.invoice);
      expect(doc.invoice).toMatch(/^INV-/);
      await supplier.supplierInvoices.expectInvoice(doc.invoice, {
        vendorInvoiceNumber: run.invoice.vendorInvoiceNumber,
        poNumber: doc.po,
        status: 'submitted',
        totalPattern: run.winner.totalPattern
      });
    });

    test('19. Finance sees the three-way match pass and approves the invoice', async ({ signInAs }) => {
      const finance = await signInAs('finance');
      await finance.invoices.open();
      await finance.invoices.openInvoice(doc.invoice);
      await finance.invoices.expectMatched({
        poNumber: doc.po,
        supplier: run.winner.company,
        grvNumber: doc.grv,
        totalPattern: run.winner.totalPattern
      });
      await finance.invoices.approve();
    });

    test('20. Finance records the payment on a Tuesday or Thursday run', async ({ signInAs }) => {
      const finance = await signInAs('finance');
      await finance.invoices.open();
      await finance.invoices.openInvoice(doc.invoice);
      await finance.invoices.recordPayment();
      await expect(finance.page.locator('span').filter({ hasText: /^Paid$/ }).first()).toBeVisible();

      await finance.payments.open();
      await finance.payments.expectPaymentRunBanner();
      await finance.payments.expectPayment({ supplier: run.winner.company, totalPattern: run.winner.totalPattern });

      // The supplier sees its own invoice as paid.
      const supplier = await signInAs(run.winner.email);
      await supplier.supplierInvoices.open();
      await supplier.supplierInvoices.expectInvoice(doc.invoice, {
        vendorInvoiceNumber: run.invoice.vendorInvoiceNumber,
        status: 'paid'
      });
    });

    test('21. Procurement officer evaluates the supplier', async ({ signInAs }) => {
      const buyer = await signInAs('buyer');
      await buyer.evaluations.open();
      const due = buyer.evaluations.dueRow(run.winner.company);
      // A supplier evaluated recently is not due again until its tier's review date.
      test.skip((await due.count()) === 0, `${run.winner.company} is not due for evaluation yet`);
      const average = await buyer.evaluations.evaluate(run.winner.company, run.evaluation);
      expect(average).toBeGreaterThanOrEqual(1);
      expect(average).toBeLessThanOrEqual(5);
      await buyer.evaluations.expectRecorded(run.winner.company, { average, recommendation: run.evaluation.recommendation });
    });
  });
}
