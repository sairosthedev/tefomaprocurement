/**
 * Leave work in progress at every stage of the procurement cycle, so each
 * role has something waiting when a tester signs in.
 *
 * Master data must exist first: `npm run seed:demo -- --sbu <CODE>`.
 *
 * Everything is created by driving the real API as the real roles, not by
 * writing documents straight to the database — a requisition forced into
 * "awaiting approval" without passing through submission is not the same
 * record, and tests against it prove nothing.
 *
 *   node api/src/scripts/seed-demo-workflow.mjs DOKUMA https://api.sourceline.co.zw
 *   node api/src/scripts/seed-demo-workflow.mjs FOSSIL            (defaults to localhost:3001)
 */
const SBU = (process.argv[2] || '').toUpperCase();
const BASE = (process.argv[3] || 'http://localhost:3001').replace(/\/$/, '');
const API = `${BASE}/api`;
const PASSWORD = 'Test@1234';

if (!SBU) {
  console.error('Usage: node seed-demo-workflow.mjs <SBU_CODE> [apiBaseUrl]');
  process.exit(1);
}

const domain = `${SBU.toLowerCase().replace(/_/g, '-')}.test`;
const who = (slug) => `${slug}@${domain}`;
const tag = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');

let made = 0;
const note = (what, ok, detail = '') => {
  if (ok) made += 1;
  console.log(`  ${ok ? '+' : '!'} ${what}${detail ? ' — ' + detail : ''}`);
};

async function call(method, path, token, body) {
  const headers = { Accept: 'application/json', 'X-Sbu-Code': SBU };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { status: res.status, data, ok: res.ok };
}

const tokens = new Map();
async function login(slug) {
  if (tokens.has(slug)) return tokens.get(slug);
  const email = who(slug);
  const l = await call('POST', '/auth/login', null, { email, password: PASSWORD });
  const otp = l.data?.debugOtp;
  if (!otp) throw new Error(`${email}: no verification code returned (${l.data?.message || l.status})`);
  const v = await call('POST', '/auth/verify-otp', null, { email, otp: String(otp) });
  const t = v.data?.token;
  if (!t) throw new Error(`${email}: sign-in failed (${v.data?.message || v.status})`);
  tokens.set(slug, t);
  return t;
}

/** Raise a requisition and walk it as far as `stopAt`. */
async function requisition({ title, qty, price, stopAt, requester = 'requester', head = 'icthead' }) {
  const end = await login(requester);
  const created = await call('POST', '/department/requisitions', end, {
    title, workOrder: `WO-${tag}`,
    justification: 'Demo data for testing',
    items: [{ description: title, category: 'ICT-HW', quantity: qty, unit: 'Each', estimatedUnitPrice: price }],
  });
  const id = created.data?.data?._id;
  if (!id) { note(title, false, created.data?.message || `HTTP ${created.status}`); return null; }
  if (stopAt === 'draft') { note(`${title} — left as a draft`, true); return id; }

  await call('PUT', `/department/requisitions/${id}/submit`, end);
  if (stopAt === 'awaiting-hod') { note(`${title} — awaiting ${head} approval`, true); return id; }

  const hod = await login(head);
  await call('PUT', `/department/requisitions/${id}/approve`, hod, { comments: 'Approved (demo)' });
  if (stopAt === 'awaiting-stores') { note(`${title} — awaiting stores stock check`, true); return id; }

  const stores = await login('stores');
  await call('PUT', `/stores/purchase-requisitions/${id}/forward`, stores, { notes: 'No stock — forward (demo)' });
  if (stopAt === 'awaiting-procurement') { note(`${title} — awaiting procurement acceptance`, true); return id; }

  const buyer = await login('buyer');
  await call('PUT', `/procurement/requisitions/${id}/accept`, buyer, { comments: 'Accepted (demo)' });
  if (stopAt === 'accepted') { note(`${title} — accepted, ready to source`, true); return id; }
  return id;
}

