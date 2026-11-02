export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: readonly Currency[] = Object.freeze([
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'ZWG', symbol: 'ZWG', name: 'Zimbabwean Gold' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'SZL', symbol: 'E', name: 'Swazi Lilangeni' }
]);

export const DEFAULT_CURRENCY = 'USD';

export const SUPPORTED_CURRENCY_CODES: readonly string[] = Object.freeze(
  CURRENCIES.map((c) => c.code)
);

export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();

  if (code === 'ZWG') {
    return `ZWG ${new Intl.NumberFormat('en-ZW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)}`;
  }

  if (code === 'ZAR' || code === 'SZL') {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: code
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}
