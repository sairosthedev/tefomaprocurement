// Currency configuration
export const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'ZWG', symbol: 'ZWG', name: 'Zimbabwean Gold' }
];

export const defaultCurrency = 'USD';

export const formatCurrency = (amount, currency = 'USD') => {
  if (currency === 'ZWG') {
    return `ZWG ${new Intl.NumberFormat('en-ZW', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount || 0)}`;
  }
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(amount || 0);
};

// Zimbabwe Provinces
export const provinces = [
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
];

// Zimbabwe Banks
export const banks = [
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
];

// Supplier Categories
export const supplierCategories = [
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
];

// Account Types
export const accountTypes = [
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'nostro', label: 'Nostro (USD)' }
];

// Units of Measurement
export const units = [
  { value: 'units', label: 'Units' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'tons', label: 'Tons' },
  { value: 'liters', label: 'Liters' },
  { value: 'meters', label: 'Meters' },
  { value: 'sqm', label: 'Square Meters' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'packs', label: 'Packs' },
  { value: 'bags', label: 'Bags' },
  { value: 'drums', label: 'Drums' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'sheets', label: 'Sheets' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'sets', label: 'Sets' }
];

