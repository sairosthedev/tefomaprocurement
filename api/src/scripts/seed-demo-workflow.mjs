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

/**
 * What a unit's work-in-progress looks like, per business profile.
 *
 * Dokuma buys ICT; Fossil is the group's contracting arm and buys materials,
 * plant and PPE. Driving both from one hardcoded ICT script left Fossil with
 * requisitions for laptops, invited from suppliers that do not exist in it.
 *
 * The `bidders` all share one supplier category on purpose, so the RFQ is a
 * genuine three-way contest that category auto-invitation would have found by
 * itself. Their price factors and delivery periods differ so the response
 * ranking has something real to resolve: in the construction profile the
 * cheapest bid is also much the slowest, so the winner on weighted score is
 * neither the cheapest nor the dearest, and the recommendation has to state
 * the trade-off.
 */
const PROFILES = {
  ict: {
    reqCategory: 'ICT-HW',
    reqCategoryName: 'ICT Hardware',
    bidders: [
      { slug: 'techzone', match: 'TechZone', factor: 1.0, deliveryPeriod: 14 },
      { slug: 'codebridge', match: 'CodeBridge', factor: 1.032, deliveryPeriod: 14 },
      { slug: 'profix', match: 'ProFix', factor: 1.073, deliveryPeriod: 14 },
    ],
    scenarios: [
      { title: 'Laptops for ICT', qty: 4, price: 980, stopAt: 'draft' },
      { title: 'Monitors for Operations', qty: 6, price: 185, stopAt: 'awaiting-hod', requester: 'requester2', head: 'opshead' },
      { title: 'Safety boots', qty: 20, price: 46, stopAt: 'awaiting-stores' },
      { title: 'Printer toner', qty: 12, price: 95, stopAt: 'awaiting-procurement' },
      { title: 'Network switches', qty: 3, price: 310, source: 'rfq-open' },
      { title: 'Workstations', qty: 8, price: 650, source: 'awaiting-award' },
      { title: 'Servers', qty: 10, price: 700, source: 'awaiting-finance' },
      { title: 'Tool kits', qty: 9, price: 700, source: 'awaiting-coo' },
    ],
  },

  construction: {
    reqCategory: 'BUILD-MAT',
    reqCategoryName: 'Construction Materials & Aggregates',
    bidders: [
      { slug: 'mutarequarry', match: 'Mutare Quarry', factor: 1.0, deliveryPeriod: 28 },
      { slug: 'hunyanisand', match: 'Hunyani Sand', factor: 1.03, deliveryPeriod: 7 },
      { slug: 'zimcement', match: 'Zimbabwe Cement', factor: 1.12, deliveryPeriod: 14 },
    ],
    scenarios: [
      { title: 'Cement for Borrowdale slab', qty: 200, price: 11, stopAt: 'draft' },
      { title: 'Hydraulic oil for the 140G grader', qty: 8, price: 58, stopAt: 'awaiting-hod', requester: 'requester2', head: 'planthead' },
      { title: 'Safety boots and harnesses for site', qty: 20, price: 46, stopAt: 'awaiting-stores' },
      { title: 'Shutter ply for first-floor formwork', qty: 40, price: 42, stopAt: 'awaiting-procurement' },
      { title: 'River sand and concrete stone', qty: 60, price: 28, source: 'rfq-open' },
      { title: 'Reinforcing bar Y12 for ground beams', qty: 300, price: 9.4, source: 'awaiting-award' },
      { title: 'Ready-mix concrete, 25MPa', qty: 90, price: 86, source: 'awaiting-finance' },
      { title: 'Grader blades and cutting edges', qty: 12, price: 310, source: 'awaiting-coo' },
    ],
  },
};

