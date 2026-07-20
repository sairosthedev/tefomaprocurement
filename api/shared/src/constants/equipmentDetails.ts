/**
 * Equipment identification fields for requisition lines.
 *
 * Civil-works and plant-maintenance requisitions ("I need a water pump for
 * the JCB") cannot be quoted from a description alone — suppliers need the
 * machine's identity to look the part up in a parts catalogue. Office-supply
 * requisitions ("2 boxes of A4 paper") need none of it.
 *
 * So these fields are OPTIONAL everywhere and merely *suggested* for the
 * categories below. Nothing is ever comma-separated: each value has its own
 * field, so it stays searchable and can be shown to suppliers as a labelled row.
 */

export interface EquipmentField {
  /** Key on the requisition/RFQ line's `equipment` object. */
  key: string;
  label: string;
  placeholder: string;
  /** Short hint shown under the input for staff who are unsure. */
  help?: string;
}

/**
 * The identifiers a workshop quotes when ordering plant/vehicle spares.
 * Ordered most- to least-commonly known by the requester.
 */
export const EQUIPMENT_FIELDS: readonly EquipmentField[] = Object.freeze([
  {
    key: 'make',
    label: 'Make',
    placeholder: 'e.g. Caterpillar, JCB, Iveco',
    help: 'Manufacturer of the machine or vehicle'
  },
  {
    key: 'model',
    label: 'Model',
    placeholder: 'e.g. 320D, 3CX, TGS 33.400',
    help: 'Model as shown on the data plate'
  },
  {
    key: 'plantNumber',
    label: 'Plant / fleet number',
    placeholder: 'e.g. PL-014',
    help: 'Your internal number for this machine'
  },
  {
    key: 'registrationNumber',
    label: 'Registration number',
    placeholder: 'e.g. AEB 1234',
    help: 'For road-going vehicles'
  },
  {
    key: 'chassisNumber',
    label: 'Chassis / VIN number',
    placeholder: 'e.g. JCB3CX4TXK2345678',
    help: 'Road vehicles — trucks, tippers, bowsers, LDVs'
  },
  {
    key: 'engineNumber',
    label: 'Engine number',
    placeholder: 'e.g. 4TNV98-1234567',
    help: 'Needed for engine and fuel-system parts'
  },
  {
    key: 'serialNumber',
    label: 'Machine serial / PIN',
    placeholder: 'e.g. CAT0320DKPAB01234',
    help: 'Plant serial or PIN from the data plate — the most reliable identifier'
  },
  {
    key: 'componentSerial',
    label: 'Component serial',
    placeholder: 'e.g. transmission / pump serial',
    help: 'For major assemblies that carry their own plate'
  },
  {
    key: 'partNumber',
    label: 'Part number (OEM)',
    placeholder: 'e.g. 320/04133',
    help: 'If you already know the manufacturer part number'
  },
  {
    key: 'hourMeter',
    label: 'Hours / odometer',
    placeholder: 'e.g. 7 450 hrs',
    help: 'Current reading — some parts differ by service interval'
  }
]);

export const EQUIPMENT_FIELD_KEYS: readonly string[] = Object.freeze(
  EQUIPMENT_FIELDS.map((f) => f.key)
);

/**
 * Category codes whose lines are usually for plant, vehicles or machinery.
 * Used only to decide whether to OPEN the equipment panel by default — staff
 * can always open it manually on any line.
 */
export const EQUIPMENT_CATEGORY_CODES: readonly string[] = Object.freeze([
  'AUTO-NEW-LV', 'AUTO-NEW-HV', 'AUTO-NEW-MC', 'AUTO-USED', 'AUTO-SPARE',
  'AUTO-BODY', 'AUTO-PANEL', 'AUTO-TYRE',
  'IND-MINE', 'IND-PLANT', 'IND-USED-PLANT', 'IND-MAINT',
  'IND-LOCO', 'IND-LOCO-MAINT',
  'AG-EQUIP', 'AG-HIRE', 'AG-IRRIG',
  'BUILD-MECH', 'BUILD-BOREHOLE',
  'ELEC-BIOGAS',
  'MED-EQUIP', 'MED-MAINT'
]);

/** True when a line's category usually needs machine identification. */
export function categoryNeedsEquipmentDetails(categoryCode?: string): boolean {
  if (!categoryCode) return false;
  return EQUIPMENT_CATEGORY_CODES.includes(categoryCode);
}

/** True when any equipment field on a line carries a value. */
export function hasEquipmentDetails(equipment?: Record<string, any> | null): boolean {
  if (!equipment) return false;
  return EQUIPMENT_FIELD_KEYS.some((k) => String(equipment[k] ?? '').trim().length > 0);
}

/** Labelled, non-empty equipment values — for detail views, RFQs and PDFs. */
export function listEquipmentDetails(
  equipment?: Record<string, any> | null
): { label: string; value: string }[] {
  if (!equipment) return [];
  return EQUIPMENT_FIELDS
    .map((f) => ({ label: f.label, value: String(equipment[f.key] ?? '').trim() }))
    .filter((entry) => entry.value.length > 0);
}

/* ── Attachments (data plate photos etc.) ─────────────────────────────── */

/** Why a photo was attached to a requisition line. */
export const ATTACHMENT_KINDS = Object.freeze({
  DATA_PLATE: 'data_plate',
  ITEM_PHOTO: 'item_photo',
  DAMAGE: 'damage',
  OTHER: 'other'
} as const);

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[keyof typeof ATTACHMENT_KINDS];

export const ATTACHMENT_KIND_OPTIONS: readonly { value: AttachmentKind; label: string }[] =
  Object.freeze([
    { value: 'data_plate', label: 'Data plate / serial plate' },
    { value: 'item_photo', label: 'Photo of the item or part' },
    { value: 'damage', label: 'Photo of the fault or damage' },
    { value: 'other', label: 'Other supporting photo' }
  ]);

export function isValidAttachmentKind(kind: string): boolean {
  return Object.values(ATTACHMENT_KINDS).includes(kind as AttachmentKind);
}

/** Per-image ceiling. Images are stored inline as data URIs, like KYS docs. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_LINE = 4;

export const ALLOWED_ATTACHMENT_MIME_TYPES: readonly string[] = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf'
]);
