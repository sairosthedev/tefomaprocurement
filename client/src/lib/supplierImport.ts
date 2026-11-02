import * as XLSX from 'xlsx';

/**
 * Parsing for the supplier bulk import.
 *
 * Everything is parsed in the browser and posted to /suppliers/bulk-import as
 * ordinary JSON rows. That keeps one server endpoint, needs no upload
 * middleware, and means the user sees and can correct the rows before anything
 * is written — which matters most for formats where extraction is a guess.
 */

export interface SupplierImportRow {
  companyName: string;
  tradingAs: string;
  registrationNumber: string;
  taxNumber: string;
  vatNumber: string;
  contactPerson: string;
  email: string;
  phone: string;
  physicalAddress: string;
  city: string;
  province: string;
  postalCode: string;
  categories: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
}

export const EMPTY_ROW: SupplierImportRow = {
  companyName: '', tradingAs: '', registrationNumber: '', taxNumber: '',
  vatNumber: '', contactPerson: '', email: '', phone: '', physicalAddress: '',
  city: '', province: '', postalCode: '', categories: '', bankName: '',
  bankAccountName: '', bankAccountNumber: '', bankBranchCode: ''
};

/** Fields the server rejects a row for when missing. */
export const REQUIRED_FIELDS: (keyof SupplierImportRow)[] = [
  'companyName',
  'registrationNumber',
  'contactPerson',
  'email',
  'phone'
];

/** Header spellings seen in real exports, normalised to our field names. */
const HEADER_ALIASES: Record<string, keyof SupplierImportRow> = {
  companyname: 'companyName', company: 'companyName', suppliername: 'companyName',
  name: 'companyName', supplier: 'companyName',
  tradingas: 'tradingAs', trading: 'tradingAs', tradingname: 'tradingAs',
  registrationnumber: 'registrationNumber', regnumber: 'registrationNumber',
  registration: 'registrationNumber', regno: 'registrationNumber', companyreg: 'registrationNumber',
  taxnumber: 'taxNumber', tax: 'taxNumber', tin: 'taxNumber',
  vatnumber: 'vatNumber', vat: 'vatNumber',
  contactperson: 'contactPerson', contact: 'contactPerson', contactname: 'contactPerson',
  email: 'email', emailaddress: 'email', contactemail: 'email',
  phone: 'phone', phonenumber: 'phone', telephone: 'phone', tel: 'phone',
  mobile: 'phone', cell: 'phone', contactnumber: 'phone',
  address: 'physicalAddress', physicaladdress: 'physicalAddress', street: 'physicalAddress',
  city: 'city', town: 'city',
  province: 'province', state: 'province',
  postalcode: 'postalCode', postcode: 'postalCode', zip: 'postalCode',
  categories: 'categories', category: 'categories', trade: 'categories',
  bankname: 'bankName', bank: 'bankName',
  accountname: 'bankAccountName', bankaccountname: 'bankAccountName',
  accountnumber: 'bankAccountNumber', bankaccountnumber: 'bankAccountNumber',
  branchcode: 'bankBranchCode', branch: 'bankBranchCode', sortcode: 'bankBranchCode'
};

const normaliseHeader = (h: string): string =>
  String(h || '').trim().toLowerCase().replace(/[\s_\-./]+/g, '');

/** Map an arbitrary object keyed by sheet headers onto our row shape. */
export function mapRow(raw: Record<string, any>): SupplierImportRow {
  const row: SupplierImportRow = { ...EMPTY_ROW };
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_ALIASES[normaliseHeader(key)];
    if (field) row[field] = String(value ?? '').trim();
  }
  return row;
}

/**
 * Split a CSV line on commas outside double quotes, so a quoted company name
 * ("Smith, Jones & Co") or a multi-category cell ("MAINT-LV,IND-TOOLS") does
 * not shift every following column.
 */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** Parse pasted text: a JSON array, or CSV with a header line. */
export function parsePastedText(text: string): SupplierImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((r) => mapRow(r));
  } catch {
    // Not JSON — treat as CSV.
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => { raw[h] = values[i] ?? ''; });
    return mapRow(raw);
  });
}

/** Parse .csv, .xlsx or .xls — all read through the same sheet reader. */
export async function parseSpreadsheet(file: File): Promise<SupplierImportRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  return rawRows.map(mapRow);
}

// ---------------------------------------------------------------------------
// Legacy Postgres dump (the old Django ERP export)
// ---------------------------------------------------------------------------

type CopyRow = Record<string, string | null>;

function unescapeCopyValue(raw: string): string | null {
  if (raw === '\\N') return null;
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\' && i + 1 < raw.length) {
      const n = raw[++i];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === '\\') out += '\\';
      else out += n;
    } else {
      out += c;
    }
  }
  return out;
}

