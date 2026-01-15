// Currency configuration
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'ZWG', symbol: 'ZWG', name: 'Zimbabwean Gold' }
];
export const currencies = CURRENCIES; // alias

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
export const PROVINCES = [
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
export const provinces = PROVINCES; // alias

// Zimbabwe Banks
export const BANKS = [
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
export const banks = BANKS; // alias

// Supplier Categories
export const SUPPLIER_CATEGORIES = [
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
export const supplierCategories = SUPPLIER_CATEGORIES; // alias

// Account Types
export const accountTypes = [
  { value: 'current', label: 'Current Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'nostro', label: 'Nostro (USD)' }
];

// Units of Measurement
export const UNITS_OF_MEASUREMENT = [
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
];

export const units = [
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
];

// User Roles
export const USER_ROLES = [
  { value: 'admin', label: 'System Administrator' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'finance', label: 'Finance Manager' },
  { value: 'coo', label: 'Chief Operating Officer' },
  { value: 'stores_officer', label: 'Stores Officer' },
  { value: 'supplier', label: 'Supplier' }
];

