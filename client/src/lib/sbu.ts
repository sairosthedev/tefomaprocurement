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

export function setSbuCode(code: string, baseCurrency?: string): void {
  try {
    const next = code.trim().toUpperCase();
    if (baseCurrency) {
      localStorage.setItem(CURRENCY_KEY, baseCurrency.trim().toUpperCase());
    } else if (localStorage.getItem(STORAGE_KEY) !== next) {
      // A different business unit: the cached currency no longer applies.
      localStorage.removeItem(CURRENCY_KEY);
    }
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* nothing to do: the request header is simply omitted */
  }
}

export function clearSbuCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENCY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The selected business unit's base currency, cached next to its code so
 * totals that belong to no single document (dashboards, budgets, inventory
 * value) can be shown in the right currency without another request.
 */
const CURRENCY_KEY = 'sbuBaseCurrency';
const FALLBACK_CURRENCY = 'USD';

export interface SbuDirectoryEntry {
  code: string;
  name: string;
  country: string;
  baseCurrency?: string;
}

export function getCurrentSbuCurrency(): string {
  try {
    return localStorage.getItem(CURRENCY_KEY) || FALLBACK_CURRENCY;
  } catch {
    return FALLBACK_CURRENCY;
  }
}

export function setSbuCurrency(currency: string | null | undefined): void {
  try {
    if (currency) localStorage.setItem(CURRENCY_KEY, currency.trim().toUpperCase());
    else localStorage.removeItem(CURRENCY_KEY);
  } catch {
    /* the fallback currency is used instead */
  }
}

/**
 * Cache the base currency of the stored SBU from a `/api/sbus` response.
 * `current` (resolved by domain) wins over the stored code.
 */
export function rememberSbuCurrency(
  list: SbuDirectoryEntry[],
  current?: { code: string; baseCurrency?: string } | null
): void {
  const code = current?.code || getSbuCode();
  if (!code) return;
  const entry = list.find((o) => o.code === code) || (current?.code === code ? current : null);
  if (entry?.baseCurrency) setSbuCurrency(entry.baseCurrency);
}