/** Read the COPY blocks for the given tables out of a pg_dump SQL file. */
function parseCopyBlocks(text: string, tables: string[]): Map<string, CopyRow[]> {
  const wanted = new Set(tables);
  const result = new Map<string, CopyRow[]>();
  let currentTable: string | null = null;
  let columns: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (currentTable === null) {
      const m = line.match(/^COPY public\.("?)([A-Za-z0-9_]+)\1 \(([^)]+)\) FROM stdin;$/);
      if (m && wanted.has(m[2])) {
        currentTable = m[2];
        columns = m[3].split(',').map((c) => c.trim().replace(/"/g, ''));
        if (!result.has(currentTable)) result.set(currentTable, []);
      }
    } else if (line === '\\.') {
      currentTable = null;
    } else {
      const fields = line.split('\t');
      const row: CopyRow = {};
      columns.forEach((col, i) => {
        row[col] = fields[i] === undefined ? null : unescapeCopyValue(fields[i]);
      });
      result.get(currentTable)!.push(row);
    }
  }
  return result;
}

const clean = (v: string | null | undefined): string => {
  if (v == null) return '';
  const t = String(v).trim();
  if (!t || /^n\s*[\\/]?\s*a$/i.test(t) || t === '-') return '';
  return t;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A value that reads as a person's name rather than a phone number. */
function looksLikeName(v: string): boolean {
  return !!v && /[a-zA-Z]{2,}/.test(v) && !/^[+\d\s()-]+$/.test(v);
}

/**
 * Extract supplier rows from a legacy Postgres dump (the old Django ERP).
 *
 * Column names are taken from the real dump, not guessed: the company is
 * `full_registered_company_name`, there is no registration-number column so
 * the supplier `code` stands in for it, and contact details live in child
 * tables keyed by `supplier_id`. Categories are an id reference into
 * `procurement_category`, whose names are the same free-text values the
 * server-side migration map already translates into canonical codes.
 *
 * This covers SUPPLIERS ONLY. The CLI importer
 * (api/src/scripts/import-droplet-dump.ts) also brings across sites,
 * departments, directors and trade references, and remains the right tool for
 * a full migration — this exists so a dump can be dropped into the same
 * review-and-confirm flow as a spreadsheet.
 */
export function parseLegacyDump(text: string): SupplierImportRow[] {
  const tables = parseCopyBlocks(text, [
    'procurement_supplier',
    'procurement_email',
    'procurement_phonenumber',
    'procurement_address',
    'procurement_category'
  ]);

  const suppliers = tables.get('procurement_supplier') ?? [];
  if (suppliers.length === 0) return [];

  const categories = new Map<string, string>();
  for (const row of tables.get('procurement_category') ?? []) {
    const id = clean(row.id);
    const name = clean(row.name);
    if (id && name) categories.set(id, name);
  }

  /** Group child-table rows by their supplier_id. */
  const bySupplier = (rows: CopyRow[] | undefined): Map<string, CopyRow[]> => {
    const m = new Map<string, CopyRow[]>();
    for (const r of rows ?? []) {
      const sid = clean(r.supplier_id);
      if (!sid) continue;
      if (!m.has(sid)) m.set(sid, []);
      m.get(sid)!.push(r);
    }
    return m;
  };

  const emails = bySupplier(tables.get('procurement_email'));
  const phones = bySupplier(tables.get('procurement_phonenumber'));
  const addresses = bySupplier(tables.get('procurement_address'));

  return suppliers.map((s) => {
    const sid = clean(s.id);
    const companyName = clean(s.full_registered_company_name) || clean(s.trading_names);

    const email = (emails.get(sid) ?? [])
      .map((e) => clean(e.email_address).toLowerCase())
      .find((e) => EMAIL_RE.test(e)) ?? '';
    const phone = (phones.get(sid) ?? [])
      .map((p) => clean(p.number))
      .find(Boolean) ?? '';
    const addr = (addresses.get(sid) ?? [])[0];

    // `initial_point_of_contact` holds a name for some suppliers and a phone
    // number for others; fall back to the company name when it is not a name.
    const contact = clean(s.initial_point_of_contact);

    return {
      ...EMPTY_ROW,
      companyName,
      tradingAs: clean(s.trading_names),
      // The legacy system has no registration number; `code` is its identifier.
      registrationNumber: clean(s.code),
      contactPerson: looksLikeName(contact) ? contact : companyName,
      email,
      // A phone is required on import; fall back to the contact field when it
      // holds a number rather than a name.
      phone: phone || (!looksLikeName(contact) ? contact : ''),
      physicalAddress: addr ? clean(addr.street_address) : '',
      city: addr ? clean(addr.town_city) : '',
      categories: categories.get(clean(s.category_id)) ?? '',
      bankName: clean(s.principal_bankers),
      bankAccountName: clean(s.bank_account_name),
      bankAccountNumber: clean(s.bank_account_number)
    };
  });
}

/** Dispatch on file extension. Returns rows plus any user-facing warning. */
export async function parseSupplierFile(
  file: File
): Promise<{ rows: SupplierImportRow[]; warning?: string }> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    return {
      rows: [],
      warning:
        'PDF files cannot be read directly yet. Save the supplier list as CSV or Excel, or copy the text and paste it into the box below.'
    };
  }

  if (name.endsWith('.sql') || name.endsWith('.dump')) {
    const text = await file.text();
    const rows = parseLegacyDump(text);
    return {
      rows,
      warning: rows.length
        ? 'Legacy dump: suppliers only. Sites and departments need the command-line importer.'
        : 'No supplier tables found in this dump. It may be a binary .dump — export it as plain SQL first.'
    };
  }

  if (name.endsWith('.json')) {
    const text = await file.text();
    return { rows: parsePastedText(text) };
  }

  if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return { rows: await parseSpreadsheet(file) };
  }

  return { rows: [], warning: `Unsupported file type. Use .csv, .xlsx, .xls, .json or .sql.` };
}

/** Fields missing from a row, for the review grid. */
export function rowIssues(row: SupplierImportRow): string[] {
  return REQUIRED_FIELDS.filter((f) => !String(row[f] || '').trim());
}
