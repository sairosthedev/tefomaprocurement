/**
 * Import the Fossil Contracting stock-code list into the inventory catalogue.
 *
 * Usage:
 *   node api/src/scripts/import-stock-codes.mjs "<path to .xls>" [--site=<siteId>] [--dry-run]
 *
 * Environment:
 *   API_BASE   default https://tefomaprocurement-api.vercel.app/api
 *   ADMIN_EMAIL / ADMIN_PASSWORD   an account allowed to import inventory
 *
 * Notes
 *  - The sheet is a CODE LIST, not a stock count, so no `quantity` is sent.
 *    Items land at zero on hand; stores enter real balances afterwards.
 *    Existing balances are therefore never overwritten.
 *  - Bin locations are only stored if the API includes the `location` mapping
 *    in inventoryImport.service.ts. Deploy that before running for bins to save.
 *  - Re-running is safe: rows are matched on stock code and updated in place.
 */
import xlsx from 'xlsx';

const API = (process.env.API_BASE || 'https://tefomaprocurement-api.vercel.app/api').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const BATCH = 250;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const siteArg = args.find((a) => a.startsWith('--site='));
const dryRun = args.includes('--dry-run');

if (!file) {
  console.error('Usage: node import-stock-codes.mjs "<file.xls>" [--site=<siteId>] [--dry-run]');
  process.exit(1);
}

/* ── column positions in the exported sheet ── */
const C_CODE = 0, C_DESC = 2, C_UNIT = 9, C_BIN = 11;

const UNIT_MAP = {
  each: 'each', m: 'meter', l: 'litre', kg: 'kg', g: 'kg',
  pair: 'pair', drums: 'each', boxes: 'box', rolls: 'roll', pkts: 'pack'
};

/**
 * Keyword → canonical supplier-category code. FIRST MATCH WINS, so order
 * matters: specific tests precede general ones. In particular filters are
 * classed as spares before any oil/fuel wording can claim them.
 */
const CATEGORY_RULES = [
  [/\btoner|cartridge|printer|laptop|computer|keyboard|\bmouse\b|monitor|router\b/i, 'ICT-HW'],
  [/\bbond paper|typek|stationer|envelope|document wallet|requisition book|\bpen\b|marker|stapler|lever arch/i, 'OFF-STAT'],
  [/\bhard\s*hat|overall|glove|gumboot|safety boot|helmet|goggle|vest|\bppe\b|respirator|ear\s*muff|aprons?\b|approns?\b/i, 'SAF-PPE'],
  [/\bfilter|separator|seperator|element\b/i, 'AUTO-SPARE'],
  [/\btyres?\b|\btubes?\b|\brims?\b|wheel\s*rim/i, 'AUTO-TYRE'],
  [/\bengine oil|hydraulic oil|gear oil|grease\b|lubricant|coolant|antifreeze|degreaser|\bdye\b|brake fluid|paraffin/i, 'CHEM-LUB'],
  [/\bcable|wire|switch|socket|breaker|\bfuse\b|relay|bulb|lamp|light\b|conduit|gland|alternator|starter motor/i, 'ELEC-SUPP'],
  [/\bdozer blade|grader blade|\btips?\b|cutting edge|side cutter|adapter|adopter|retainer/i, 'IND-PLANT'],
  [/\bwelding|electrode|grinder|drill bit|\bdrill\b|spanner|hammer|\btool\b|chisel|hacksaw/i, 'IND-TOOL'],
  [/\bpipe|hdpe|\bpvc\b|hose fitting|elbow|coupling|airline/i, 'BUILD-PIPE'],
  [/\bcement\b|\bsand\b|\bbrick|aggregate|timber|rebar|reinforcing/i, 'BUILD-MAT'],
  [/\bbearing|\bseal\b|gasket|\bbelt\b|\bhose\b|clamp|\bbolt|\bnut\b|washer|spring|brake|clutch|differential|battery|batteries/i, 'AUTO-SPARE']
];

/** Plant and vehicle spares dominate this store, so that is the fallback. */
const DEFAULT_CATEGORY = 'AUTO-SPARE';

const categoryFor = (desc) => {
  for (const [re, code] of CATEGORY_RULES) if (re.test(desc)) return code;
  return DEFAULT_CATEGORY;
};

export function parseWorkbook(path) {
  const wb = xlsx.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

  const items = [];
  for (const r of rows) {
    const code = String(r[C_CODE] || '').trim();
    const desc = String(r[C_DESC] || '').trim();
    if (!code || !desc || code === 'Stock Code') continue;
    // Page headers / footers repeated through the export
    if (/^(Store\s+S\d+|REF:|Exclude items|Fossil|Construction Computer)/i.test(code)) continue;

    items.push({
      code: code.toUpperCase(),
      name: desc,
      description: desc,
      category: categoryFor(desc),
      unit: UNIT_MAP[String(r[C_UNIT] || '').trim().toLowerCase()] || 'each',
      location: String(r[C_BIN] || '').trim() || undefined
    });
  }
  return items;
}

async function call(method, path, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
  return { status: res.status, data };
}

async function main() {
  const items = parseWorkbook(file);
  console.log(`Parsed ${items.length} stock codes from ${file}`);

  const byCat = {};
  for (const i of items) byCat[i.category] = (byCat[i.category] || 0) + 1;
  console.log('Categories:', Object.entries(byCat).sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c}=${n}`).join('  '));
  console.log(`With bin location: ${items.filter((i) => i.location).length}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing sent. First 5 rows:');
    items.slice(0, 5).forEach((i) => console.log(' ', JSON.stringify(i)));
    return;
  }

  if (!EMAIL || !PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD to import.');
    process.exit(1);
  }

  const l = await call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  if (!l.data?.debugOtp) {
    console.error('Login did not return an OTP; cannot authenticate headlessly.');
    process.exit(1);
  }
  const v = await call('POST', '/auth/verify-otp', null, { email: EMAIL, otp: String(l.data.debugOtp) });
  const token = v.data?.token;
  if (!token) { console.error('OTP verification failed'); process.exit(1); }

  const siteId = siteArg ? siteArg.split('=')[1] : undefined;
  let created = 0, updated = 0, failed = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const res = await call('POST', '/stores/inventory/bulk', token, { items: batch, siteId });
    const s = res.data?.summary;
    if (res.status !== 200 || !s) {
      console.error(`Batch ${i / BATCH + 1} FAILED: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      continue;
    }
    created += s.created; updated += s.updated; failed += s.failed;
    console.log(`Batch ${i / BATCH + 1}: +${s.created} created, ${s.updated} updated, ${s.failed} failed`);
    for (const r of (res.data.results || []).filter((x) => x.status === 'failed')) {
      console.log(`   row ${r.row}: ${r.name} — ${r.message}`);
    }
  }

  console.log(`\nDONE. created=${created} updated=${updated} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
