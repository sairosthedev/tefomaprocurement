const { expect } = require('@playwright/test');
const { escapeRegExp } = require('../utils/testData');

const TOAST_CLASS = { success: '.bg-green-50', error: '.bg-red-50', warning: '.bg-amber-50' };

/**
 * What every screen shares: the page heading, toasts, dialogs, tables, the
 * sidebar and signing out. The app has no data-testid attributes, so these
 * helpers rely on roles, visible text and the few stable class names.
 */
class BasePage {
  constructor(page) {
    this.page = page;
  }

  /** The <h1> every page renders through PageHeader. */
  get heading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  async goto(path) {
    await this.page.goto(path);
    await this.waitForAppShell();
  }

  /** The signed-in layout has loaded: the sidebar's Logout button is present. */
  async waitForAppShell() {
    await expect(this.page.getByRole('button', { name: /^Logout$/ }).or(this.page.getByTitle('Logout')).first())
      .toBeVisible({ timeout: 30_000 });
    await this.waitForTableToSettle();
  }

  /** Lists show skeleton rows (animate-pulse) while loading. */
  async waitForTableToSettle() {
    await expect(this.page.locator('tbody .animate-pulse')).toHaveCount(0, { timeout: 30_000 });
  }

  /**
   * A toast. Toasts have no role; each is a coloured card holding the
   * message in a span, and disappears after four seconds.
   */
  toast(type, text) {
    let locator = this.page.locator(`div.fixed.top-4 ${type ? TOAST_CLASS[type] : 'div.rounded-xl.border'}`);
    if (text) locator = locator.filter({ hasText: text instanceof RegExp ? text : new RegExp(escapeRegExp(text), 'i') });
    return locator.first();
  }

  async expectToast(type, text) {
    await expect(this.toast(type, text)).toBeVisible();
  }

  /** A modal or drawer, by its title. */
  dialog(name) {
    return name
      ? this.page.getByRole('dialog', { name: name instanceof RegExp ? name : new RegExp(escapeRegExp(name), 'i') })
      : this.page.getByRole('dialog').last();
  }

  /** The table row that mentions a document number or title. */
  row(text) {
    return this.page.locator('tbody tr').filter({ hasText: text });
  }

  /**
   * The value next to a label: <dt>/<dd> pairs, or a label paragraph followed
   * by its value, which is how detail pages and review modals lay out facts.
   */
  fact(label, scope = this.page) {
    const exact = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:?\\s*$`, 'i');
    return scope
      .locator('dt, label, p, span')
      .filter({ hasText: exact })
      .first()
      .locator('xpath=following-sibling::*[1]');
  }

  async expectFact(label, value, scope = this.page) {
    await expect(this.fact(label, scope)).toContainText(value instanceof RegExp ? value : String(value));
  }

  /** Type into a list's search box, which filters as you type. */
  async search(placeholder, text) {
    const box = this.page.getByPlaceholder(placeholder);
    await box.fill(text);
    await expect(box).toHaveValue(text);
    // The search is debounced; wait for the list to reload.
    await this.page.waitForTimeout(600);
    await this.waitForTableToSettle();
  }

  /** Pick a status from a list's filter (a native select labelled "Status"). */
  async filterStatus(label) {
    await this.page.locator('label:has(span.sr-only) select').first().selectOption({ label });
    await this.waitForTableToSettle();
  }

  /**
   * Open a sidebar link. Sections open one at a time and their links only
   * render while open, so open the section first when one is given.
   */
  async navigate(linkName, section) {
    if (section) {
      const link = this.sidebarLink(linkName);
      if (!(await link.isVisible())) await this.page.getByRole('button', { name: new RegExp(`^${escapeRegExp(section)}`) }).click();
    }
    await this.sidebarLink(linkName).click();
    await this.waitForTableToSettle();
  }

  sidebarLink(name) {
    // A badge count follows the label, so match the start of the name.
    return this.page.locator('aside, nav').getByRole('link', { name: new RegExp(`^${escapeRegExp(name)}(\\s*\\d+\\+?)?$`) }).first();
  }

  async logout() {
    await this.page.getByRole('button', { name: /^Logout$/ }).or(this.page.getByTitle('Logout')).first().click();
    await expect(this.page.getByRole('heading', { name: 'Confirm Logout' })).toBeVisible();
    await this.page.getByRole('button', { name: 'Yes, Logout' }).click();
    await this.page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
  }

  /**
   * How many records the list holds: the pager's "Page 1 of 2 · 7 items",
   * or the rows on screen when everything fits without a pager.
   */
  async listTotal() {
    await this.waitForTableToSettle();
    const pager = this.page.getByText(/^Page \d+ of \d+ · \d+/).first();
    if (await pager.isVisible().catch(() => false)) {
      return Number((await pager.innerText()).match(/· (\d+)/)[1]);
    }
    // An empty list shows one row holding its empty message.
    const rows = this.page.locator('tbody tr').filter({ hasNot: this.page.locator('td[colspan]') });
    return rows.count();
  }

  /** The document number in a row, e.g. PR-2026-00012. */
  async documentNumberIn(row, prefix) {
    const text = await row.innerText();
    const match = text.match(new RegExp(`\\b${prefix}-[A-Z0-9-]+`));
    if (!match) throw new Error(`No ${prefix} number in row: ${text}`);
    return match[0];
  }
}

module.exports = { BasePage };
