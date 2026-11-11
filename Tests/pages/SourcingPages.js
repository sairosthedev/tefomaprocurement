const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { escapeRegExp, docNumberPattern } = require('../utils/testData');

/** One requisition (/app/requisitions/:id), as each role sees it. */
class RequisitionDetailPage extends BasePage {
  async open(prNumber, listPage) {
    const row = await listPage.find(prNumber);
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'View' }).click();
    await this.page.waitForURL(/\/app\/requisitions\/[a-f0-9]{24}/);
    await expect(this.page.getByText(`#${prNumber}`)).toBeVisible();
  }

  /** Everything the requester typed is shown, unchanged, to the next role. */
  async expectRequisition({ title, description, workOrder, items }) {
    await expect(this.heading).toHaveText(title);
    if (description) await expect(this.page.getByText(`Justification: ${description}`)).toBeVisible();
    if (workOrder) await this.expectFact('Work order', workOrder);
    const table = this.page.locator('h2', { hasText: 'Line items' }).locator('xpath=following::table[1]');
    for (const item of items) {
      const row = table.locator('tbody tr').filter({ hasText: item.description });
      await expect(row).toHaveCount(1);
      if (item.package) await expect(row).toContainText(item.package);
      if (item.specification) await expect(row).toContainText(item.specification);
      if (item.unit) await expect(row).toContainText(item.unit);
      await expect(row).toContainText(String(item.quantity));
    }
  }

  async expectStage(label) {
    await expect(this.page.locator('span').filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`, 'i') }).first()).toBeVisible();
  }

  async expectActivity(label) {
    const activity = this.page.locator('h3', { hasText: 'Activity' }).locator('xpath=following::ol[1]');
    await expect(activity).toContainText(label);
  }

  /** Step 16: the department head asks stores to release what was delivered. */
  async requestFromStores() {
    const panel = this.page.locator('h3', { hasText: /^Stores$/ }).locator('xpath=ancestor::div[2]');
    await expect(panel).toContainText(/Ready to collect|available in stores/);
    await this.page.getByRole('button', { name: 'Request from Stores' }).click();
    await this.expectToast('success', 'sent to stores');
    const sr = (await this.toast('success', 'sent to stores').innerText()).match(docNumberPattern('SR'));
    await expect(panel).toContainText('With stores');
    if (!sr) throw new Error('The toast did not name the store requisition');
    return sr[0];
  }
}

/** Stores review of approved requisitions (/app/stores-pr-review). */
class StoresPrReviewPage extends BasePage {
  async open() {
    await this.goto('/app/stores-pr-review');
    await expect(this.heading).toHaveText(/Stores Review/);
  }

  async openReview(prNumber) {
    const row = await this.findRow(prNumber);
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Review' }).click();
    const drawer = this.page.getByRole('dialog', { name: prNumber });
    await expect(drawer).toBeVisible();
    return drawer;
  }

  /** What stores sees is what the requester typed. */
  async expectRequisition(drawer, { title, description, items }) {
    await expect(drawer).toContainText(title);
    if (description) await expect(drawer).toContainText(description);
    for (const item of items) {
      const row = drawer.locator('tbody tr').filter({ hasText: item.description });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(`${item.quantity} ${item.unit}`);
      if (item.specification) await expect(row).toContainText(item.specification);
    }
  }

  /** Give a line its category. The choice saves as soon as it is picked. */
  async categorise(drawer, itemDescription, categoryName) {
    const row = drawer.locator('tbody tr').filter({ hasText: itemDescription });
    await row.getByRole('button', { name: /Choose category/ }).click();
    // The option panel is portalled to the page body.
    await this.page.getByPlaceholder('Search categories…').fill(categoryName);
    await this.page.getByRole('button', { name: new RegExp(`^${escapeRegExp(categoryName)}`) }).first().click();
    await expect(row).toContainText(categoryName);
    await expect(row.locator('.animate-spin')).toHaveCount(0);
  }

  async forward(drawer) {
    await drawer.getByRole('button', { name: 'Forward to procurement' }).click();
    await this.expectToast('success', 'Forwarded to procurement');
    await expect(drawer).toBeHidden();
  }

  /** Forwarding with a line still uncategorised is refused, naming the line. */
  async expectForwardRefused(drawer) {
    await drawer.getByRole('button', { name: 'Forward to procurement' }).click();
    await expect(drawer.getByText('Choose a category').first()).toBeVisible();
    await expect(drawer).toBeVisible();
  }

  async autoProcess(drawer) {
    await drawer.getByRole('button', { name: /Auto-process|Fulfill from stock/ }).first().click();
    await this.expectToast('success');
  }
}

/** The "Create RFQ" drawer: Details, Items, Suppliers, Review & send. */
class RfqDrawer extends BasePage {
  constructor(page) {
    super(page);
    this.drawer = page.getByRole('dialog', { name: 'Create RFQ' });
  }

  async expectFromRequisition(prNumber, { title, items }) {
    const d = this.drawer;
    await expect(d).toBeVisible();
    await expect(d).toContainText(`From Requisition: ${prNumber}`);
    // The title is carried over from the requisition.
    await expect(d.getByPlaceholder('Enter RFQ title')).toHaveValue(`RFQ for ${title}`);
  }

  /**
   * Fill the RFQ, check the items came across from the requisition, make sure
   * the named suppliers are invited, then publish. Returns the RFQ id.
   */
  async publish({ title, description, deadline, terms, items, suppliers }) {
    const d = this.drawer;
    if (title) await d.getByPlaceholder('Enter RFQ title').fill(title);
    if (description) await d.getByPlaceholder('Additional details or requirements for suppliers...').fill(description);
    await d.locator('input[type="datetime-local"]').fill(deadline);
    if (terms) await d.getByPlaceholder('Enter terms and conditions for this RFQ...').fill(terms);
    await d.getByRole('button', { name: /^Next/ }).click();

    // Items are locked copies of the requisition lines.
    await expect(d.getByText('Items are locked from the original requisition')).toBeVisible();
    for (const item of items) {
      const row = d.locator('tbody tr').filter({ hasText: item.description });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(String(item.quantity));
      if (item.specification) await expect(row).toContainText(item.specification);
    }
    await d.getByRole('button', { name: /^Next/ }).click();

    // Suppliers arrive pre-selected from the line categories.
    await expect(d.getByRole('heading', { name: 'Invite Suppliers' })).toBeVisible();
    for (const supplier of suppliers) await this.ensureInvited(supplier);
    await d.getByRole('button', { name: /^Next/ }).click();

    // Review shows what was typed and who is invited.
    const finalTitle = title || (await this.reviewValue('Title'));
    await expect(d).toContainText(finalTitle);
    if (description) await expect(d).toContainText(description);
    for (const supplier of suppliers) await expect(d).toContainText(supplier.company || supplier);

    await d.getByRole('button', { name: 'Publish RFQ', exact: true }).click();
    await this.expectToast('success', 'RFQ created and sent to suppliers');
    await this.page.waitForURL(/\/app\/rfqs\/[a-f0-9]{24}/);
    return finalTitle;
  }

  async reviewValue(label) {
    return (await this.fact(label, this.drawer).innerText()).trim();
  }

  selectedChip(company) {
    return this.drawer.getByTitle('Remove from this RFQ').filter({ hasText: company });
  }

  /**
   * Make sure one supplier is ticked. The units hold duplicate records with
   * the same company name (e.g. two "CodeBridge Solutions"), so a supplier is
   * picked by name and by the email of the account that will sign in to quote,
   * which each row shows under the name. Chips only show the name, so the
   * row's own tick is what is checked.
   */
  async ensureInvited(supplier) {
    const { company, email } = typeof supplier === 'string' ? { company: supplier } : supplier;
    const search = this.drawer.getByPlaceholder('Search suppliers...');
    await search.fill(company);
    let row = this.drawer.locator('div.max-h-64 div.cursor-pointer').filter({ hasText: company });
    if (email) row = row.filter({ hasText: email });
    await expect(row, `${company}${email ? ` (${email})` : ''} in the supplier list`).toHaveCount(1);
    if (!/bg-primary\/5/.test((await row.getAttribute('class')) || '')) await row.click();
    await expect(row).toHaveClass(/bg-primary\/5/);
    await search.fill('');
  }

  /** The suppliers ticked before anyone touched the list. */
  async preselected() {
    return (await this.drawer.getByTitle('Remove from this RFQ').allInnerTexts()).map((t) => t.trim());
  }
}

/** One RFQ as procurement sees it (/app/rfqs/:id). */
class RfqDetailPage extends BasePage {
  async rfqNumber() {
    return this.subtitleNumber('RFQ');
  }

  async expectStatus(status) {
    await expect(this.page.locator('span').filter({ hasText: new RegExp(`^${status}$`, 'i') }).first()).toBeVisible();
  }

  async expectSealed() {
    await expect(this.page.getByText('Bids are sealed')).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Response Ranking' })).toHaveCount(0);
  }

  /** Step 7: close the RFQ and reveal the bids (confirmed in a browser prompt). */
  async closeAndReveal() {
    this.page.once('dialog', (d) => d.accept());
    await this.page.getByRole('button', { name: 'Close RFQ & Reveal Bids' }).click();
    await this.expectToast('success');
    await expect(this.page.getByRole('heading', { name: 'Response Ranking' })).toBeVisible();
  }

  /** The ranking lists each response with its total and a score out of 100. */
  async expectRanking(quotes) {
    const panel = this.page.getByRole('heading', { name: 'Response Ranking' }).locator('xpath=ancestor::div[2]');
    await expect(panel).toContainText(`${quotes.length} of`);
    for (const q of quotes) {
      await expect(panel).toContainText(q.company);
      await expect(panel).toContainText(q.totalPattern);
    }
    await expect(panel.getByText(/\d+(\.\d+)?\/100/).first()).toBeVisible();
    return panel;
  }

  async openQuotationOf(company) {
    const panel = this.page.getByRole('heading', { name: 'Response Ranking' }).locator('xpath=ancestor::div[2]');
    const card = panel.locator('div').filter({ hasText: company }).filter({ has: this.page.getByRole('button', { name: 'View quotation' }) }).last();
    await card.getByRole('button', { name: 'View quotation' }).click();
    await this.page.waitForURL(/\/app\/quotations\/[a-f0-9]{24}/);
  }
}

/** The supplier portal: My RFQs and the quotation drawer. */
class SupplierRfqsPage extends BasePage {
  async open() {
    await this.goto('/app/my-rfqs');
    await expect(this.heading).toHaveText('My RFQs');
  }

  async rowFor(rfqNumber) {
    const row = await this.findRow(rfqNumber);
    await expect(row).toHaveCount(1);
    return row;
  }

  /** The supplier sees the RFQ exactly as procurement wrote it. */
  async expectRfq(rfqNumber, { title, description, items }) {
    const row = await this.rowFor(rfqNumber);
    await expect(row).toContainText(title);
    await row.getByRole('button', { name: 'View' }).click();
    await this.page.waitForURL(/\/app\/my-rfqs\/[a-f0-9]{24}/);
    await expect(this.heading).toHaveText(title);
    if (description) await expect(this.page.locator('h3', { hasText: 'Description' }).locator('xpath=following-sibling::*[1]')).toContainText(description);
    const table = this.page.locator('h3', { hasText: 'Items required' }).locator('xpath=following::table[1]');
    for (const item of items) {
      const line = table.locator('tbody tr').filter({ hasText: item.description });
      await expect(line).toHaveCount(1);
      await expect(line).toContainText(`${item.quantity} ${item.unit}`);
      if (item.specification) await expect(line).toContainText(item.specification);
    }
  }

  /**
   * Step 6: submit a quotation. `unitPrices` lists one price per RFQ line, in
   * order. Returns the grand total shown on the review step.
   */
  async submitQuotation({ unitPrices, brand, currency, deliveryDays, paymentTerms, validDays, notes }) {
    const d = this.page.getByRole('dialog', { name: 'Submit quotation' });
    // The form may already be open (the RFQ page opened with ?quote=1).
    if (!(await d.isVisible().catch(() => false))) {
      await this.page.getByRole('button', { name: /^Submit (Revised )?Quote$/ }).click();
    }
    await expect(d).toBeVisible();

    if (currency) {
      const select = d.locator('label').filter({ hasText: /^\s*Currency/ }).first().locator('xpath=following-sibling::select[1]');
      await select.selectOption(currency);
      await expect(select).toHaveValue(currency);
    }
    const prices = d.getByPlaceholder('0.00');
    await expect(prices).toHaveCount(unitPrices.length);
    for (let i = 0; i < unitPrices.length; i++) {
      await prices.nth(i).fill(String(unitPrices[i]));
      await expect(prices.nth(i)).toHaveValue(String(unitPrices[i]));
    }
    if (brand) await d.getByPlaceholder('Brand name').first().fill(brand);
    await d.getByRole('button', { name: /^Next/ }).click();

    const after = (label, tag) => d.locator('label').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}`) }).first().locator(`xpath=following-sibling::${tag}[1]`);
    if (deliveryDays) await after('Delivery (Days)', 'input').fill(String(deliveryDays));
    if (paymentTerms) await after('Payment Terms', 'select').selectOption(paymentTerms);
    if (validDays) await after('Valid For (Days)', 'input').fill(String(validDays));
    if (notes) await d.getByPlaceholder('Any additional information about your quotation...').fill(notes);
    await d.getByRole('button', { name: /^Next/ }).click();

    // Review: the terms just entered are shown back.
    if (deliveryDays) await this.expectFact('Delivery', `${deliveryDays} days`, d);
    if (paymentTerms) await this.expectFact('Payment terms', paymentTerms, d);
    if (validDays) await this.expectFact('Valid for', `${validDays} days`, d);
    if (notes) await expect(d).toContainText(notes);
    const grandTotal = (await d.getByText('Grand Total:').locator('xpath=following-sibling::*[1]').innerText()).trim();

    await d.getByRole('button', { name: 'Submit Quotation', exact: true }).click();
    await this.expectToast('success', 'Quotation submitted successfully');
    await expect(d).toBeHidden();
    return grandTotal;
  }
}

