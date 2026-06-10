/**
 * Canonical Supplier & Item category taxonomy.
 *
 * Source of truth for vendor `categories`, item `category`, and RFQ line
 * `categoryName` (which should carry the category CODE so suppliers can be
 * auto-matched / invited on issue).
 *
 * - Stored in DB: `code` (e.g. "ICT-HW")
 * - Shown in UI:  `name`
 * - Grouped by:   `section`
 */

export interface SupplierCategory {
  code: string;
  name: string;
  section: string;
}

export const SUPPLIER_CATEGORY_LIST: readonly SupplierCategory[] = Object.freeze([
  // Agriculture
  { code: 'AG-SEED', name: 'Seeds, Fertilizers & Crop Chemicals', section: 'Agriculture' },
  { code: 'AG-EQUIP', name: 'Agricultural Equipment & Machinery', section: 'Agriculture' },
  { code: 'AG-HIRE', name: 'Hire of Agricultural Equipment', section: 'Agriculture' },
  { code: 'AG-HARVEST', name: 'Harvesting Services', section: 'Agriculture' },
  { code: 'AG-GRAIN', name: 'Grain Supply (Maize, Rice, Wheat etc.)', section: 'Agriculture' },
  { code: 'AG-FEED', name: 'Livestock Feed, Premixes & Additives', section: 'Agriculture' },
  { code: 'AG-IRRIG', name: 'Irrigation Equipment & Installation', section: 'Agriculture' },
  { code: 'AG-SANIT', name: 'Sanitary Products & Services', section: 'Agriculture' },

  // Automotive & Transport
  { code: 'AUTO-NEW-LV', name: 'New Light Motor Vehicles', section: 'Automotive & Transport' },
  { code: 'AUTO-NEW-HV', name: 'New Heavy Motor Vehicles & Buses', section: 'Automotive & Transport' },
  { code: 'AUTO-NEW-MC', name: 'New Motor Cycles & Bicycles', section: 'Automotive & Transport' },
  { code: 'AUTO-USED', name: 'Used Vehicles & Motor Cycles', section: 'Automotive & Transport' },
  { code: 'AUTO-SPARE', name: 'Motor Vehicle Spares, Tyres & Accessories', section: 'Automotive & Transport' },
  { code: 'AUTO-BODY', name: 'Vehicle Bodies, Trailers & Conversions', section: 'Automotive & Transport' },
  { code: 'AUTO-PANEL', name: 'Panel Beating & Accident Repairs', section: 'Automotive & Transport' },
  { code: 'AUTO-TYRE', name: 'Tyre Repairs, Balancing & Alignment', section: 'Automotive & Transport' },
  { code: 'AUTO-TOWING', name: 'Vehicle Towing Services', section: 'Automotive & Transport' },
  { code: 'AUTO-PARK', name: 'Vehicle Parking Services', section: 'Automotive & Transport' },
  { code: 'AUTO-PLATES', name: 'Vehicle Registration Plates & Accessories', section: 'Automotive & Transport' },
  { code: 'AUTO-CARGO', name: 'Bulk & Cargo Transport Services', section: 'Automotive & Transport' },
  { code: 'AUTO-PASS', name: 'Passenger Transport, Travel & Tours', section: 'Automotive & Transport' },

  // Building & Construction
  { code: 'BUILD-CIVIL', name: 'Civil Works (Buildings, Dams, Roads)', section: 'Building & Construction' },
  { code: 'BUILD-MECH', name: 'Mechanical & Structural Engineering', section: 'Building & Construction' },
  { code: 'BUILD-ELEC', name: 'Overhead Electricity Transmission Works', section: 'Building & Construction' },
  { code: 'BUILD-CABLE', name: 'Cable Trenching', section: 'Building & Construction' },
  { code: 'BUILD-BOREHOLE', name: 'Borehole Siting, Drilling & Repairs', section: 'Building & Construction' },
  { code: 'BUILD-REPAIR', name: 'Building & Roof Repairs and Maintenance', section: 'Building & Construction' },
  { code: 'BUILD-TILE', name: 'Tiling & Carpeting Services', section: 'Building & Construction' },
  { code: 'BUILD-PAINT', name: 'Painting Services', section: 'Building & Construction' },
  { code: 'BUILD-PLUMB', name: 'Plumbing & Piping Services', section: 'Building & Construction' },
  { code: 'BUILD-FENCE', name: 'Fencing Services', section: 'Building & Construction' },
  { code: 'BUILD-MAT', name: 'Construction Materials & Aggregates', section: 'Building & Construction' },
  { code: 'BUILD-PIPE', name: 'PVC, HDPE & GRP Pipes and Fittings', section: 'Building & Construction' },
  { code: 'BUILD-TIMBER', name: 'Timber, Boards & Lumber', section: 'Building & Construction' },
  { code: 'BUILD-PROP', name: 'Property Development (Residential & Commercial)', section: 'Building & Construction' },

  // Catering & Food
  { code: 'FOOD-CATER', name: 'Catering Services', section: 'Catering & Food' },
  { code: 'FOOD-EQUIP', name: 'Catering Equipment & Accessories', section: 'Catering & Food' },
  { code: 'FOOD-GROCERY', name: 'Groceries & Provisions', section: 'Catering & Food' },
  { code: 'FOOD-VEGE', name: 'Fresh Farm Produce (Vegetables & Fruits)', section: 'Catering & Food' },
  { code: 'FOOD-BUTCH', name: 'Butchery (Beef, Pork, Poultry & Fish)', section: 'Catering & Food' },
  { code: 'FOOD-HOTELS', name: 'Hotels & Conference Facilities', section: 'Catering & Food' },

  // Chemicals & Fuels
  { code: 'CHEM-FUEL', name: 'Fuels & Lubricants', section: 'Chemicals & Fuels' },
  { code: 'CHEM-LUB', name: 'Lubricants Only', section: 'Chemicals & Fuels' },
  { code: 'CHEM-GAS', name: 'Gas (Industrial & Domestic)', section: 'Chemicals & Fuels' },
  { code: 'CHEM-COAL', name: 'Coal', section: 'Chemicals & Fuels' },
  { code: 'CHEM-IND', name: 'Industrial Chemicals', section: 'Chemicals & Fuels' },
  { code: 'CHEM-CLEAN', name: 'Cleaning Chemicals & Consumables', section: 'Chemicals & Fuels' },
  { code: 'CHEM-WATER', name: 'Water Treatment Chemicals', section: 'Chemicals & Fuels' },
  { code: 'CHEM-PEST', name: 'Herbicides, Pesticides & Vector Control', section: 'Chemicals & Fuels' },
  { code: 'CHEM-PAINT', name: 'Paints & Accessories', section: 'Chemicals & Fuels' },

  // Consulting & Professional Services
  { code: 'CON-MGMT', name: 'Management & General Consultancy', section: 'Consulting & Professional Services' },
  { code: 'CON-HR', name: 'Human Resources Consultancy', section: 'Consulting & Professional Services' },
  { code: 'CON-ENG', name: 'Engineering Consultancy', section: 'Consulting & Professional Services' },
  { code: 'CON-ARCH', name: 'Architectural Services', section: 'Consulting & Professional Services' },
  { code: 'CON-QS', name: 'Quantity Surveying', section: 'Consulting & Professional Services' },
  { code: 'CON-PLAN', name: 'Town Planning', section: 'Consulting & Professional Services' },
  { code: 'CON-SURV', name: 'Land Surveying & Geomatics', section: 'Consulting & Professional Services' },
  { code: 'CON-ACTUARY', name: 'Actuarial Consultancy', section: 'Consulting & Professional Services' },
  { code: 'CON-PROJ', name: 'Project Management', section: 'Consulting & Professional Services' },
  { code: 'CON-EIA', name: 'Environmental Impact Assessment', section: 'Consulting & Professional Services' },
  { code: 'CON-CAP', name: 'Capital Raising, Debt Restructuring & M&A', section: 'Consulting & Professional Services' },

  // Education & Training
  { code: 'EDU-PRINT', name: 'Textbook & Booklet Publishing', section: 'Education & Training' },
  { code: 'EDU-TRAIN', name: 'Training & Skills Development Services', section: 'Education & Training' },

  // Electrical & Energy
  { code: 'ELEC-SUPPLY', name: 'Electrical Cables, Generators & Power Back-Up', section: 'Electrical & Energy' },
  { code: 'ELEC-SOLAR', name: 'Solar Panels & Accessories', section: 'Electrical & Energy' },
  { code: 'ELEC-METER', name: 'Pre-paid Meters (Electricity & Water)', section: 'Electrical & Energy' },
  { code: 'ELEC-MAINT', name: 'Electrical Maintenance & Repair Works', section: 'Electrical & Energy' },
  { code: 'ELEC-FIBER', name: 'Fiber Optic Cables & Accessories', section: 'Electrical & Energy' },
  { code: 'ELEC-BIOGAS', name: 'Biogas Equipment Installation & Maintenance', section: 'Electrical & Energy' },

  // Environment & Waste
  { code: 'ENV-WASTE', name: 'Waste Collection & Management', section: 'Environment & Waste' },
  { code: 'ENV-FUMIGATE', name: 'Fumigation Services', section: 'Environment & Waste' },
  { code: 'ENV-POLLUTE', name: 'Pollution Tracking, Monitoring & Rehabilitation', section: 'Environment & Waste' },
  { code: 'ENV-CLOUD', name: 'Cloud Seeding', section: 'Environment & Waste' },
  { code: 'ENV-SCRAP', name: 'Scrap Metal & Waste Products', section: 'Environment & Waste' },

  // Finance & Banking
  { code: 'FIN-AUDIT', name: 'Audit Services (External)', section: 'Finance & Banking' },
  { code: 'FIN-INS', name: 'Insurance & Brokerage Services', section: 'Finance & Banking' },
  { code: 'FIN-BANK', name: 'Investment & Banking Services', section: 'Finance & Banking' },
  { code: 'FIN-DEBT', name: 'Debt Collection Services', section: 'Finance & Banking' },
  { code: 'FIN-PROP-EVAL', name: 'Property Evaluation & Estate Agents', section: 'Finance & Banking' },

  // Health & Medical
  { code: 'MED-DRUG', name: 'Medical Drugs, Supplies & Consumables', section: 'Health & Medical' },
  { code: 'MED-EQUIP', name: 'Medical & Laboratory Equipment and Spares', section: 'Health & Medical' },
  { code: 'MED-SERV', name: 'Medical Practice & Health Services', section: 'Health & Medical' },
  { code: 'MED-PHARMA', name: 'Pharmaceuticals (Non-Drug Medical Supplies)', section: 'Health & Medical' },
  { code: 'MED-MAINT', name: 'Medical & Laboratory Equipment Maintenance', section: 'Health & Medical' },
  { code: 'MED-RADIOL', name: 'Diagnostic & Interventional Radiology', section: 'Health & Medical' },
  { code: 'MED-MALARIA', name: 'Malaria & Vector Control Products', section: 'Health & Medical' },

  // ICT & Technology
  { code: 'ICT-HW', name: 'Computers, Printers, Photocopiers & Networking Equipment', section: 'ICT & Technology' },
  { code: 'ICT-SW', name: 'Software Development, Applications & Cybersecurity', section: 'ICT & Technology' },
  { code: 'ICT-MAINT', name: 'ICT Equipment Maintenance & Repair', section: 'ICT & Technology' },
  { code: 'ICT-TELECOM', name: 'Telecommunications & Internet Systems', section: 'ICT & Technology' },
  { code: 'ICT-RADIO', name: 'Radios, Mobile Phones & Communication Accessories', section: 'ICT & Technology' },
  { code: 'ICT-CALIB', name: 'Calibration of Equipment', section: 'ICT & Technology' },
  { code: 'ICT-METEO', name: 'Meteorology & Navigation Systems', section: 'ICT & Technology' },
  { code: 'ICT-AVIAT', name: 'Aviation & Surveillance Systems', section: 'ICT & Technology' },
  { code: 'ICT-INSPECT', name: 'Testing & Inspection Services', section: 'ICT & Technology' },

  // Industrial & Mining
  { code: 'IND-MINE', name: 'Mining Equipment, Consumables & Accessories', section: 'Industrial & Mining' },
  { code: 'IND-PLANT', name: 'New Plant & Equipment', section: 'Industrial & Mining' },
  { code: 'IND-USED-PLANT', name: 'Used Plant & Equipment', section: 'Industrial & Mining' },
  { code: 'IND-MAINT', name: 'Plant & Equipment Maintenance', section: 'Industrial & Mining' },
  { code: 'IND-BLASTING', name: 'Blasting Services', section: 'Industrial & Mining' },
  { code: 'IND-LOCO', name: 'Locomotives, Railway Equipment & Spares', section: 'Industrial & Mining' },
  { code: 'IND-LOCO-MAINT', name: 'Railway Locomotive Maintenance', section: 'Industrial & Mining' },
  { code: 'IND-MILLING', name: 'Milling Services (Grain, Saw etc.)', section: 'Industrial & Mining' },
  { code: 'IND-MARINE', name: 'Marine Equipment & Services', section: 'Industrial & Mining' },
  { code: 'IND-GAS-MAINT', name: 'Gas Equipment Installation & Maintenance', section: 'Industrial & Mining' },
  { code: 'IND-COMPRESS', name: 'Air Compressor Installation & Maintenance', section: 'Industrial & Mining' },
  { code: 'IND-TOOLS', name: 'Tools, Hardware & Steel Fabrication', section: 'Industrial & Mining' },

  // Legal & Compliance
  { code: 'LEGAL-SERV', name: 'Legal Services', section: 'Legal & Compliance' },
  { code: 'LEGAL-CUSTOM', name: 'Customs Clearance & Import/Export Services', section: 'Legal & Compliance' },
  { code: 'LEGAL-AUDIT', name: 'Standards Development & Testing', section: 'Legal & Compliance' },
  { code: 'LEGAL-FORENSIC', name: 'Forensic & Ballistic Services', section: 'Legal & Compliance' },

  // Logistics & Warehousing
  { code: 'LOG-STORE', name: 'Storage & Warehousing', section: 'Logistics & Warehousing' },
  { code: 'LOG-COURIER', name: 'Courier & Removal Services', section: 'Logistics & Warehousing' },
  { code: 'LOG-ARCHIVE', name: 'Custodial & Archiving Services', section: 'Logistics & Warehousing' },
  { code: 'LOG-PACK', name: 'Packaging Materials & Related Products', section: 'Logistics & Warehousing' },

  // Maintenance & Repairs
  { code: 'MAINT-LV', name: 'Light Motor Vehicle Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-HV', name: 'Heavy Vehicle Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-AC', name: 'Air Conditioner & Refrigeration Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-LIFT', name: 'Lifts & Elevator Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-FIRE', name: 'Fire Fighting Equipment Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-GARAGE', name: 'Garage Equipment Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-CATER', name: 'Catering Equipment Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-SEW', name: 'Sewing Machine Maintenance', section: 'Maintenance & Repairs' },
  { code: 'MAINT-LOCK', name: 'Locksmith & Key Cutting Services', section: 'Maintenance & Repairs' },
  { code: 'MAINT-ROAD', name: 'Road Maintenance Services', section: 'Maintenance & Repairs' },
  { code: 'MAINT-BIKE', name: 'Bicycle Maintenance & Repair', section: 'Maintenance & Repairs' },
  { code: 'MAINT-DIVE', name: 'Diving Equipment Maintenance & Repair', section: 'Maintenance & Repairs' },

  // Marketing & Media
  { code: 'MKT-ADV', name: 'Marketing & Advertising Services', section: 'Marketing & Media' },
  { code: 'MKT-SIGN', name: 'Signage & Branding Services', section: 'Marketing & Media' },
  { code: 'MKT-PRINT', name: 'Printing Services', section: 'Marketing & Media' },
  { code: 'MKT-MEDIA', name: 'Media Production (Filming & Photography)', section: 'Marketing & Media' },
  { code: 'MKT-EVENT', name: 'Event Management & Venue Hire', section: 'Marketing & Media' },
  { code: 'MKT-ENTERTAIN', name: 'Entertainment (Bands, DJs, MCs)', section: 'Marketing & Media' },
  { code: 'MKT-GIFT', name: 'Corporate Gifts & Promotional Items', section: 'Marketing & Media' },
  { code: 'MKT-ART', name: 'Creative Art & Design', section: 'Marketing & Media' },

  // Office & Administration
  { code: 'OFF-STAT', name: 'Stationery, Paper & Office Supplies', section: 'Office & Administration' },
  { code: 'OFF-FURN', name: 'Furniture, Office Equipment & Fittings', section: 'Office & Administration' },
  { code: 'OFF-CLEAN', name: 'Office & Building Cleaning Services', section: 'Office & Administration' },
  { code: 'OFF-APPLI', name: 'Home & Office Appliances', section: 'Office & Administration' },
  { code: 'OFF-PART', name: 'Partitioning & Shop Fittings', section: 'Office & Administration' },
  { code: 'OFF-AC', name: 'Air Conditioners & Refrigerators Supply', section: 'Office & Administration' },
  { code: 'OFF-AUDIT', name: 'Auctioneering Services', section: 'Office & Administration' },

  // Property & Real Estate
  { code: 'PROP-DEV', name: 'Property Development', section: 'Property & Real Estate' },
  { code: 'PROP-EVAL', name: 'Property Evaluation & Estate Agency', section: 'Property & Real Estate' },
  { code: 'PROP-LANDSCAPE', name: 'Landscaping, Gardening & Florist Services', section: 'Property & Real Estate' },

  // Safety & Security
  { code: 'SEC-GUARD', name: 'Private Security Guards & CIT Services', section: 'Safety & Security' },
  { code: 'SEC-EQUIP', name: 'CCTVs, Alarms, Drones & Access Control Equipment', section: 'Safety & Security' },
  { code: 'SEC-MAINT', name: 'Safety & Access Control Systems Maintenance', section: 'Safety & Security' },
  { code: 'SEC-FIRE-EQ', name: 'Fire Fighting Equipment Supply', section: 'Safety & Security' },
  { code: 'SEC-HAZARD', name: 'Hazard Warning Equipment', section: 'Safety & Security' },
  { code: 'SEC-PROTECT', name: 'Protective Clothing & Safety Gear', section: 'Safety & Security' },
  { code: 'SEC-SAFARI', name: 'Safari & Wildlife Activities', section: 'Safety & Security' },

  // Textiles & Uniforms
  { code: 'TEX-UNIFORM', name: 'Uniforms & Textile Materials', section: 'Textiles & Uniforms' },
  { code: 'TEX-CORP', name: 'Corporate Wear & Branded Clothing', section: 'Textiles & Uniforms' },
  { code: 'TEX-TAILOR', name: 'Tailoring Services (Cut, Make & Trim)', section: 'Textiles & Uniforms' },
  { code: 'TEX-SPORTS', name: 'Sports Wear & Equipment', section: 'Textiles & Uniforms' },
  { code: 'TEX-BEDDING', name: 'Bedding, Blankets & Linen', section: 'Textiles & Uniforms' },
  { code: 'TEX-CANVAS', name: 'Canvas, Tarpaulins & Outdoor Fabrics', section: 'Textiles & Uniforms' },
  { code: 'TEX-LEATHER', name: 'Leather, Saddlery & Tanning Products', section: 'Textiles & Uniforms' },
  { code: 'TEX-DRY', name: 'Dry Cleaning Services', section: 'Textiles & Uniforms' },
  { code: 'TEX-ORDNANCE', name: 'Badges, Lanyards, Name Tags & Accoutrements', section: 'Textiles & Uniforms' },

  // Utilities & Water
  { code: 'UTIL-WATER', name: 'Water & Sewer Engineering and Utilities', section: 'Utilities & Water' },
  { code: 'UTIL-BOREHOLE', name: 'Borehole Drilling Equipment & Accessories', section: 'Utilities & Water' },
  { code: 'UTIL-BULK', name: 'Bulk Water Supply', section: 'Utilities & Water' },
  { code: 'UTIL-WEIGH', name: 'Weighbridges & Scales', section: 'Utilities & Water' },

  // Veterinary & Livestock
  { code: 'VET-DRUG', name: 'Veterinary Drugs, Vaccines & Chemicals', section: 'Veterinary & Livestock' },
  { code: 'VET-LIVE', name: 'Livestock & Poultry', section: 'Veterinary & Livestock' },
  { code: 'VET-PET', name: 'Pet Food, Accessories & Training', section: 'Veterinary & Livestock' },
  { code: 'VET-FISH', name: 'Fishing Equipment & Accessories', section: 'Veterinary & Livestock' },
  { code: 'VET-BEE', name: 'Bee Hive Equipment & Accessories', section: 'Veterinary & Livestock' }
]);

