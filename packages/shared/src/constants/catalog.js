'use strict';

const SUPPLIER_CATEGORIES = Object.freeze([
  'Construction Materials',
  'Office Supplies',
  'IT Equipment & Services',
  'Electrical Supplies',
  'Plumbing Materials',
  'Safety Equipment',
  'Vehicles & Machinery',
  'Furniture',
  'Cleaning Supplies',
  'Catering & Food Services',
  'Security Services',
  'Professional Services',
  'Agricultural Supplies',
  'Mining Equipment',
  'Transport & Logistics',
  'Medical Supplies',
  'Stationery',
  'Hardware',
  'Other'
]);

const UNITS_OF_MEASUREMENT = Object.freeze([
  'Each',
  'Pack',
  'Box',
  'Carton',
  'Kg',
  'Ton',
  'Liter',
  'Meter',
  'Square Meter',
  'Cubic Meter',
  'Roll',
  'Sheet',
  'Pair',
  'Set',
  'Bag',
  'Drum',
  'Ream',
  'Dozen'
]);

const UNIT_OPTIONS = Object.freeze([
  { value: 'Each', label: 'Each' },
  { value: 'Pack', label: 'Pack' },
  { value: 'Box', label: 'Box' },
  { value: 'Carton', label: 'Carton' },
  { value: 'Kg', label: 'Kilograms (kg)' },
  { value: 'Ton', label: 'Tons' },
  { value: 'Liter', label: 'Liters' },
  { value: 'Meter', label: 'Meters' },
  { value: 'Square Meter', label: 'Square Meters' },
  { value: 'Cubic Meter', label: 'Cubic Meters' },
  { value: 'Roll', label: 'Rolls' },
  { value: 'Sheet', label: 'Sheets' },
  { value: 'Pair', label: 'Pairs' },
  { value: 'Set', label: 'Sets' },
  { value: 'Bag', label: 'Bags' },
  { value: 'Drum', label: 'Drums' },
  { value: 'Ream', label: 'Reams' },
  { value: 'Dozen', label: 'Dozens' }
]);

module.exports = { SUPPLIER_CATEGORIES, UNITS_OF_MEASUREMENT, UNIT_OPTIONS };
