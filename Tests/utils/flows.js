const { expect } = require('@playwright/test');
const { qaTitle, runId, datetimeLocalInDays } = require('./testData');

/**
 * Short cuts through the early steps of the main run-through, for specs that
 * need a record at a later stage. Every step still goes through the UI as
 * the role that owns it.
 */

/** A one-line requisition named for this run. */
function requisitionFor(unit, label, line = {}) {
  const id = runId();
  const description = line.description || qaTitle(line.name || unit.item.newItemName, id);
  return {
    id,
    title: qaTitle(label, id),
    description: `${label}. Playwright run ${id}.`,
    workOrder: `WO-${id}`,
    items: [
      {
        description,
        quantity: line.quantity || 2,
        unit: line.unit || 'Each',
        package: line.package,
        specification: line.specification,
        estimatedUnitPrice: line.estimatedUnitPrice ?? 10,
        category: line.category || unit.item.category,
        catalogueSearch: line.catalogueSearch
      }
    ]
  };
}

/** Steps 1-3: raised by `raiser`, approved by its head, categorised and forwarded by stores. */
async function raiseToProcurement(signInAs, requisition, { raiser = 'requester', head = 'head' } = {}) {
  const requester = await signInAs(raiser);
  await requester.requisitions.open();
  const pr = await requester.requisitions.raise(requisition);
  await requester.context.close();

  const hod = await signInAs(head);
  await hod.requisitions.open('team');
  await hod.requisitions.approve(pr);
  await hod.context.close();

  const stores = await signInAs('stores');
  await stores.storesReview.open();
  const drawer = await stores.storesReview.openReview(pr);
  for (const item of requisition.items) {
    await stores.storesReview.categorise(drawer, item.description, item.category);
  }
  await stores.storesReview.forward(drawer);
  await stores.context.close();
  return pr;
}

/** Step 4: the buyer accepts; the RFQ drawer is left open on the buyer's page. */
async function acceptForSourcing(signInAs, pr) {
  const buyer = await signInAs('buyer');
  await buyer.requisitions.openFiltered('pending_acceptance');
  await buyer.requisitions.accept(pr);
  await expect(buyer.rfqDrawer.drawer).toContainText(`From Requisition: ${pr}`);
  return buyer;
}

/** Fill the RFQ details step, go to the Suppliers step, and return the preselected suppliers. */
async function rfqSuppliersStep(buyer, requisition) {
  const d = buyer.rfqDrawer.drawer;
  await d.locator('input[type="datetime-local"]').fill(datetimeLocalInDays(3));
  await d.getByRole('button', { name: /^Next/ }).click();
  await d.getByRole('button', { name: /^Next/ }).click();
  await expect(d.getByRole('heading', { name: 'Invite Suppliers' })).toBeVisible();
  // Give the invitation proposal a moment to arrive.
  await buyer.page.waitForTimeout(1000);
  return buyer.rfqDrawer.preselected();
}

/** Publish an RFQ for an accepted requisition, inviting exactly these suppliers. */
async function publishRfq(buyer, requisition, suppliers) {
  const title = await buyer.rfqDrawer.publish({
    description: requisition.description,
    deadline: datetimeLocalInDays(3),
    items: requisition.items,
    suppliers
  });
  return { title, url: buyer.page.url(), number: await buyer.rfq.rfqNumber() };
}

/** A supplier quotes on an RFQ. */
async function quote(signInAs, email, rfqNumber, details) {
  const supplier = await signInAs(email);
  await supplier.supplierRfqs.open();
  const row = await supplier.supplierRfqs.rowFor(rfqNumber);
  await row.getByRole('button', { name: 'View' }).click();
  const total = await supplier.supplierRfqs.submitQuotation(details);
  await supplier.context.close();
  return total;
}

module.exports = { requisitionFor, raiseToProcurement, acceptForSourcing, rfqSuppliersStep, publishRfq, quote };
