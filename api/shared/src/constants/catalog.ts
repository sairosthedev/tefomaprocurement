export const SUPPLIER_CATEGORIES: readonly string[] = Object.freeze([
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

export const UNITS_OF_MEASUREMENT: readonly string[] = Object.freeze([
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

export interface UnitOption {
  value: string;
  label: string;
}

export const UNIT_OPTIONS: readonly UnitOption[] = Object.freeze([
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
