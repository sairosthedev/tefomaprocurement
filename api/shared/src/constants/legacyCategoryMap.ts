/**
 * Legacy supplier-category migration map.
 *
 * Supplier `categories` were originally free text typed per supplier. The
 * canonical taxonomy in `supplierCategories.ts` replaced that, but existing
 * data was never migrated: of 633 suppliers holding categories, 622 held only
 * legacy strings, so code-based RFQ auto-matching matched almost nobody.
 *
 * This maps each observed legacy value to one or more canonical codes.
 *
 * DELIBERATE CHOICES
 * ------------------
 * - A legacy value covering several trades maps to SEVERAL codes. Dropping
 *   half the meaning would silently narrow who gets invited.
 * - Misspellings map to intent (FERNITURE -> OFF-FURN), since the intent is
 *   unambiguous and the supplier should not be penalised for a typo.
 * - Genuinely ambiguous values are LEFT UNMAPPED, listed in
 *   `UNMAPPED_LEGACY_CATEGORIES` below. Guessing would place suppliers into
 *   sourcing events they may not be qualified for — the precise failure the
 *   category match exists to prevent. These need a human decision per supplier.
 */

/** Legacy free-text value (upper-cased, trimmed) -> canonical code(s). */
export const LEGACY_CATEGORY_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // --- Vehicles, plant and their parts -------------------------------------
  'VEHICLE REPAIRS AND SPARES': ['MAINT-LV', 'IND-TOOLS'],
  'VEHICLE SPARE PARTS': ['MAINT-LV'],
  'VEHICLE SPARES AND REPAIRS': ['MAINT-LV'],
  'VEHICLE SPARE PARTS AND MAINTENANCE': ['MAINT-LV'],
  'SPARE AND REPAIRS': ['MAINT-LV'],
  'SPARE PARTS': ['MAINT-LV'],
  'SPARES': ['MAINT-LV'],
  'MOTOR VEHICLES , PARTS AND SPARES': ['MAINT-LV'],
  'TOYOTA  VEHICLES AND SPARE PARTS': ['MAINT-LV'],
  'HOWO SPARES AND PARTS': ['MAINT-HV'],
  'VEHICLE MANTAINANCE': ['MAINT-LV'],
  'MECHINACAL & PANEL BEATING SERVICE': ['AUTO-PANEL', 'MAINT-LV'],
  'VEHICLE AND PLANT EQUIPMENT SPARES': ['MAINT-LV', 'IND-MAINT'],
  'VEHICLE AND PLANT REPAIRS AND SPARES': ['MAINT-LV', 'IND-MAINT'],
  'EQUIPMENT AND SPARE PARTS': ['IND-MAINT'],
  'EQUIPMENT PLANT AND VEHICLES': ['IND-PLANT', 'MAINT-LV'],
  'EQUIPMENT PLANT AND SERVICES': ['IND-PLANT', 'IND-MAINT'],
  'SPARES AND MACHINERY': ['IND-MAINT', 'IND-PLANT'],
  'YELLOW MACHINE SPARES': ['IND-MAINT'],
  'YELLOW MACHINE REPAIRS': ['IND-MAINT'],
  'EARTH MOVING EQUIPMENT': ['IND-PLANT'],
  'EARTH MOVING EQUIPMENT AND SPARES': ['IND-PLANT', 'IND-MAINT'],
  'PLANT AND VEHICLE HIRE': ['IND-PLANT', 'AUTO-CARGO'],
  'PLANT HIRE': ['IND-PLANT'],
  'TRANSPORT HIRE SERVICES': ['AUTO-CARGO'],
  'CONTAINER HIRE': ['LOG-STORE'],
  'COMPRESSOR HIRE': ['IND-COMPRESS'],
  'TYRES AND TYRE ACCESSORIES': ['AUTO-TYRE'],
  'FILTERS': ['MAINT-LV'],
  'HYDRAULICS AND PNEUMATICS': ['IND-MAINT'],
  'HYDRAULICS AND DIESEL ENGINE': ['IND-MAINT'],
  'COMPRESSOR,PUMPS AND GENERATOR': ['IND-COMPRESS', 'ELEC-SUPPLY'],
  'GENERATORS': ['ELEC-SUPPLY'],
  'GENERATORS , PARTS AND SERVICE KITS': ['ELEC-SUPPLY'],
  'BD CALIBRATION': ['ICT-CALIB'],
  'CALIBRATION, DIAGOSISS': ['ICT-CALIB'],
  'FUEL PUMPS AND CALIBRATION': ['ICT-CALIB', 'CHEM-FUEL'],
  'VEHICLE TENTS': ['TEX-CANVAS'],
  'BLINDS AND TENTS': ['TEX-CANVAS'],

  // --- Mining and industrial ----------------------------------------------
  'MINING EQUIPMENT AND SUPPLIES': ['IND-MINE'],
  'MINING EQUIPMENT SPARES AND VEHICLE SPARE': ['IND-MINE', 'MAINT-LV'],
  'MINING EQUIPMENT AND VEHICLE SPARES': ['IND-MINE', 'MAINT-LV'],
  'MINING SERVICES': ['IND-MINE'],
  'EXPLOSIVES': ['IND-BLASTING'],
  'PLASTIC SLEEVES AND EXPLOSIVES': ['IND-BLASTING'],
  'EMUSIONS PRODUCTS': ['IND-BLASTING'],
  'ROCK BLASTING , DRILLING AND GEOLOGICAL SURVEY': ['IND-BLASTING', 'CON-SURV'],
  'QUARRY': ['BUILD-MAT'],
  'AGGREGATES': ['BUILD-MAT'],
  'FABRICATION': ['IND-TOOLS'],
  'FUBRICATION SERVICES': ['IND-TOOLS'],
  'CUTTING AND STEEL BENDING': ['IND-TOOLS'],
  'WELDING EQUIPMENT AND CONSUMABLES': ['IND-TOOLS'],
  'STEEL PRODUCTS': ['IND-TOOLS'],
  'STEEL MATERIAL': ['IND-TOOLS'],
  'BOLTS  AND NUTS': ['IND-TOOLS'],
  'BOLTS AND NUTS': ['IND-TOOLS'],
  'CHAINS, ROPES AND CONSUMABLES': ['IND-TOOLS'],
  'LIFTING AND RIGGING EQUIPMENT': ['IND-TOOLS'],
  'HARDWARE': ['IND-TOOLS'],
  'HARDWARE MATERIAL': ['IND-TOOLS'],
  'GALVANISED DOWEL BARS': ['IND-TOOLS'],
  'SURVEY EQUIPMENTS': ['CON-SURV'],
  'LEICA GEOSYSTEMS PRODUCTA': ['CON-SURV'],
  'LAB TEST': ['ICT-INSPECT'],
  'STANDARD BASED MANAGEMENT SYSTEM': ['LEGAL-AUDIT'],

  // --- Building and construction ------------------------------------------
  'CONCRETE PRODUCTS': ['BUILD-MAT'],
  'PRECAST CONCRETE PRODUCTS': ['BUILD-MAT'],
  'READY MIX CONCRETE': ['BUILD-MAT'],
  'CEMENT': ['BUILD-MAT'],
  'PPC SUPPLY': ['BUILD-MAT'],
  'BRICKS': ['BUILD-MAT'],
  'BUILDING MATERIALS': ['BUILD-MAT'],
  'BUIDING MATERIALS': ['BUILD-MAT'],
  'BUILDING SERVICES': ['BUILD-REPAIR'],
  'BOARDROOM CONSTRUCTION': ['BUILD-REPAIR'],
  'WATERPROOFING': ['BUILD-REPAIR'],
  'GROUT AND  DURA GROUT': ['BUILD-MAT'],
  'SHUTTER, GROUTS, CONCRETE STRIPPER': ['BUILD-MAT'],
  'GLASS AND ALUMINIUM': ['BUILD-REPAIR'],
  'WOOD CABINS AND SUPPLIES': ['BUILD-TIMBER'],
  'PAINTING SERVICES': ['BUILD-PAINT'],
  'ROAD MARKINGS & PAINTS': ['CHEM-PAINT', 'MAINT-ROAD'],
  'PLUMBING MATERIALS & SERVICES': ['BUILD-PLUMB'],
  'BOREHOLE DRILLING': ['BUILD-BOREHOLE'],
  'WATER RETICULATION SYSTEM': ['UTIL-WATER'],
  'JOJO TANKS': ['UTIL-WATER'],
  'MOBILE TOILETS': ['ENV-WASTE'],
  'KAYLITES': ['BUILD-MAT'],
  'MICRO LINER': [], // ambiguous — see UNMAPPED
  'PROFILES': [],    // ambiguous — see UNMAPPED
  'ANTISIPHONING': [],

  // --- Electrical and energy ----------------------------------------------
  'ELECTRICAL MATERIALS & SERVICES': ['ELEC-SUPPLY', 'ELEC-MAINT'],
  'ELECTRICAL SERVICES': ['ELEC-MAINT'],
  'ELECTRIACL CABLE AND ACCESSORIES': ['ELEC-SUPPLY'],
  'SOLAR AND ELECTRICAL SERVICES': ['ELEC-SOLAR', 'ELEC-MAINT'],
  'AIR CONDITIONING SALES AND SERVICES': ['OFF-AC', 'MAINT-AC'],
  'AIRCORNS': ['OFF-AC'],
  'GAS SERVICES': ['CHEM-GAS', 'IND-GAS-MAINT'],
  'GAS': ['CHEM-GAS'],

  // --- Fuels, oils, chemicals ---------------------------------------------
  'FUEL AND LUBRICANTS': ['CHEM-FUEL'],
  'FUELS OILS & LUBRICANTS': ['CHEM-FUEL'],
  'OILS AND LUBRICANTS': ['CHEM-LUB'],
  'OILS AND PETROLEUM': ['CHEM-FUEL'],
  'LUBRICANTS': ['CHEM-LUB'],
  'SPARES AND LUBRICANTS': ['CHEM-LUB', 'MAINT-LV'],
  'FILTRATION OF OIL AND OIL RELATED ACCESSORIES': ['CHEM-LUB'],
  'CHEMICALS': ['CHEM-IND'],
  'CHEMICALS AND CLEANING SERVICES': ['CHEM-CLEAN', 'OFF-CLEAN'],
  'CLEANING DETERGENTS': ['CHEM-CLEAN'],
  'DETERGENTS AND HANDY CLEANERS': ['CHEM-CLEAN'],
  'CLEANING AND SANITARY EQUIPMENT & SERVICES': ['CHEM-CLEAN', 'OFF-CLEAN'],

  // --- PPE, textiles, branding --------------------------------------------
  'PPE AND CORPORATE WEAR': ['SEC-PROTECT', 'TEX-CORP'],
  'PPE': ['SEC-PROTECT'],
  'P.P.E': ['SEC-PROTECT'],
  'PROTECTIVE AND COPRPORATE WEAR': ['SEC-PROTECT', 'TEX-CORP'],
  'CORPORATE WEAR': ['TEX-CORP'],
  'BRANDED APPAREL AND BRANDED HEAD REGALIA': ['TEX-CORP', 'MKT-GIFT'],
  'BRANDING, STATIONERY AND IT CONSUMABLES': ['MKT-SIGN', 'OFF-STAT', 'ICT-HW'],
  'PROMOTIONAL MATERIALS': ['MKT-GIFT'],
  'SIGNAGE,MEDIA MARKETING': ['MKT-SIGN', 'MKT-ADV'],
  'ADVERTISING SERVICES': ['MKT-ADV'],
  'ENTERTAINMENT': ['MKT-ENTERTAIN'],
  'MATRESS': ['TEX-BEDDING'],

  // --- ICT ------------------------------------------------------------------
  'ICT AND CONSUMABLES': ['ICT-HW'],
  'ICCT AND ACCESSORIES': ['ICT-HW'],
  'I.T': ['ICT-HW'],
  'COMPUTERS , ACCESSORIES, SOFTWARE AND HARDWARE': ['ICT-HW', 'ICT-SW'],
  'INTERNET SERVICES': ['ICT-TELECOM'],
  'INTERNET SERVICES AND ACCESSORIES': ['ICT-TELECOM'],
  'RADIO SECURITY': ['ICT-RADIO', 'SEC-EQUIP'],

  // --- Office ---------------------------------------------------------------
  'PRINTING AND STATIONERY': ['MKT-PRINT', 'OFF-STAT'],
  'PAPER AND PACKAGING MATERIAL': ['OFF-STAT', 'LOG-PACK'],
  'FURNITURE AND EQUIPMENT': ['OFF-FURN'],
  'FERNITURE': ['OFF-FURN'],

  // --- Safety and security --------------------------------------------------
  'SECURITY SERVICES': ['SEC-GUARD'],
  'SECURITY ACCESSORIES': ['SEC-EQUIP'],
  'FIRE EQUIPMENT AND ACCESSORIES': ['SEC-FIRE-EQ', 'MAINT-FIRE'],
  'FIRE EXTINGUISHERS': ['SEC-FIRE-EQ'],
  'LIFE LINE': ['SEC-PROTECT'],

  // --- Health ---------------------------------------------------------------
  'HEALTH SERVICES': ['MED-SERV'],
  'HEALTHY SERVICES': ['MED-SERV'],
  'MEDICALS': ['MED-SERV'],
  'HEALTH/ HYGIENE': ['MED-SERV', 'CHEM-CLEAN'],
  'HEALTH/HYGIENE': ['MED-SERV', 'CHEM-CLEAN'],

  // --- Food -----------------------------------------------------------------
  'FOOD STUFFS AND GROCERIES': ['FOOD-GROCERY'],
  'ACCOMODATION': ['FOOD-HOTELS'],

  // --- Professional services ------------------------------------------------
  'CONSULTANCY AND SUPPORT': ['CON-MGMT'],
  'ENVIRONMENTAL CONSULTANCY': ['CON-EIA'],
  'LEGAL, INSURANCE AND RISK': ['LEGAL-SERV', 'FIN-INS'],
  'CLEARING AGENCIES': ['LEGAL-CUSTOM'],
  'TRAININGS': ['EDU-TRAIN'],
  'TRAININGS AND SUBSCRIPTIONS': ['EDU-TRAIN'],
  'TRAVEL AGENCIES': ['AUTO-PASS'],
  'AIR TICKETS': ['AUTO-PASS'],

  // --- Ambiguous: intentionally unmapped ------------------------------------
  'SUBCONTRACTOR': [],
  'RENTALS': [],
  'HORTATIVE INVESTMENT..TYRE AND CARPET': []
});

