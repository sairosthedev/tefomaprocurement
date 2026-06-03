'use strict';

const CURRENCIES = Object.freeze([
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'ZWG', symbol: 'ZWG', name: 'Zimbabwean Gold' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' }
]);

const DEFAULT_CURRENCY = 'USD';

const SUPPORTED_CURRENCY_CODES = Object.freeze(CURRENCIES.map((c) => c.code));

function formatCurrency(amount, currency = DEFAULT_CURRENCY) {
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

module.exports = {
  CURRENCIES,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCY_CODES,
  formatCurrency
};
