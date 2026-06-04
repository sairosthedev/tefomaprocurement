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
