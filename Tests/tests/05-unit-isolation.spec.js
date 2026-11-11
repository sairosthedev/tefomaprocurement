/**
 * "The two units stay apart" (QA guide) and "Each unit stands alone"
 * (Scope Document, sections 2 and 10). Anything from one unit showing in the
 * other must be reported straight away.
 */
const { test, expect } = require('../fixtures/test');
const { pagesFor } = require('../pages');
const { UNITS } = require('../data/units');
const { ApiClient } = require('../utils/apiClient');
const { qaTitle } = require('../utils/testData');

/** The other unit: Fossil when testing Dokuma, and the reverse. */
const otherUnit = (unit) => (unit.key === 'dokuma' ? UNITS.fossil : UNITS.dokuma);

test.describe('The two units stay apart', () => {
  test("A user from the other unit cannot sign in on this unit's address", async ({ page, unit }) => {
    const { login } = pagesFor(page);
    await login.expectRefused(otherUnit(unit).accounts.requester);
  });

  test("A session from the other unit is refused by this unit's API", async ({ unit }) => {
    const other = otherUnit(unit);
    const signedIn = await ApiClient.signIn(other, other.accounts.requester);
    expect(signedIn.ok, 'sign in on the other unit').toBe(true);
    // Same token, sent from this unit's address.
    const client = signedIn.client;
    client.origin = unit.baseURL;
    client.sbuCode = unit.code;
    const res = await client.get('department/requisitions');
    expect(res.status, JSON.stringify(res.body)).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    await client.dispose();
  });

  test('A requisition raised in the other unit is not found here', async ({ signInAs, unit }) => {
    const other = otherUnit(unit);
    const title = qaTitle(`isolation probe from ${other.name}`);
    // Raise a draft in the other unit through its API.
    const signedIn = await ApiClient.signIn(other, other.accounts.requester);
    const created = await signedIn.client.post('department/requisitions', {
      title,
      justification: 'Isolation check',
      description: 'Isolation check',
      urgency: 'normal',
      status: 'draft',
      items: [{ description: title, quantity: 1, unit: 'Each', estimatedUnitPrice: 1 }]
    });
    expect(created.ok, JSON.stringify(created.body)).toBe(true);
    const prNumber = created.body.data?.requisitionNumber;
    await signedIn.client.dispose();

    const requester = await signInAs('requester');
    await requester.requisitions.open();
    await requester.requisitions.expectAbsent(title);
    if (prNumber) {
      // Numbering is per unit, so the same number may exist here: it must not be this title.
      const row = await requester.requisitions.find(prNumber);
      await expect(row.filter({ hasText: title })).toHaveCount(0);
    }
  });

  test('Each unit has its own supplier list', async ({ signInAs, unit }) => {
    const buyer = await signInAs('buyer');
    const api = await ApiClient.fromPage(buyer.page);
    const res = await api.get('procurement/suppliers?limit=200');
    expect(res.ok).toBe(true);
    const names = (res.body.data || []).map((s) => s.companyName);
    for (const s of unit.quotingSuppliers) expect(names).toContain(s.company);
    for (const s of otherUnit(unit).quotingSuppliers) expect(names).not.toContain(s.company);
    await api.dispose();
  });
});
