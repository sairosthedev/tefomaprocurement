const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { escapeRegExp } = require('../utils/testData');

const after = (scope, label, tag = 'input') =>
  scope
    .locator('label')
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}`, 'i') })
    .first()
    .locator(`xpath=following-sibling::${tag}[1]`);

/** Goods Receiving (GRV) at /app/deliveries. */
class DeliveriesPage extends BasePage {
  async open() {
    await this.goto('/app/deliveries');
    await expect(this.heading).toHaveText('Goods Receiving (GRV)');
  }

  /**
   * Step 15: receive the goods against the PO, then accept them into stock.
   * Returns the GRV number.
   */
  async receiveAndAccept(poNumber, { deliveryNote, deliveredBy, vehicle, witnesses = {}, lines, acceptNotes }) {
    const showAll = this.page.getByRole('button', { name: /^Show all/ });
    if (await showAll.isVisible().catch(() => false)) await showAll.click();
    const pending = this.page.locator('div').filter({ hasText: poNumber }).filter({ has: this.page.getByRole('button', { name: 'Receive', exact: true }) }).last();
    await pending.getByRole('button', { name: 'Receive', exact: true }).click();

    const d = this.page.getByRole('dialog', { name: 'Receive Goods' });
    await expect(d).toBeVisible();
    await expect(d).toContainText(poNumber);

    // Delivery: the supplier's delivery note number, if they gave one, is suggested.
    const note = after(d, 'Delivery Note Number');
    await note.fill(deliveryNote);
    await d.getByPlaceholder('e.g. John Moyo').fill(deliveredBy);
    if (vehicle) await d.getByPlaceholder('e.g. AEB 1234').fill(vehicle);
    await d.getByRole('button', { name: /^Next/ }).click();

    // Count: the received quantity starts at what is still due.
    for (const line of lines) {
      const row = d.locator('tbody tr').filter({ hasText: line.description });
      await expect(row).toContainText(`${line.quantity} ${line.unit}`);
      await expect(row.locator('input[type="number"]').first()).toHaveValue(String(line.quantity));
    }
    await d.getByRole('button', { name: /^Next/ }).click();

    // Inspection and witnesses (procedure 6.8.5).
    const names = d.getByPlaceholder('Name', { exact: true });
    const order = ['mt', 'security', 'sheq'];
    for (let i = 0; i < order.length; i++) {
      if (witnesses[order[i]]) await names.nth(i).fill(witnesses[order[i]]);
    }
    await d.getByRole('button', { name: /^Next/ }).click();

    // Review shows back what was typed.
    await expect(d).toContainText(deliveryNote);
    await expect(d).toContainText(deliveredBy);
    if (witnesses.mt) await expect(d).toContainText(`MT: ${witnesses.mt}`);
    await d.getByRole('button', { name: 'Confirm Receipt' }).click();
    await this.expectToast('success');

    // The GRV opens on its own: check it, then accept into stock.
    const grv = this.dialog('GRV Details');
    await expect(grv).toBeVisible();
    const grvNumber = (await this.fact('GRV Number', grv).innerText()).trim();
    expect(grvNumber).toMatch(/^GRV-/);
    await this.expectFact('PO Number', poNumber, grv);
    await this.expectFact('Delivery Note', deliveryNote, grv);
    await expect(grv).toContainText(deliveredBy);
    for (const line of lines) {
      await expect(grv.locator('tbody tr').filter({ hasText: line.description })).toContainText(`${line.quantity}`);
    }
    await after(grv, 'Decision', 'select').selectOption('accepted');
    if (acceptNotes) await grv.getByPlaceholder('Inspection notes...').fill(acceptNotes);
    await grv.getByRole('button', { name: 'Confirm Acceptance' }).click();
    await this.expectToast('success', 'Delivery accepted — stock updated');
    return grvNumber;
  }

  async expectGrvStatus(grvNumber, status) {
    await this.search('Search deliveries...', grvNumber);
    await expect(this.row(grvNumber)).toContainText(status);
  }
}

/** Store Requisitions (/app/store-requisitions): collecting from stores. */
class StoreRequisitionsPage extends BasePage {
  async open(search) {
    await this.goto(search ? `/app/store-requisitions?search=${encodeURIComponent(search)}` : '/app/store-requisitions');
    await expect(this.heading).toHaveText('Store Requisitions');
  }

  async rowFor(srNumber) {
    const row = this.row(srNumber);
    await expect(row).toHaveCount(1);
    return row;
  }

  async expectStatus(srNumber, status) {
    await expect(await this.rowFor(srNumber)).toContainText(status);
  }

  async markReady(srNumber, note) {
    await (await this.rowFor(srNumber)).getByRole('button', { name: 'Mark ready' }).click();
    const modal = this.dialog('Ready for collection');
    if (note) await modal.getByPlaceholder('e.g. Collect from the main store after 2pm').fill(note);
    await modal.getByRole('button', { name: 'Mark ready' }).click();
    await this.expectToast('success', `${srNumber} is ready`);
    await this.expectStatus(srNumber, 'Ready to collect');
  }

  async handOver(srNumber, { name, employeeNo, department, phone }) {
    await (await this.rowFor(srNumber)).getByRole('button', { name: 'Hand over' }).click();
    const modal = this.dialog('Hand over');
    await modal.getByPlaceholder('e.g. Tapiwa Ncube').fill(name);
    if (employeeNo) await modal.getByPlaceholder('Employee or national ID').fill(employeeNo);
    if (department) await modal.getByPlaceholder('e.g. Workshop').fill(department);
    if (phone) await modal.getByPlaceholder('Phone number').fill(phone);
    await modal.getByRole('button', { name: 'Hand over', exact: true }).click();
  }

  async expectHandedOver(srNumber) {
    await this.expectToast('success', 'Handed over');
    const view = this.dialog(srNumber);
    if (await view.isVisible().catch(() => false)) await view.getByRole('button', { name: 'Close' }).first().click();
    await this.expectStatus(srNumber, 'Collected');
  }

  async expectHandOverRefused(itemName) {
    await this.expectToast('error', new RegExp(`Not enough stock here for: .*${escapeRegExp(itemName)}.*Nothing was issued`));
  }
}

/** Inventory Management (/app/inventory), used to read stock levels. */
class InventoryPage extends BasePage {
  async open() {
    await this.goto('/app/inventory');
    await expect(this.heading).toHaveText('Inventory Management');
  }

  /** Total on hand for an item across the sites listed (0 when not stocked). */
  async onHand(itemName) {
    await this.page.getByPlaceholder('Search items...').fill(itemName);
    await this.page.getByRole('button', { name: 'Search', exact: true }).click();
    await this.waitForTableToSettle();
    const rows = this.page.locator('tbody tr').filter({ has: this.page.locator('td:nth-child(2) p.font-medium', { hasText: itemName }) });
    let total = 0;
    for (let i = 0; i < (await rows.count()); i++) {
      const text = await rows.nth(i).locator('td:nth-child(4) span.font-semibold').innerText();
      total += Number((text.match(/-?[\d,.]+/) || ['0'])[0].replace(/,/g, ''));
    }
    return total;
  }
}

/** The supplier's invoices (/app/my-invoices) and the "Submit invoice" drawer. */
class SupplierInvoicesPage extends BasePage {
  async open() {
    await this.goto('/app/my-invoices');
    await expect(this.heading).toHaveText('My Invoices');
  }

  /** Step 18: invoice the PO. Returns the system invoice number (INV-...). */
  async submit(poNumber, { vendorInvoiceNumber, vat, expectMatch = true }) {
    await this.page.getByRole('button', { name: 'Submit invoice' }).click();
    const d = this.page.getByRole('dialog', { name: 'Submit invoice' });
    await expect(d).toBeVisible();

    const po = after(d, 'Purchase order', 'select');
    const label = await po.locator('option', { hasText: poNumber }).first().innerText();
    await po.selectOption({ label });
    await d.getByPlaceholder('Vendor invoice #').fill(vendorInvoiceNumber);
    await d.getByRole('button', { name: /^Next/ }).click();

    const vatBox = d.locator('input[type="number"]').first();
    if (vat !== undefined) await vatBox.fill(String(vat));
    await d.getByRole('button', { name: /^Next/ }).click();

    await this.expectFact('Purchase order', poNumber, d);
    await this.expectFact('Your invoice number', vendorInvoiceNumber, d);
    if (expectMatch) await expect(d.getByText('The invoice total matches the purchase order.')).toBeVisible();
    else await expect(d.getByText(/The invoice is .+ (more|less) than the purchase order/)).toBeVisible();
    await d.getByRole('button', { name: 'Submit for three-way match' }).click();
    await this.expectToast('success', 'Invoice submitted successfully');
    await expect(d).toBeHidden();

    const row = this.row(poNumber).first();
    return this.documentNumberIn(row, 'INV');
  }

  /** The supplier sees its own invoice number and the current status. */
  async expectInvoice(invoiceNumber, { vendorInvoiceNumber, poNumber, status, totalPattern }) {
    const row = this.row(invoiceNumber);
    await expect(row).toHaveCount(1);
    if (status) await expect(row).toContainText(new RegExp(status, 'i'));
    await row.getByRole('button', { name: 'View' }).click();
    const modal = this.dialog('Invoice Details');
    await this.expectFact('Your invoice number', vendorInvoiceNumber, modal);
    if (poNumber) await this.expectFact('Purchase order', poNumber, modal);
    if (totalPattern) await this.expectFact('Total', totalPattern, modal);
    await modal.getByRole('button', { name: 'Close' }).first().click();
  }
}

/** Finance: Invoices list and one invoice (three-way match, approve, pay). */
class InvoicesPage extends BasePage {
  async open() {
    await this.goto('/app/invoices');
    await expect(this.heading).toHaveText('Invoices');
  }

  async openInvoice(invoiceNumber) {
    await this.search('Search invoice number...', invoiceNumber);
    const row = this.row(invoiceNumber);
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'View' }).click();
    await this.page.waitForURL(/\/app\/invoices\/[a-f0-9]{24}/);
    await expect(this.heading).toHaveText(invoiceNumber);
  }

  matchBox() {
    return this.page.getByRole('heading', { name: 'Three-way match' }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
  }

  /** Order, GRV and invoice agree: the match box is green and names the GRV. */
  async expectMatched({ poNumber, supplier, grvNumber, totalPattern }) {
    await expect(this.page.getByText(`PO: ${poNumber} · ${supplier}`)).toBeVisible();
    const box = this.matchBox();
    await expect(box).toHaveClass(/bg-green-50/);
    if (grvNumber) await expect(box).toContainText(grvNumber);
    if (totalPattern) await expect(box).toContainText(totalPattern);
  }

  async approve() {
    await this.page.getByRole('button', { name: 'Approve', exact: true }).click();
    await this.expectToast('success', 'Invoice approved for payment');
    await expect(this.page.getByRole('button', { name: 'Record payment' })).toBeVisible();
  }

  async recordPayment() {
    await this.page.getByRole('button', { name: 'Record payment' }).click();
    await this.expectToast('success', 'Payment recorded');
  }
}

/** Payments (/app/payments): the payment runs banner and recorded payments. */
class PaymentsPage extends BasePage {
  async open() {
    await this.goto('/app/payments');
    await expect(this.heading).toHaveText('Payments');
  }

  /** Payments are made on Tuesdays and Thursdays only. */
  async expectPaymentRunBanner() {
    const banner = this.page.getByText(/payments are processed on Tuesdays and Thursdays only/);
    await expect(banner).toBeVisible();
    const text = await banner.locator('xpath=ancestor-or-self::*[1]').innerText();
    expect(text).toMatch(/Next payment run: (Tomorrow|Tue|Thu)/);
  }

  async expectPayment({ supplier, totalPattern }) {
    const row = this.page.locator('tbody tr').filter({ hasText: supplier }).filter({ hasText: totalPattern }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText(/completed/i);
  }
}

/** Supplier evaluations (/app/suppliers/evaluations). */
class EvaluationsPage extends BasePage {
  static CRITERIA = [
    'Provides products/services on credit',
    'Existing contractual agreements',
    'Market reputation',
    'Pricing',
    'Efficiency in delivery',
    'Ease in dealings',
    'Consistent quality'
  ];

  async open() {
    await this.goto('/app/suppliers/evaluations');
    await expect(this.heading).toHaveText('Evaluations');
    // Show as many due suppliers per page as the list allows.
    const size = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: /^5$/ }) }).first();
    if (await size.count()) {
      const options = await size.locator('option').allInnerTexts();
      await size.selectOption(options[options.length - 1]);
    }
  }

  dueRow(company) {
    return this.page.locator('tbody tr').filter({ has: this.page.locator('p.font-medium', { hasText: company }) });
  }

  /** Step 21: score the supplier 1-5 on the seven criteria. Returns the average. */
  async evaluate(company, { scores, type = 'Re-evaluation', recommendation = 'Approve', notes }) {
    await this.dueRow(company).getByRole('button', { name: 'Evaluate' }).click();
    const d = this.page.getByRole('dialog', { name: 'Evaluate supplier' });
    await expect(d).toContainText(company);
    for (let i = 0; i < EvaluationsPage.CRITERIA.length; i++) {
      const label = d.locator('label', { hasText: EvaluationsPage.CRITERIA[i] });
      await label.locator('xpath=../following-sibling::input[@type="range"][1]').fill(String(scores[i]));
      await expect(label.locator('xpath=..')).toContainText(`${scores[i]}/5`);
    }
    await d.getByRole('button', { name: /^Next/ }).click();
    await after(d, 'Evaluation type', 'select').selectOption({ label: type });
    await after(d, 'Recommendation', 'select').selectOption({ label: recommendation });
    if (notes) await d.getByPlaceholder('Additional comments...').fill(notes);
    await d.getByRole('button', { name: /^Next/ }).click();

    const average = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    await this.expectFact('Average score', new RegExp(`^${average}(\\.0+)?/5`), d);
    if (notes) await expect(d).toContainText(notes);
    await d.getByRole('button', { name: 'Save evaluation' }).click();
    await this.expectToast('success', 'Evaluation saved');
    return average;
  }

  async expectRecorded(company, { average, recommendation }) {
    const row = this.page.locator('tbody tr').filter({ hasText: company }).first();
    await expect(row).toContainText(new RegExp(`${average}(\\.\\d+)?/5`));
    await expect(row).toContainText(new RegExp(recommendation, 'i'));
    await expect(row).toContainText('Recorded');
  }
}

module.exports = {
  DeliveriesPage,
  StoreRequisitionsPage,
  InventoryPage,
  SupplierInvoicesPage,
  InvoicesPage,
  PaymentsPage,
  EvaluationsPage
};
