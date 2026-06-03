'use strict';

const PROVINCES = Object.freeze([
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

const BANKS = Object.freeze([
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

const ACCOUNT_TYPES = Object.freeze([
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'nostro', label: 'Nostro (USD)' }
]);

module.exports = { PROVINCES, BANKS, ACCOUNT_TYPES };
