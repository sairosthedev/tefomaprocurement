import FxRate, { type IFxRate } from '../models/FxRate.model.js';

/**
 * Conversion to USD for group-wide rules — the COO threshold today, group
 * spend reporting next. Rates come from the FxRate registry; nothing here
 * guesses a rate, so a currency without one reports `null` and the caller
 * decides how to fail safe.
 */

const CACHE_TTL_MS = parseInt(process.env.FX_RATE_CACHE_MS || '60000', 10);
const cache = new Map<string, { rate: number | null; expiresAt: number }>();

/** Units of `currency` per USD in force at `at`, or null when none is recorded. */
export async function unitsPerUsd(currency: string, at: Date = new Date()): Promise<number | null> {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'USD') return 1;

  const useCache = Math.abs(Date.now() - at.getTime()) < CACHE_TTL_MS;
  const cached = cache.get(code);
  if (useCache && cached && cached.expiresAt > Date.now()) return cached.rate;

  const row = await FxRate.findOne({ currency: code, effectiveFrom: { $lte: at } })
    .sort({ effectiveFrom: -1 })
    .lean<IFxRate>();
  const rate = row?.unitsPerUsd ?? null;

  if (useCache) cache.set(code, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
  return rate;
}

export interface UsdConversion {
  amountUsd: number;
  /** Units of the source currency per USD that were applied. */
  rate: number;
}

export async function toUsd(amount: number, currency: string, at?: Date): Promise<UsdConversion | null> {
  const rate = await unitsPerUsd(currency, at);
  if (!rate) return null;
  return { amountUsd: Math.round((amount / rate) * 100) / 100, rate };
}

export function invalidateFxCache(): void {
  cache.clear();
}
