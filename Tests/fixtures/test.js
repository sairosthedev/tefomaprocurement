const base = require('@playwright/test');
const { pagesFor } = require('../pages');
const { unitFor } = require('../data/units');

/**
 * Fixtures shared by every spec.
 *
 * - `unit`: the business unit this project runs against (Dokuma or Fossil).
 * - `signInAs(role)`: a fresh browser context signed in as one of the unit's
 *   test accounts. Each role gets its own context, the way the QA guide asks
 *   testers to use a second browser or a private window to act as two people.
 *   Returns `{ page, email, ...pageObjects }`.
 */
const test = base.test.extend({
  unit: async ({}, use, testInfo) => {
    await use(unitFor(testInfo));
  },

  signInAs: async ({ browser, unit }, use, testInfo) => {
    const contexts = [];
    const signIn = async (roleOrEmail) => {
      const email = unit.accounts[roleOrEmail] || roleOrEmail;
      const context = await browser.newContext({ baseURL: unit.baseURL });
      contexts.push(context);
      const page = await context.newPage();
      const pages = pagesFor(page);
      await base.test.step(`sign in as ${email}`, () => pages.login.signIn(email));
      return { page, email, context, ...pages };
    };
    await use(signIn);
    for (const context of contexts) {
      if (testInfo.status !== testInfo.expectedStatus) {
        // Keep a picture of every role's screen at the moment a step failed.
        for (const [i, p] of context.pages().entries()) {
          await testInfo.attach(`screen-${contexts.indexOf(context)}-${i}`, {
            body: await p.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0)),
            contentType: 'image/png'
          });
        }
      }
      await context.close();
    }
  }
});

module.exports = { test, expect: base.expect };