/**
 * One quotation (/app/quotations/:id). Selection with a justification (buyer),
 * authorisation (Head of Procurement) and acceptance (buyer) all happen here.
 */
class QuotationDetailPage extends BasePage {
  async quotationNumber() {
    return this.subtitleNumber('QT');
  }

  /** What the supplier entered is what procurement reads. */
  async expectQuotation({ company, rfqNumber, deliveryDays, paymentTerms, notes, lines, totalPattern }) {
    await expect(this.heading).toHaveText('Quotation');
    await this.expectFact('Supplier', company);
    if (rfqNumber) await this.expectFact('RFQ', rfqNumber);
    if (deliveryDays) await this.expectFact('Delivery', `${deliveryDays} days`);
    if (paymentTerms) await this.expectFact('Payment terms', paymentTerms);
    if (totalPattern) await this.expectFact('Total', totalPattern);
    if (notes) await expect(this.page.locator('h3', { hasText: /^Notes$/ }).locator('xpath=following-sibling::*[1]')).toContainText(notes);
    const table = this.page.locator('h3', { hasText: 'Quoted items' }).locator('xpath=following::table[1]');
    for (const line of lines || []) {
      const row = table.locator('tbody tr').filter({ hasText: line.description });
      await expect(row.first()).toContainText(String(line.quantity));
      await expect(row.first()).toContainText(line.unitPricePattern);
    }
  }