// Fossil is the contracting arm; everything else buys like an office.
const PROFILE_KEY = SBU === 'FOSSIL' ? 'construction' : 'ict';
const P = PROFILES[PROFILE_KEY];
/** Head who approves a requisition raised by the default requester. */
const DEFAULT_HEAD = PROFILE_KEY === 'construction' ? 'projhead' : 'icthead';

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
async function requisition({ title, qty, price, stopAt, requester = 'requester', head = DEFAULT_HEAD }) {
  const end = await login(requester);
  const created = await call('POST', '/department/requisitions', end, {
    title, workOrder: `WO-${tag}`,
    justification: 'Demo data for testing',
    items: [{ description: title, category: P.reqCategory, quantity: qty, unit: 'Each', estimatedUnitPrice: price }],
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
async function sourcing({ prId, title, qty, price, stopAt }) {
  const buyer = await login('buyer');
  const suppliers = await call('GET', '/procurement/suppliers?status=active&limit=50', buyer);
  const all = suppliers.data?.data || [];

  // Invite the three that will actually quote. Taking the first three the API
  // happens to return invites suppliers nobody then signs in as, and a
  // supplier cannot quote on an RFQ it was not invited to — which produced an
  // RFQ with zero quotes and an award step with nothing to award.
  const chosen = P.bidders
    .map((b) => all.find((x) => (x.companyName || '').includes(b.match)))
    .filter(Boolean);
  if (chosen.length < P.bidders.length) {
    note(`${title} — RFQ`, false,
      `only ${chosen.length} of the ${P.bidders.length} ${PROFILE_KEY} demo suppliers found; run seed:demo first`);
    return;
  }
  const ids = chosen.map((x) => x._id);

  const deadline = new Date(Date.now() + 10 * 86400000).toISOString();
  const rfq = await call('POST', '/procurement/rfqs', buyer, {
    title: `RFQ — ${title}`, purchaseRequisitionId: prId, supplierIds: ids,
    submissionDeadline: deadline, status: 'open',
    items: [{ description: title, quantity: qty, unit: 'Each', categoryName: P.reqCategoryName }],
  });
  const rfqId = rfq.data?.data?._id;
  if (!rfqId) { note(`${title} — RFQ`, false, rfq.data?.message || `HTTP ${rfq.status}`); return; }
  if (stopAt === 'rfq-open') { note(`${title} — RFQ open, suppliers can quote`, true); return; }

  const quotes = [];
  for (const b of P.bidders) {
    const st = await login(b.slug);
    // Quote against what is actually being bought. A single flat base price
    // across every scenario put USD 11 grader blades on an RFQ, which reads as
    // a broken system to whoever is testing it.
    const unitPrice = Math.round(price * b.factor * 100) / 100;
    const q = await call('POST', '/supplier/quotations', st, {
      rfqId, validityPeriod: 30, deliveryPeriod: b.deliveryPeriod,
      paymentTerms: 'Net 30', currency: 'USD',
      items: [{ description: title, quantity: qty, unit: 'Each', unitPrice, totalPrice: unitPrice * qty, vatIncluded: false }],
    });
    if (q.data?.data?._id) quotes.push({ id: q.data.data._id, price: unitPrice });
    else note(`${title} — quote from ${b.slug}`, false, q.data?.message || `HTTP ${q.status}`);
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

console.log(`\nFilling ${SBU} with work in progress, via ${API}`);
console.log(`Profile: ${PROFILE_KEY}\n`);

// A spread across the cycle, so no role logs in to an empty screen. A scenario
// with `source` is taken to 'accepted' and then sourced; one with `stopAt`
// parks at that stage instead.
for (const sc of P.scenarios) {
  const title = `${sc.title} ${tag}`;
  const prId = await requisition({
    title,
    qty: sc.qty,
    price: sc.price,
    stopAt: sc.source ? 'accepted' : sc.stopAt,
    ...(sc.requester ? { requester: sc.requester } : {}),
    ...(sc.head ? { head: sc.head } : {}),
  });
  if (sc.source && prId) {
    await sourcing({ prId, title, qty: sc.qty, price: sc.price, stopAt: sc.source });
  }
}

console.log(`\n${made} item(s) of work in progress created in ${SBU}.`);
console.log('Each role now has something waiting: drafts and approvals for heads, a stock check for');
console.log('stores, an open RFQ for suppliers, an award for procurement, and approvals for finance');
console.log('and the COO.\n');
