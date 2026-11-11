const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { escapeRegExp } = require('../utils/testData');

/**
 * The requisitions list (/app/requisitions): "My Requisitions" for requesters,
 * "Team Requisitions" (?view=team) and "My Requisitions" (?view=mine) for
 * department heads, "Purchase Requisitions" for procurement.
 */
class RequisitionsPage extends BasePage {
  constructor(page) {
    super(page);
    this.newButton = page.getByRole('button', { name: 'New Requisition' });
    this.form = new RequisitionFormDrawer(page);
  }

  async open(view) {
    await this.goto(view ? `/app/requisitions?view=${view}` : '/app/requisitions');
  }

  async openFiltered(status) {
    await this.goto(`/app/requisitions?status=${status}`);
  }

  async find(text) {
    await this.search('Search requisitions...', text);
    return this.row(text);
  }

  /** Find the requisition by its unique title and return its PR number. */
  async prNumberFor(title) {
    const row = await this.find(title);
    await expect(row).toHaveCount(1);
    return this.documentNumberIn(row, 'PR');
  }

  async expectRow(text, { status, title } = {}) {
    const row = await this.find(text);
    await expect(row).toHaveCount(1);
    if (title) await expect(row).toContainText(title);
    if (status) await expect(row).toContainText(status instanceof RegExp ? status : new RegExp(escapeRegExp(status), 'i'));
    return row;
  }

  async expectAbsent(text) {
    await this.search('Search requisitions...', text);
    await expect(this.row(text)).toHaveCount(0);
  }

  /** Raise a requisition through the drawer and return its PR number. */
  async raise(requisition, { submit = true, asHead = false } = {}) {
    await this.newButton.click();
    await this.form.fill(requisition);
    if (submit) await this.form.submit(asHead);
    else await this.form.saveDraft();
    return this.prNumberFor(requisition.title);
  }

  /**
   * Approve (department head), Accept (procurement), or Send to Stores (a
   * head's own) from the row. Opens the action modal and confirms it.
   */
  async act(text, action, comment) {
    const row = await this.find(text);
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: action, exact: true }).click();
    const titles = {
      Approve: 'Approve Requisition',
      Accept: 'Accept Requisition',
      Reject: 'Reject Requisition',
      'Send to Stores': 'Send to Stores'
    };
    const modal = this.dialog(titles[action]);
    await expect(modal).toBeVisible();
    if (comment) await modal.locator('#requisition-action-comment').fill(comment);
    await modal.getByRole('button', { name: action === 'Reject' ? 'Reject' : action, exact: true }).click();
    return modal;
  }

  async approve(text, comment) {
    await this.act(text, 'Approve', comment);
    await this.expectToast('success', 'Requisition approved and sent to stores');
  }

  async reject(text, reason) {
    await this.act(text, 'Reject', reason);
    await this.expectToast('success', 'Requisition rejected');
  }

  /** Accepting opens the RFQ drawer straight away, with this requisition chosen. */
  async accept(text, comment) {
    await this.act(text, 'Accept', comment);
    await this.expectToast('success', 'Requisition accepted');
  }
}

/** The "New Requisition" drawer: Details, Items, Review & submit. */
class RequisitionFormDrawer extends BasePage {
  constructor(page) {
    super(page);
    this.drawer = page.getByRole('dialog', { name: 'New Requisition' });
    this.itemDrawer = page.getByRole('dialog', { name: 'Add item' });
  }

  async fill({ title, description, workOrder, urgency, items }) {
    const d = this.drawer;
    await expect(d).toBeVisible();

    // Step 1: details.
    await d.getByPlaceholder('e.g., Office Supplies for Q1').fill(title);
    if (description) await d.getByPlaceholder('Provide additional details...').fill(description);
    if (workOrder) await d.getByPlaceholder('Job / project reference').fill(workOrder);
    if (urgency === 'high') await d.locator('select').first().selectOption('high');
    await d.getByRole('button', { name: /^Next/ }).click();

    // Step 2: items. There is no category field: stores categorises.
    for (const item of items) await this.addItem(item);
    for (const item of items) {
      const row = d.locator('tbody tr').filter({ hasText: item.description });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(`${item.quantity} ${item.unit}`);
    }
    await d.getByRole('button', { name: /^Next/ }).click();

    // Step 3: review shows back exactly what was entered.
    await this.expectFact('Title', title, d);
    if (description) await this.expectFact('Description', description, d);
    await this.expectFact('Work Order', workOrder || '—', d);
    await this.expectFact('Urgency', urgency === 'high' ? 'High Priority' : 'Normal', d);
    for (const item of items) {
      const row = d.locator('tbody tr').filter({ hasText: item.description });
      await expect(row).toContainText(`${item.quantity} ${item.unit}`);
      if (item.specification) await expect(row).toContainText(item.specification);
    }
  }

  /** Add one line from the stores catalogue, or as a new item. */
  async addItem({ description, catalogueSearch, quantity, unit, package: pack, estimatedUnitPrice, specification }) {
    const d = this.drawer;
    const add = d.getByRole('button', { name: /^(Add Item|Add the first item)$/ }).first();
    await add.click();
    const item = this.itemDrawer;
    await expect(item).toBeVisible();

    const search = item.getByPlaceholder('Search the stores catalogue…');
    if (catalogueSearch) {
      // A catalogue item: pick the one named, or the first match for the search.
      await search.fill(catalogueSearch);
      const options = item.locator('div.absolute button').filter({ hasNotText: /as a new item/ });
      await expect(options.first()).toBeVisible();
      const named = options.filter({ has: this.page.locator('p', { hasText: new RegExp(`^${escapeRegExp(description)}$`) }) });
      await ((await named.count()) ? named.first() : options.first()).click();
      await expect(item.getByText(/^Catalog: /)).toBeVisible();
    } else {
      await search.fill(description);
      await item.getByRole('button', { name: new RegExp(`Add .${escapeRegExp(description)}. as a new item`) }).click();
      await expect(item.getByText('New item: stores will check for it and categorise it.')).toBeVisible();
    }

    if (pack) await this.fieldAfterLabel(item, 'Package', 'select').selectOption(pack);
    await this.fieldAfterLabel(item, 'Quantity', 'input').fill(String(quantity));
    if (unit) await this.fieldAfterLabel(item, 'Unit', 'select').selectOption(unit);
    if (estimatedUnitPrice !== undefined) await item.getByPlaceholder('0.00').fill(String(estimatedUnitPrice));
    if (specification) await item.getByPlaceholder('e.g., 80gsm white').fill(specification);

    await item.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(item).toBeHidden();
  }

  fieldAfterLabel(scope, label, tag) {
    return scope
      .locator('label')
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\b`) })
      .first()
      .locator(`xpath=following-sibling::${tag}[1]`);
  }

  /** "Submit for Approval", or "Send to Stores" for a department head's own. */
  async submit(asHead = false) {
    await this.drawer.getByRole('button', { name: asHead ? 'Send to Stores' : 'Submit for Approval', exact: true }).click();
    await this.expectToast('success');
    await expect(this.drawer).toBeHidden();
  }

  async saveDraft() {
    await this.drawer.getByRole('button', { name: 'Save Draft' }).click();
    await this.expectToast('success', 'Requisition saved as draft');
    await expect(this.drawer).toBeHidden();
  }
}

module.exports = { RequisitionsPage, RequisitionFormDrawer };
