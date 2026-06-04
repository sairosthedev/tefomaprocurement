export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: readonly Currency[] = Object.freeze([
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'ZWG', symbol: 'ZWG', name: 'Zimbabwean Gold' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' }
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

  if (currency === 'ZWG') {
    return `ZWG ${new Intl.NumberFormat('en-ZW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)}`;
  }

  if (currency === 'ZAR') {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}
