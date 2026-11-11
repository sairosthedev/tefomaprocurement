const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { escapeRegExp } = require('../utils/testData');

/** Purchase Orders list (/app/purchase-orders): procurement, Finance, admin. */
class PurchaseOrdersPage extends BasePage {
  constructor(page) {
    super(page);
    this.createButton = page.getByRole('button', { name: 'Create PO from Quotation' });
  }

  async open() {
    await this.goto('/app/purchase-orders');
    await expect(this.heading).toHaveText('Purchase Orders');
  }

  async findByNumber(poNumber) {
    await this.search('Search purchase orders...', poNumber);
    const row = this.row(poNumber);
    await expect(row).toHaveCount(1);
    return row;
  }

  /**
   * Step 10: create a PO from the accepted quotation, through the side panel.
   * Returns what the Review step showed, so later roles can be checked
   * against it.
   */
  async createFromQuotation({ quotationNumber, supplier, notes, terms }) {
    await this.createButton.click();
    const drawer = this.dialog('Create purchase order');
    await expect(drawer).toBeVisible();

    // Quotation step: choose the accepted quotation by its number.
    await drawer.getByPlaceholder('Search quotation, supplier or RFQ...').fill(quotationNumber);
    const option = drawer.locator('label').filter({ hasText: quotationNumber });
    await expect(option).toContainText(supplier);
    await option.locator('input[type="radio"]').check();
    await drawer.getByRole('button', { name: /^Next/ }).click();

    // Delivery step: prefilled from the site; the expected date is required.
    const expected = drawer.locator('input[type="date"]');
    await expect(expected).not.toHaveValue('');
    const deliveryDate = await expected.inputValue();
    await drawer.getByRole('button', { name: /^Next/ }).click();

    // Terms step.
    const termsBox = this.textareaAfterLabel(drawer, 'Terms & Conditions');
    const notesBox = this.textareaAfterLabel(drawer, 'Notes');
    if (terms !== undefined) await termsBox.fill(terms);
    if (notes !== undefined) await notesBox.fill(notes);
    const enteredTerms = await termsBox.inputValue();
    const enteredNotes = await notesBox.inputValue();
    await drawer.getByRole('button', { name: /^Next/ }).click();

    // Review step: what was chosen and typed is shown back before creating.
    await this.expectFact('Supplier', supplier, drawer);
    if (enteredNotes) await this.expectFact('Notes', enteredNotes, drawer);
    if (enteredTerms) await this.expectFact('Terms & Conditions', enteredTerms, drawer);
    const totalText = (await this.fact('Total Amount', drawer).innerText()).trim();

    await drawer.getByRole('button', { name: 'Create Purchase Order' }).click();
    await this.expectToast('success', 'Purchase Order created');
    await this.page.waitForURL(/\/app\/purchase-orders\/[a-f0-9]{24}/);
    return { deliveryDate, notes: enteredNotes, terms: enteredTerms, totalText };
  }

  textareaAfterLabel(scope, label) {
    return scope
      .locator('label, p')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`) })
      .first()
      .locator('xpath=following::textarea[1]');
  }
}

/** One purchase order (/app/purchase-orders/:id). Approvers can act here too. */
class PurchaseOrderDetailPage extends BasePage {
  constructor(page) {
    super(page);
    this.status = page.locator('h1').locator('xpath=ancestor::div[2]').locator('span.rounded-full').first();
    this.approveButton = page.getByRole('button', { name: 'Approve', exact: true }).first();
    this.rejectButton = page.getByRole('button', { name: 'Reject', exact: true }).first();
    this.submitButton = page.getByRole('button', { name: 'Submit for Approval' });
  }

  async openById(id) {
    await this.goto(`/app/purchase-orders/${id}`);
    await expect(this.heading).toHaveText('Purchase Order');
  }

  async poNumber() {
    const text = await this.page.getByText(/^#PO-/).first().innerText();
    return text.replace(/^#/, '').trim();
  }

  async expectStatus(label) {
    // "Pending Coo" is how the chip spells it; compare case-insensitively.
    await expect(this.page.locator('span').filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`, 'i') }).first()).toBeVisible();
  }

  async submitForApproval() {
    await this.submitButton.click();
    await this.expectToast('success', 'submitted');
    await this.expectStatus('Pending Head of Procurement');
  }

  /** Approve from the PO page itself (changed 3 Nov): Approve, comment, Approve. */
  async approve(comment) {
    await this.approveButton.click();
    const modal = this.page.getByRole('dialog', { name: /^Approve PO-/ });
    await expect(modal).toBeVisible();
    if (comment) await modal.getByRole('textbox', { name: 'Comments' }).fill(comment);
    await modal.getByRole('button', { name: 'Approve', exact: true }).click();
    await this.expectToast('success', 'Purchase order approved');
  }

  async reject(reason) {
    await this.rejectButton.click();
    const modal = this.page.getByRole('dialog', { name: /^Reject PO-/ });
    await modal.getByRole('textbox', { name: 'Reason for rejecting' }).fill(reason);
    await modal.getByRole('button', { name: 'Reject', exact: true }).click();
    await this.expectToast('success', 'Purchase order rejected');
  }

  /** The order as the buyer raised it: supplier, total and every line. */
  async expectOrder({ supplier, totalPattern, lines }) {
    await this.expectFact('Supplier', supplier);
    if (totalPattern) await this.expectFact('Total', totalPattern);
    const items = this.page.locator('h3', { hasText: 'Order items' }).locator('xpath=following::table[1]');
    for (const line of lines || []) {
      const row = items.locator('tbody tr').filter({ hasText: line.description });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(String(line.quantity));
      if (line.unitPricePattern) await expect(row).toContainText(line.unitPricePattern);
    }
  }
}

