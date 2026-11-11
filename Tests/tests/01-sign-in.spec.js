/**
 * Signing in (Scope Document, section 11: password, then a six-digit code)
 * and role-based access (section 5: each role sees and does only its own work).
 */
const { test, expect } = require('../fixtures/test');
const { pagesFor } = require('../pages');
const { PASSWORD } = require('../data/units');

const ROLE_NAMES = {
  requester: 'End User',
  head: 'Department Head',
  stores: 'Stores Officer',
  buyer: 'Procurement Officer',
  procHead: 'Head of Procurement',
  finance: 'Finance Manager',
  coo: 'Chief Operating Officer',
  admin: 'Administrator'
};

// Pages each role must not open (the app shows "Access Denied").
const FORBIDDEN = {
  requester: ['/app/purchase-orders', '/app/approvals', '/app/invoices', '/app/users'],
  stores: ['/app/purchase-orders', '/app/invoices', '/app/rfqs'],
  finance: ['/app/rfqs', '/app/deliveries', '/app/users'],
  coo: ['/app/rfqs', '/app/deliveries', '/app/invoices'],
  admin: ['/app/rfqs', '/app/approvals', '/app/invoices', '/app/deliveries']
};

/**
 * Signed out for good: no token is stored, and none comes back while
 * anything the page sent before logout is still answering. Reopening /app
 * then goes back to the sign-in page.
 */
async function expectSignedOut(page) {
  const tokenStored = () => page.evaluate(() => !!localStorage.getItem('token'));
  expect(await tokenStored(), 'token straight after logout').toBe(false);
  await page.waitForTimeout(5000);
  expect(await tokenStored(), 'token 5 seconds after logout').toBe(false);
  await page.goto('/app');
  await expect(page.locator('#email')).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/app/);
}

test.describe('Signing in', () => {
  for (const [role, roleName] of Object.entries(ROLE_NAMES)) {
    test(`${roleName} signs in with password and code, and lands on their dashboard`, async ({ signInAs, unit }) => {
      const user = await signInAs(role);
      await user.dashboard.open();
      await expect(user.page.getByText(new RegExp(`^${roleName} Dashboard`))).toBeVisible();
      // The session is bound to this unit.
      const sbu = await user.page.evaluate(() => localStorage.getItem('sbuCode'));
      expect(sbu).toBe(unit.code);
    });
  }

  test('A supplier signs in to the supplier portal', async ({ signInAs, unit }) => {
    const supplier = await signInAs(unit.quotingSuppliers[0].email);
    await supplier.dashboard.open();
    await expect(supplier.page.getByText(/^Supplier Dashboard/)).toBeVisible();
    await expect(supplier.base.sidebarLink('Dashboard')).toBeVisible();
    // Suppliers never reach internal screens.
    await supplier.page.goto('/app/requisitions');
    await expect(supplier.page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
  });

  test('A wrong password is refused', async ({ page, unit }) => {
    const { login } = pagesFor(page);
    await login.expectRefused(unit.accounts.requester, `${PASSWORD}-wrong`);
  });

  test('Signing out returns to the sign-in page and ends the session', async ({ signInAs }) => {
    // signInAs waits for the page to finish checking the session, as a user would.
    const user = await signInAs('requester');
    await user.base.logout();
    await expect(user.login.email).toBeVisible();
    await expectSignedOut(user.page);
  });

  // Known bug, found 11 Nov 2026: logging out before the page has finished
  // loading does not stick. The /auth/me request sent on load answers after
  // the logout, and AuthContext.initAuth saves the token again, so reopening
  // /app signs the user straight back in. The dashboard can take 6-7 seconds
  // on its first load, so this happens in real use. Marked test.fail(): it
  // passes while the bug is there, and Playwright reports it once fixed, so
  // the marker can be removed.
  test('Signing out before the page finishes loading also ends the session', async ({ signInAs }) => {
    test.fail(true, 'Known bug: a late /auth/me reply restores the session after logout');
    const user = await signInAs('requester');
    // Hold the session check back for 3 seconds, as a slow first load does.
    await user.page.route('**/auth/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue().catch(() => {});
    });
    await user.page.reload();
    await user.base.waitForAppShell();
    await user.base.logout();
    await expect(user.login.email).toBeVisible();
    await user.page.unroute('**/auth/me');
    await expectSignedOut(user.page);
  });
});

test.describe('Each role sees only its own work', () => {
  for (const [role, paths] of Object.entries(FORBIDDEN)) {
    test(`${ROLE_NAMES[role]} cannot open other roles' pages`, async ({ signInAs }) => {
      const user = await signInAs(role);
      for (const path of paths) {
        await test.step(path, async () => {
          await user.page.goto(path);
          await expect(user.page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
        });
      }
    });
  }
});
