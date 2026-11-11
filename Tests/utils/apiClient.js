const { request } = require('@playwright/test');
const { API_URL, PASSWORD } = require('../data/units');

/**
 * Calls the Procureline API as a signed-in user.
 *
 * Used where the UI rightly hides a button, so the only way to prove a rule
 * is enforced on the server (Scope Document, section 11: "hiding a button is
 * never the only protection") is to send the request the button would have
 * sent, and to read figures such as a PO total to decide what to expect.
 */
class ApiClient {
  constructor(context, token, sbuCode, origin) {
    this.context = context;
    this.token = token;
    this.sbuCode = sbuCode;
    // The API picks the business unit from the Origin first, so every call
    // carries the unit's own address, as the browser's calls do.
    this.origin = origin;
  }

  /** Reuse the session the browser holds after a UI sign-in. */
  static async fromPage(page) {
    const { token, sbuCode, origin } = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      sbuCode: localStorage.getItem('sbuCode'),
      origin: window.location.origin
    }));
    if (!token) throw new Error('No session in this page: sign in first');
    const context = await request.newContext({ baseURL: `${API_URL}/api/` });
    return new ApiClient(context, token, sbuCode, origin);
  }

  /**
   * Sign in through the API: password, then the six-digit code. On the test
   * units the API returns the code (debugOtp), which is what fills it in on
   * the login page.
   */
  static async signIn(unit, email, password = PASSWORD) {
    const context = await request.newContext({
      baseURL: `${API_URL}/api/`,
      extraHTTPHeaders: { 'X-Sbu-Code': unit.code, Origin: unit.baseURL }
    });
    const login = await context.post('auth/login', { data: { email, password } });
    const body = await login.json().catch(() => ({}));
    if (!login.ok()) {
      return { ok: false, status: login.status(), body, client: null };
    }
    if (!body.requiresOtp) {
      return { ok: !!body.token, status: login.status(), body, client: new ApiClient(context, body.token, unit.code, unit.baseURL) };
    }
    if (!body.debugOtp) throw new Error('The API did not return the sign-in code; the test units should expose it');
    const verify = await context.post('auth/verify-otp', { data: { email, otp: String(body.debugOtp) } });
    const verified = await verify.json().catch(() => ({}));
    return {
      ok: verify.ok() && !!verified.token,
      status: verify.status(),
      body: verified,
      client: verified.token ? new ApiClient(context, verified.token, unit.code, unit.baseURL) : null
    };
  }

  headers() {
    const h = { Authorization: `Bearer ${this.token}`, Accept: 'application/json' };
    if (this.sbuCode) h['X-Sbu-Code'] = this.sbuCode;
    if (this.origin) h.Origin = this.origin;
    return h;
  }

  async call(method, path, data) {
    const res = await this.context.fetch(path.replace(/^\//, ''), {
      method,
      headers: this.headers(),
      ...(data !== undefined ? { data } : {})
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status(), ok: res.ok(), body };
  }

  get(path) { return this.call('GET', path); }
  post(path, data) { return this.call('POST', path, data ?? {}); }
  put(path, data) { return this.call('PUT', path, data ?? {}); }

  async dispose() {
    await this.context.dispose();
  }
}

module.exports = { ApiClient };