/**
 * Legacy values deliberately left unmapped because the intent cannot be
 * inferred safely. Migration reports these for per-supplier human review
 * rather than guessing a code.
 */
export const UNMAPPED_LEGACY_CATEGORIES: readonly string[] = Object.freeze([
  'SUBCONTRACTOR',
  'RENTALS',
  'PROFILES',
  'MICRO LINER',
  'ANTISIPHONING',
  'HORTATIVE INVESTMENT..TYRE AND CARPET'
]);

/** Normalise a stored value for lookup: trim, collapse spaces, upper-case. */
export function normaliseLegacyCategory(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Canonical codes for a legacy value. Returns an empty array when the value is
 * unknown or deliberately unmapped — callers should treat that as "needs
 * review", never as "no categories".
 */
export function mapLegacyCategory(value: string): string[] {
  const key = normaliseLegacyCategory(value);
  // Tolerate double-space variants recorded in the data (e.g. "BOLTS  AND NUTS").
  const direct = LEGACY_CATEGORY_MAP[key];
  if (direct) return [...direct];
  const collapsed = Object.keys(LEGACY_CATEGORY_MAP).find(
    (k) => k.replace(/\s+/g, ' ') === key
  );
  return collapsed ? [...LEGACY_CATEGORY_MAP[collapsed]] : [];
}