/** Put an RFQ out and collect quotes, optionally awarding and raising a PO. */
async function sourcing({ prId, title, qty, stopAt }) {
  const buyer = await login('buyer');
  const suppliers = await call('GET', '/procurement/suppliers?status=active&limit=50', buyer);
  const all = suppliers.data?.data || [];

  // Invite the three that will actually quote. Taking the first three the API
  // happens to return invites suppliers nobody then signs in as, and a
  // supplier cannot quote on an RFQ it was not invited to — which produced an
  // RFQ with zero quotes and an award step with nothing to award.
  const wanted = ['TechZone', 'CodeBridge', 'ProFix'];
  const chosen = wanted
    .map((name) => all.find((x) => (x.companyName || '').includes(name)))
    .filter(Boolean);
  if (chosen.length < 3) {
    note(`${title} — RFQ`, false,
      `only ${chosen.length} of the three demo suppliers found; run seed:demo first`);
    return;
  }
  const ids = chosen.map((x) => x._id);

  const deadline = new Date(Date.now() + 10 * 86400000).toISOString();
  const rfq = await call('POST', '/procurement/rfqs', buyer, {
    title: `RFQ — ${title}`, purchaseRequisitionId: prId, supplierIds: ids,
    submissionDeadline: deadline, status: 'open',
    items: [{ description: title, quantity: qty, unit: 'Each', categoryName: 'ICT Hardware' }],
  });
  const rfqId = rfq.data?.data?._id;
  if (!rfqId) { note(`${title} — RFQ`, false, rfq.data?.message || `HTTP ${rfq.status}`); return; }
  if (stopAt === 'rfq-open') { note(`${title} — RFQ open, suppliers can quote`, true); return; }

  const quotes = [];
  const slugs = ['techzone', 'codebridge', 'profix'];
  for (let i = 0; i < slugs.length; i++) {
    const st = await login(slugs[i]);
    const unitPrice = [620, 640, 665][i];
    const q = await call('POST', '/supplier/quotations', st, {
      rfqId, validityPeriod: 30, deliveryPeriod: 14, paymentTerms: 'Net 30', currency: 'USD',
      items: [{ description: title, quantity: qty, unit: 'Each', unitPrice, totalPrice: unitPrice * qty, vatIncluded: false }],
    });
    if (q.data?.data?._id) quotes.push({ id: q.data.data._id, price: unitPrice });
    else note(`${title} — quote from ${slugs[i]}`, false, q.data?.message || `HTTP ${q.status}`);
  }
  if (stopAt === 'quotes-in') { note(`${title} — ${quotes.length} quotes received, RFQ still open`, true); return; }

  await call('PUT', `/procurement/rfqs/${rfqId}/close`, buyer, { comments: 'Closed (demo)' });
  if (stopAt === 'awaiting-award') { note(`${title} — ${quotes.length} quotes in, awaiting award`, true); return; }

  if (quotes.length === 0) {
    note(`${title} — award`, false, 'no quotations were accepted, so there is nothing to award');
    return;
  }
  const winner = quotes.sort((a, b) => a.price - b.price)[0];
  const hod = await login('icthead');
  const sel = await call('PUT', `/department/rfqs/${rfqId}/select-quotation`, hod, { quotationId: winner.id, justification: 'Lowest compliant price and acceptable delivery (demo data)' });
  if (!sel.ok) { note(`${title} — select winner`, false, sel.data?.message || `HTTP ${sel.status}`); return; }
  const auth = await call('PUT', `/procurement/rfqs/${rfqId}/authorize-quotation`, buyer, { quotationId: winner.id, comments: 'Authorized (demo)' });
  if (!auth.ok) { note(`${title} — authorize`, false, auth.data?.message || `HTTP ${auth.status}`); return; }
  const acc = await call('PUT', `/procurement/quotations/${winner.id}/accept`, buyer, { comments: 'Accepted (demo)' });
  if (!acc.ok) { note(`${title} — accept quotation`, false, acc.data?.message || `HTTP ${acc.status}`); return; }

  const po = await call('POST', '/procurement/purchase-orders', buyer, {
    quotationId: winner.id,
    expectedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    notes: 'Demo purchase order',
  });
  const poId = po.data?.data?._id;
  const poNo = po.data?.data?.poNumber;
  if (!poId) { note(`${title} — purchase order`, false, po.data?.message || `HTTP ${po.status}`); return; }
  if (stopAt === 'po-draft') { note(`${title} — ${poNo} raised, not yet submitted`, true); return; }

  await call('PUT', `/procurement/purchase-orders/${poId}/submit`, buyer, { comments: 'Submitted (demo)' });
  if (stopAt === 'awaiting-hod-po') { note(`${title} — ${poNo} awaiting department head`, true); return; }

  await call('PUT', `/department/purchase-orders/${poId}/approve`, hod, { comments: 'Approved (demo)' });
  const prochead = await login('prochead');
  await call('PUT', `/department/purchase-orders/${poId}/proc-approve`, prochead, { comments: 'Approved (demo)' });
  if (stopAt === 'awaiting-finance') { note(`${title} — ${poNo} awaiting Finance`, true); return; }

  const finance = await login('finance');
  await call('PUT', `/finance/purchase-orders/${poId}/approve`, finance, { comments: 'Approved (demo)' });
  if (stopAt === 'awaiting-coo') { note(`${title} — ${poNo} awaiting COO (over USD 5,000)`, true); return; }

  const coo = await login('coo');
  await call('PUT', `/coo/purchase-orders/${poId}/approve`, coo, { comments: 'Authorized (demo)' });
  note(`${title} — ${poNo} fully approved, with the supplier`, true);
}

console.log(`\nFilling ${SBU} with work in progress, via ${API}\n`);

// A spread across the cycle, so no role logs in to an empty screen.
const a = await requisition({ title: `Laptops for ICT ${tag}`, qty: 4, price: 980, stopAt: 'draft' });
const b = await requisition({ title: `Monitors for Operations ${tag}`, qty: 6, price: 185, stopAt: 'awaiting-hod', requester: 'requester2', head: 'opshead' });
const c = await requisition({ title: `Safety boots ${tag}`, qty: 20, price: 46, stopAt: 'awaiting-stores' });
const d = await requisition({ title: `Printer toner ${tag}`, qty: 12, price: 95, stopAt: 'awaiting-procurement' });

const e = await requisition({ title: `Network switches ${tag}`, qty: 3, price: 310, stopAt: 'accepted' });
if (e) await sourcing({ prId: e, title: `Network switches ${tag}`, qty: 3, stopAt: 'rfq-open' });

const f = await requisition({ title: `Workstations ${tag}`, qty: 8, price: 650, stopAt: 'accepted' });
if (f) await sourcing({ prId: f, title: `Workstations ${tag}`, qty: 8, stopAt: 'awaiting-award' });

const g = await requisition({ title: `Servers ${tag}`, qty: 10, price: 700, stopAt: 'accepted' });
if (g) await sourcing({ prId: g, title: `Servers ${tag}`, qty: 10, stopAt: 'awaiting-finance' });

const h = await requisition({ title: `Tool kits ${tag}`, qty: 9, price: 700, stopAt: 'accepted' });
if (h) await sourcing({ prId: h, title: `Tool kits ${tag}`, qty: 9, stopAt: 'awaiting-coo' });

console.log(`\n${made} item(s) of work in progress created in ${SBU}.`);
console.log('Each role now has something waiting: drafts and approvals for heads, a stock check for');
console.log('stores, an open RFQ for suppliers, an award for procurement, and approvals for finance');
console.log('and the COO.\n');
