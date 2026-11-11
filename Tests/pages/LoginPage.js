const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { PASSWORD } = require('../data/units');

/**
 * The sign-in page at the unit's own address ("/"). There is no unit to pick:
 * the address decides it. Email and password, then a six-digit code which,
 * on the test units, fills itself in and signs the user in.
 */
class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.email = page.locator('#email');
    this.password = page.locator('#password');
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    this.otp = page.locator('#otp');
    this.verifyButton = page.getByRole('button', { name: 'Verify & sign in' });
    this.backToSignIn = page.getByRole('button', { name: 'Back to sign in' });
    this.registerLink = page.getByRole('link', { name: 'Register your company' });
  }

  async open() {
    await this.page.goto('/');
    await expect(this.email).toBeEditable({ timeout: 30_000 });
  }

  async enterCredentials(email, password = PASSWORD) {
    await this.email.fill(email);
    await this.password.fill(password);
    // What was typed is what is sent.
    await expect(this.email).toHaveValue(email);
    await this.continueButton.click();
  }

  /**
   * Sign in and wait for the app shell. The code step shows the address the
   * code went to, which must be the address that was typed.
   */
  async signIn(email, password = PASSWORD) {
    await this.open();
    // The app checks the session with /auth/me when /app loads. Wait for that
    // answer: it rewrites the stored session when it lands, so acting before
    // it (logging out, say) races with it.
    const sessionChecked = this.page
      .waitForResponse((r) => r.url().includes('/auth/me'), { timeout: 45_000 })
      .catch(() => null);
    await this.enterCredentials(email, password);
    // The code step names the address it was sent to. The code fills itself in
    // and signs in quickly, so the step may already be gone; then the session
    // check at the end proves the right person signed in.
    const sentTo = this.page.getByText(`We sent a 6-digit code to ${email}`);
    const onApp = () => /\/app(\/|\?|$)/.test(new URL(this.page.url()).pathname);
    await expect(async () => {
      if (onApp()) return;
      await expect(sentTo).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    // The code fills itself in and is submitted automatically; press Verify
    // only if it is still waiting.
    await expect(this.otp).toHaveValue(/^\d{6}$/, { timeout: 15_000 }).catch(() => {});
    await this.page.waitForURL(/\/app(\/|\?|$)/, { timeout: 30_000 }).catch(async () => {
      if (await this.verifyButton.isEnabled()) await this.verifyButton.click();
      await this.page.waitForURL(/\/app(\/|\?|$)/, { timeout: 30_000 });
    });
    await this.waitForAppShell();
    await sessionChecked;
    await this.expectSignedInAs(email);
  }

  /** The stored session belongs to the address that signed in. */
  async expectSignedInAs(email) {
    const stored = await this.page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('user') || 'null');
      } catch {
        return null;
      }
    });
    expect(stored?.email?.toLowerCase(), 'signed-in user').toBe(email.toLowerCase());
  }

  /** Sign-in is refused: no code step, an error toast, still on the login page. */
  async expectRefused(email, password = PASSWORD) {
    await this.open();
    await this.enterCredentials(email, password);
    await expect(this.toast('error')).toBeVisible();
    await expect(this.otp).toHaveCount(0);
    await expect(this.page).not.toHaveURL(/\/app/);
  }
}

module.exports = { LoginPage };
