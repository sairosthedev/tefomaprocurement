/**
 * The business unit this browser is signed in to.
 *
 * Until each SBU has its own domain, one deployment serves all of them and the
 * API needs to be told which one a request is for. The code is chosen on the
 * login page, sent as `X-Sbu-Code` on every call, and carried in the token
 * once signed in.
 */
const STORAGE_KEY = 'sbuCode';

export function getSbuCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing and blocked site data both throw here; the API falls
    // back to its default SBU, which is the right behaviour for one tenant.
    return null;
  }
}

export function setSbuCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase());
  } catch {
    /* nothing to do: the request header is simply omitted */
  }
}

export function clearSbuCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