/** Approvals queue (/app/approvals) for the Head of Procurement, Finance and COO. */
class ApprovalsPage extends BasePage {
  async open() {
    await this.goto('/app/approvals');
  }

  async expectTitle(title) {
    await expect(this.heading).toHaveText(title);
  }

  async rowFor(poNumber) {
    const row = this.row(poNumber);
    await expect(row).toHaveCount(1);
    return row;
  }

  async expectNotQueued(poNumber) {
    await expect(this.row(poNumber)).toHaveCount(0);
  }

  /** Open the review modal and check the order matches what the buyer raised. */
  async review(poNumber, { supplier, totalPattern, lines, paymentTerms } = {}) {
    const row = await this.rowFor(poNumber);
    await row.getByRole('button', { name: 'Review' }).click();
    const modal = this.dialog('Review Purchase Order');
    await expect(modal).toBeVisible();
    await this.expectFact('PO Number', poNumber, modal);
    if (supplier) await this.expectFact('Supplier', supplier, modal);
    if (totalPattern) await this.expectFact('Total Value', totalPattern, modal);
    if (paymentTerms) await this.expectFact('Payment Terms', paymentTerms, modal);
    for (const line of lines || []) {
      const lineRow = modal.locator('tbody tr').filter({ hasText: line.description });
      await expect(lineRow).toContainText(String(line.quantity));
      if (line.unitPricePattern) await expect(lineRow).toContainText(line.unitPricePattern);
    }
    return modal;
  }

  async approve(poNumber, comment, expected) {
    const modal = await this.review(poNumber, expected);
    if (comment) await modal.locator('#po-review-comment').fill(comment);
    await modal.getByRole('button', { name: 'Approve', exact: true }).click();
    await this.expectToast('success', 'Purchase Order approved');
  }
}

/** The supplier's own purchase orders (/app/my-purchase-orders). */
class SupplierPurchaseOrdersPage extends BasePage {
  async open() {
    await this.goto('/app/my-purchase-orders');
    await expect(this.heading).toHaveText('My Purchase Orders');
  }

  async rowFor(poNumber) {
    const row = this.row(poNumber);
    await expect(row).toHaveCount(1);
    return row;
  }

  async expectStatus(poNumber, status) {
    // The chip's text is lower case and capitalised by CSS.
    await expect((await this.rowFor(poNumber))).toContainText(new RegExp(escapeRegExp(status), 'i'));
  }

  /** Step 14: acknowledge the order. */
  async acknowledge(poNumber, { deliveryNote, totalPattern } = {}) {
    const row = await this.rowFor(poNumber);
    await row.getByRole('button', { name: 'Acknowledge' }).click();
    const modal = this.dialog('Acknowledge Purchase Order');
    await expect(modal).toContainText(`PO Number: ${poNumber}`);
    if (totalPattern) await expect(modal).toContainText(totalPattern);
    if (deliveryNote) {
      const box = modal.getByPlaceholder('Enter delivery note number if available');
      await box.fill(deliveryNote);
      await expect(box).toHaveValue(deliveryNote);
    }
    await modal.getByRole('button', { name: 'Confirm Acknowledgment' }).click();
    await this.expectToast('success', 'Purchase order acknowledged');
    // The details modal reopens by itself; close it.
    const details = this.dialog('Purchase Order Details');
    if (await details.isVisible().catch(() => false)) await details.getByRole('button', { name: 'Close' }).first().click();
    await expect((await this.rowFor(poNumber)).getByText('Acknowledged', { exact: true })).toBeVisible();
  }

  /** The order the supplier sees matches what procurement raised. */
  async expectOrderDetails(poNumber, { totalPattern, lines }) {
    const row = await this.rowFor(poNumber);
    await row.getByRole('button', { name: /View/ }).first().click();
    const modal = this.dialog('Purchase Order Details');
    await this.expectFact('PO number', poNumber, modal);
    if (totalPattern) await this.expectFact('Total value', totalPattern, modal);
    for (const line of lines || []) {
      const lineRow = modal.locator('tbody tr').filter({ hasText: line.description });
      await expect(lineRow).toContainText(String(line.quantity));
      if (line.unitPricePattern) await expect(lineRow).toContainText(line.unitPricePattern);
    }
    await modal.getByRole('button', { name: 'Close' }).first().click();
  }
}

/** The role dashboard (/app) and its Needs attention items. */
class DashboardPage extends BasePage {
  async open() {
    await this.goto('/app');
    await expect(this.heading).toHaveText(/^Welcome back, /, { timeout: 30_000 });
  }

  attentionItems() {
    return this.page.locator('h2', { hasText: 'Needs attention' }).locator('xpath=ancestor::div[2]').getByRole('button');
  }

  /** Each item's label and count, read from the dashboard. */
  async readAttentionItems() {
    const items = [];
    const buttons = this.attentionItems();
    for (let i = 0; i < (await buttons.count()); i++) {
      const b = buttons.nth(i);
      const label = (await b.locator('p').first().innerText()).trim();
      const count = Number((await b.locator('span.text-2xl').innerText()).trim());
      items.push({ label, count, index: i });
    }
    return items;
  }
}

module.exports = { PurchaseOrdersPage, PurchaseOrderDetailPage, ApprovalsPage, SupplierPurchaseOrdersPage, DashboardPage };
