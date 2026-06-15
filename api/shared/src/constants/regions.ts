export const PROVINCES: readonly string[] = Object.freeze([
  'Harare',
  'Bulawayo',
  'Manicaland',
  'Mashonaland Central',
  'Mashonaland East',
  'Mashonaland West',
  'Masvingo',
  'Matabeleland North',
  'Matabeleland South',
  'Midlands'
]);

/** Zimbabwe first, then regional/international trading partners, then Other. */
export const COUNTRIES: readonly string[] = Object.freeze([
  'Zimbabwe',
  'Botswana',
  'China',
  'Democratic Republic of the Congo',
  'Eswatini',
  'France',
  'Germany',
  'Ghana',
  'India',
  'Indonesia',
  'Italy',
  'Japan',
  'Kenya',
  'Lesotho',
  'Malawi',
  'Malaysia',
  'Mexico',
  'Mozambique',
  'Namibia',
  'Netherlands',
  'Nigeria',
  'Pakistan',
  'Poland',
  'Qatar',
  'Rwanda',
  'Saudi Arabia',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Switzerland',
  'Tanzania',
  'Turkey',
  'Uganda',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Zambia',
  'Other'
]);

export const BANKS: readonly string[] = Object.freeze([
  'CBZ Bank',
  'FBC Bank',
  'Stanbic Bank Zimbabwe',
  'Standard Chartered Zimbabwe',
  'NMB Bank',
  'ZB Bank',
  'Steward Bank',
  'Ecobank Zimbabwe',
  'First Capital Bank',
  'BancABC',
  'POSB',
  'Nedbank Zimbabwe',
  'CABS',
  'AFC Holdings',
  'Metbank'
]);

export interface AccountType {
  value: string;
  label: string;
}

export const ACCOUNT_TYPES: readonly AccountType[] = Object.freeze([
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'nostro', label: 'Nostro (USD)' }
]);