  get selectButton() {
    return this.page.getByRole('button', { name: 'Select this quotation' });
  }

  get authorizeButton() {
    return this.page.getByRole('button', { name: 'Authorize as Head of Procurement' });
  }

  /** Step 8: select the winner, giving a justification. */
  async select(justification) {
    await this.page.getByPlaceholder('Justification for selecting this quotation (required)').fill(justification);
    await this.selectButton.click();
    await this.expectToast('success', 'Quotation selected');
    await expect(this.page.getByText(`Justification: ${justification}`)).toBeVisible();
  }

  /** Fewer than three quotations: the Head of Procurement or COO approves a waiver. */
  async approveWaiver(justification) {
    const panel = this.page.getByRole('heading', { name: 'Acceptance Authorization' }).locator('xpath=ancestor::div[2]');
    const type = panel.locator('select').filter({ has: this.page.locator('option', { hasText: 'Select waiver type' }) });
    // The waiver types arrive after the page; wait for them, then take the first real one.
    await expect.poll(() => type.locator('option').count(), { message: 'waiver types loaded' }).toBeGreaterThan(1);
    const firstType = await type.locator('option').nth(1).getAttribute('value');
    await type.selectOption(firstType);
    await expect(type).toHaveValue(firstType);
    await panel.getByPlaceholder('Justification for waiving the 3-quotation requirement...').fill(justification);
    await panel.getByRole('button', { name: 'Approve waiver' }).click();
    await this.expectToast('success', 'Quotation waiver approved');
    await expect(panel).toContainText('(waived)');
  }

