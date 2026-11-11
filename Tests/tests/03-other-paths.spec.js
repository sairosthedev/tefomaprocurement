/**
 * "Other paths" from the QA guide: the branches off the main run-through.
 */
const { test, expect } = require('../fixtures/test');
const { ApiClient } = require('../utils/apiClient');
const { requisitionFor, raiseToProcurement, acceptForSourcing, rfqSuppliersStep, publishRfq, quote } = require('../utils/flows');

/** Close the RFQ drawer without sending anything. */
async function discardRfq(buyer) {
  await buyer.rfqDrawer.drawer.getByRole('button', { name: 'Close' }).first().click();
  const discard = buyer.page.getByRole('button', { name: 'Discard', exact: true });
  if (await discard.isVisible().catch(() => false)) await discard.click();
  await expect(buyer.rfqDrawer.drawer).toBeHidden();
}

test.describe('Other paths', () => {
  // Each test walks a requisition through several roles on its own.
  test.describe.configure({ timeout: 600_000 });
  test("A department head's own requisition skips head approval and goes to stores", async ({ signInAs, unit }) => {
    const req = requisitionFor(unit, 'head raises own requisition');
    const head = await signInAs('head');
    await head.requisitions.open('mine');
    await expect(head.requisitions.heading).toHaveText('My Requisitions');
    const pr = await head.requisitions.raise(req, { asHead: true });
    await head.requisitions.expectRow(pr, { title: req.title, status: 'Stores Review' });

    // It never waits in Team Requisitions.
    await head.requisitions.open('team');
    await head.requisitions.expectAbsent(req.title);

    // Its history shows the head's approval, and the data is as typed.
    await head.requisitions.open('mine');
    await head.requisition.open(pr, head.requisitions);
    await head.requisition.expectRequisition(req);
    await head.requisition.expectActivity('Approved by department head');

    // Stores sees it straight away.
    const stores = await signInAs('stores');
    await stores.storesReview.open();
    await expect(await stores.storesReview.findRow(pr)).toContainText(req.title);
  });

  test('A requisition for an item stores holds is issued from stock, with no procurement step', async ({ signInAs, unit }) => {
    // Find a catalogue item with stock, through the same search the item picker uses.
    const requester = await signInAs('requester');
    const api = await ApiClient.fromPage(requester.page);
    const res = await api.get('department/catalog-items?search=&limit=50');
    await api.dispose();
    const stocked = (res.body.data || []).find((i) => Number(i.quantityAvailable) >= 1);
    test.skip(!stocked, 'No catalogue item with stock on hand in this unit');

    const req = requisitionFor(unit, 'issue from stock', {
      description: stocked.name,
      catalogueSearch: stocked.name,
      quantity: 1,
      unit: stocked.unit ? stocked.unit.charAt(0).toUpperCase() + stocked.unit.slice(1) : 'Each',
      category: stocked.category
    });
    await requester.requisitions.open();
    const pr = await requester.requisitions.raise(req);

    const head = await signInAs('head');
    await head.requisitions.open('team');
    await head.requisitions.approve(pr);

    // When everything is on the shelf the app issues it on approval and the
    // requisition is fulfilled at once; otherwise stores issues it on review.
    const readBack = async () => {
      const client = await ApiClient.fromPage(requester.page);
      const list = await client.get(`department/requisitions?search=${encodeURIComponent(pr)}`);
      const id = (list.body.data || []).find((r) => r.requisitionNumber === pr)?._id;
      const detail = (await client.get(`department/requisitions/${id}`)).body.data || {};
      await client.dispose();
      return detail;
    };
    let stored = await readBack();
    if (stored.status !== 'fulfilled') {
      const stores = await signInAs('stores');
      await stores.storesReview.open();
      const drawer = await stores.storesReview.openReview(pr);
      await expect(drawer.getByText('From the catalogue')).toBeVisible();
      await stores.storesReview.autoProcess(drawer);
      stored = await readBack();
    }
    expect(stored.status, 'requisition status').toBe('fulfilled');
    const line = (stored.items || [])[0] || {};
    expect(Number(line.quantityFulfilledFromStock ?? line.fulfilledFromStock), 'quantity issued from stock').toBe(1);

    // The requester sees it done, with what they asked for.
    await requester.requisitions.open();
    await requester.requisitions.expectRow(pr, { title: req.title });
    await requester.requisition.open(pr, requester.requisitions);
    await requester.requisition.expectRequisition({ title: req.title, items: [{ description: stocked.name, quantity: 1 }] });

    // It never reaches procurement.
    const buyer = await signInAs('buyer');
    await buyer.requisitions.openFiltered('pending_acceptance');
    await buyer.requisitions.expectAbsent(pr);
  });

  test('An RFQ in Fossil for protective clothing invites only SafeGuard, with a waiver warning', async ({ signInAs, unit }) => {
    test.skip(unit.key !== 'fossil', 'Fossil only');
    const req = requisitionFor(unit, 'PPE for site crew', {
      name: 'Hi-vis reflective vest',
      category: 'Protective Clothing & Safety Gear',
      quantity: 20
    });
    const pr = await raiseToProcurement(signInAs, req);
    const buyer = await acceptForSourcing(signInAs, pr);
    const invited = await rfqSuppliersStep(buyer, req);
    expect(invited).toEqual(['SafeGuard Safety Equipment']);
    await expect(buyer.rfqDrawer.drawer.getByText('Fewer than 3 suppliers can be invited')).toBeVisible();
    await discardRfq(buyer);
  });

  test('An RFQ for timber in Fossil invites Timberline plus two labelled top-ups', async ({ signInAs, unit }) => {
    test.skip(unit.key !== 'fossil', 'Fossil only');
    const req = requisitionFor(unit, 'timber for formwork', {
      name: 'Pine timber 38x114 x 6m',
      category: 'Timber, Boards & Lumber',
      quantity: 50
    });
    const pr = await raiseToProcurement(signInAs, req);
    const buyer = await acceptForSourcing(signInAs, pr);
    const invited = await rfqSuppliersStep(buyer, req);
    expect(invited).toContain('Timberline Lumber & Boards');
    expect(invited.length).toBeGreaterThanOrEqual(3);
    const list = buyer.rfqDrawer.drawer.locator('div.max-h-64');
    for (const company of invited.filter((c) => c !== 'Timberline Lumber & Boards')) {
      await expect(list.locator('div').filter({ hasText: company }).filter({ hasText: 'Related' }).first()).toBeVisible();
    }
    await expect(list.locator('div').filter({ hasText: 'Timberline Lumber & Boards' }).filter({ hasText: 'Category match' }).first()).toBeVisible();
    await discardRfq(buyer);
  });

  test('Quotes in different currencies are not ranked', async ({ signInAs, unit }) => {
    const req = requisitionFor(unit, 'currency comparison', { quantity: 2 });
    const pr = await raiseToProcurement(signInAs, req);
    const buyer = await acceptForSourcing(signInAs, pr);
    const [a, b] = unit.quotingSuppliers;
    const rfq = await publishRfq(buyer, req, [a, b]);
    await buyer.context.close();

    await quote(signInAs, a.email, rfq.number, { unitPrices: [100], currency: 'USD' });
    await quote(signInAs, b.email, rfq.number, { unitPrices: [1800], currency: 'ZAR' });

    const buyer2 = await signInAs('buyer');
    await buyer2.base.goto(rfq.url);
    await buyer2.rfq.expectSealed();
    buyer2.page.once('dialog', (d) => d.accept());
    await buyer2.page.getByRole('button', { name: 'Close RFQ & Reveal Bids' }).click();
    await expect(buyer2.page.getByText('Responses cannot be ranked')).toBeVisible();
    await expect(buyer2.page.getByText('Recommended', { exact: true })).toHaveCount(0);
  });

  test.fixme('A supplier quoting only some of the lines is ranked but never recommended', async () => {
    // The quotation form requires a unit price on every line ("Enter a unit
    // price"), so a partial quote cannot be entered through the UI. Cover it
    // once a partial quote can be submitted.
  });
});

test.describe('Needs attention items and sidebar badges match the lists', () => {
  test.describe.configure({ timeout: 300_000 });
  for (const role of ['requester', 'head', 'stores', 'buyer', 'procHead', 'finance', 'coo']) {
    test(`${role}: each Needs attention item opens a list with the same count`, async ({ signInAs }) => {
      const user = await signInAs(role);
      await user.dashboard.open();
      const items = await user.dashboard.readAttentionItems();
      test.skip(items.length === 0, 'Nothing needs attention for this role right now');
      for (const item of items) {
        await test.step(`${item.label} (${item.count})`, async () => {
          await user.dashboard.open();
          await user.dashboard.attentionItems().nth(item.index).click();
          await expect(user.page).not.toHaveURL(/\/app\/?$/);
          await expect.poll(() => user.base.listTotal(), { message: `${item.label} list total` }).toBe(item.count);
        });
      }
    });
  }
});