const CODE_TO_CATEGORY: Readonly<Record<string, SupplierCategory>> = Object.freeze(
  SUPPLIER_CATEGORY_LIST.reduce((acc, cat) => {
    acc[cat.code] = cat;
    return acc;
  }, {} as Record<string, SupplierCategory>)
);

/** Ordered list of unique section names. */
export const SUPPLIER_CATEGORY_SECTIONS: readonly string[] = Object.freeze(
  SUPPLIER_CATEGORY_LIST.reduce((acc, cat) => {
    if (!acc.includes(cat.section)) acc.push(cat.section);
    return acc;
  }, [] as string[])
);

/** All valid category codes. */
export const SUPPLIER_CATEGORY_CODES: readonly string[] = Object.freeze(
  SUPPLIER_CATEGORY_LIST.map((c) => c.code)
);

export interface SupplierCategoryGroup {
  section: string;
  options: { value: string; label: string }[];
}

/** Categories grouped by section, ready for grouped <optgroup> selects. */
export const SUPPLIER_CATEGORY_GROUPS: readonly SupplierCategoryGroup[] = Object.freeze(
  SUPPLIER_CATEGORY_SECTIONS.map((section) => ({
    section,
    options: SUPPLIER_CATEGORY_LIST.filter((c) => c.section === section).map((c) => ({
      value: c.code,
      label: c.name
    }))
  }))
);

export function isValidCategoryCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(CODE_TO_CATEGORY, code);
}

export function getCategoryByCode(code: string): SupplierCategory | undefined {
  return CODE_TO_CATEGORY[code];
}

/** Returns the human-readable name for a code, falling back to the raw value. */
export function getCategoryName(code: string): string {
  return CODE_TO_CATEGORY[code]?.name ?? code;
}