  /** Step 9: the Head of Procurement authorises the selection. */
  async authorize() {
    await this.authorizeButton.click();
    await this.expectToast('success', 'Quotation authorized');
    await expect(this.page.getByText('Fully authorized')).toBeVisible();
  }

  /** Step 10, first half: accept the authorised quotation. */
  async accept() {
    await this.page.getByRole('button', { name: 'Accept', exact: true }).click();
    const modal = this.dialog('Accept Quotation');
    await modal.getByRole('button', { name: 'Accept Quotation' }).click();
    await this.expectToast('success', 'Quotation accepted successfully');
    await expect(this.page.getByRole('button', { name: 'Create Purchase Order' })).toBeVisible();
  }
}

/** The Head of Procurement's queue of selections to authorise (/app/authorizations). */
class AuthorizationsPage extends BasePage {
  async open() {
    await this.goto('/app/authorizations');
    await expect(this.heading).toHaveText('Authorizations');
  }

  /** The selection shows the supplier, the quotation and the buyer's justification. */
  async expectAwaiting(rfqNumber, { company, quotationNumber, justification, totalPattern }) {
    const row = await this.findRow(rfqNumber);
    await expect(row).toHaveCount(1);
    if (company) await expect(row).toContainText(company);
    if (quotationNumber) await expect(row).toContainText(quotationNumber);
    if (justification) await expect(row).toContainText(justification);
    if (totalPattern) await expect(row).toContainText(totalPattern);
    return row;
  }

  async openReview(rfqNumber) {
    const row = await this.findRow(rfqNumber);
    await row.getByRole('link', { name: 'Review' }).click();
    await this.page.waitForURL(/\/app\/(quotations|rfqs)\//);
  }
}

module.exports = {
  RequisitionDetailPage,
  StoresPrReviewPage,
  RfqDrawer,
  RfqDetailPage,
  SupplierRfqsPage,
  QuotationDetailPage,
  AuthorizationsPage
};
