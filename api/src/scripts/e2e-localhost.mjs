/**
 * Exhaustive localhost E2E — supplier onboarding → requisition → PO → delivery → payment.
 * Prerequisites: MongoDB running, `npm run seed:all -w api`, API on :3001
 * Run: npm run e2e:local -w api
 */
const BASE = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '');
const API = `${BASE}/api`;
const PASSWORD = 'Admin@123';

const log = { pass: 0, fail: 0, steps: [] };

function step(name, ok, detail = '') {
  log.steps.push({ name, ok, detail });
  if (ok) log.pass++;
  else log.fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, path, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, ok: res.ok };
}

async function login(email) {
  const l = await api('POST', '/auth/login', null, { email, password: PASSWORD });
  if (l.status !== 200 || !l.data?.requiresOtp) {
    throw new Error(`${email} login failed: ${l.data?.message || l.status}`);
  }
  const otp = l.data.debugOtp;
  if (!otp) throw new Error('OTP_EXPOSE_IN_RESPONSE must be true in api/.env');
  const v = await api('POST', '/auth/verify-otp', null, { email, otp: String(otp) });
  if (v.status !== 200 || !v.data?.token) {
    throw new Error(`${email} OTP failed: ${v.data?.message || v.status}`);
  }
  return v.data.token;
}

async function waitForApi(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function main() {
  console.log(`\n=== Tefoma Procurement — localhost E2E ===`);
  console.log(`Target: ${BASE}\n`);

  if (!(await waitForApi())) {
    console.error('API not reachable. Start with: npm run dev -w api');
    process.exit(1);
  }
  step('API health check', true);

  const ctx = {};

  // ─── PHASE 1: Supplier self-registration & onboarding ───
  console.log('\n--- Phase 1: Supplier onboarding ---');
  const regEmail = `e2e.supplier.${Date.now()}@smoke.test`;
  const reg = await api('POST', '/auth/register', null, {
    email: regEmail,
    password: 'Test@1234',
    firstName: 'E2E',
    lastName: 'Supplier',
    phone: '+263770000999',
    role: 'supplier',
    supplierProfile: {
      companyName: `E2E Supplier ${Date.now()}`,
      tradingName: 'E2E Corp',
      registrationNumber: `E2E-REG-${Date.now()}`,
      categories: ['ICT-HW'],
      address: { street: '1 Test Rd', city: 'Harare', province: 'Harare' },
      bankDetails: {
        bankName: 'Test Bank',
        accountName: 'E2E Supplier',
        accountNumber: '1234567890',
        branchCode: '001',
        accountType: 'current'
      }
    }
  });
  step('Supplier self-registration', reg.status === 201 && reg.data?.token, reg.data?.message);

  const newSupplierToken = reg.data?.token;
  const prof = await api('GET', '/supplier/profile', newSupplierToken);
  step('New supplier views profile', prof.status === 200);
  ctx.newSupplierProfileId = prof.data?.data?._id;

  const procToken = await login('macdonald@fossilzim.com');
  const suppliersList = await api('GET', '/procurement/suppliers?status=pending', procToken);
  const pending = (suppliersList.data?.data || []).find(
    (s) => s.companyName?.includes('E2E Supplier') || s.user?.email === regEmail
  );
  step('Procurement sees pending supplier', !!pending?._id);
  ctx.newSupplierId = pending?._id;

  if (ctx.newSupplierId) {
    const activate = await api('PUT', `/procurement/suppliers/${ctx.newSupplierId}/kys/verify`, procToken, {
      overrideKys: true,
      approveForActivation: true,
      reason: 'E2E test activation'
    });
    step('Procurement activates new supplier (KYS override)', activate.status === 200, activate.data?.message);
  }

  const profileUpdate = await api('PUT', '/supplier/profile', newSupplierToken, {
    phone: '+263770000999',
    website: 'https://example.com'
  });
  step('Supplier updates profile', profileUpdate.status === 200);

  // ─── PHASE 2: Full procurement hierarchy ───
  console.log('\n--- Phase 2: Requisition → RFQ → PO → delivery → payment ---');

  const runId = Date.now();
  const endUser = await login('james@fossilzim.com');
  const createPr = await api('POST', '/department/requisitions', endUser, {
    title: `E2E procurement flow ${runId}`,
    workOrder: 'WO-E2E-001',
    justification: 'End-to-end test laptops for ICT',
    items: [
      {
        description: `E2E-only test item ${runId}`,
        category: 'ICT-HW',
        quantity: 10,
        unit: 'Each',
        estimatedUnitPrice: 650
      }
    ]
  });
  step('End user creates requisition (draft)', createPr.status === 201, createPr.data?.message);
  ctx.prId = createPr.data?.data?._id;

  const submitPr = await api('PUT', `/department/requisitions/${ctx.prId}/submit`, endUser);
  step('End user submits requisition', submitPr.status === 200);

  const hodToken = await login('mac@fossilzim.com');
  const hodApprove = await api('PUT', `/department/requisitions/${ctx.prId}/approve`, hodToken, {
    comments: 'Approved for E2E test'
  });
  step('ICT HOD approves requisition', hodApprove.status === 200);

  const storesToken = await login('alfred@fossilzim.com');
  const forward = await api('PUT', `/stores/purchase-requisitions/${ctx.prId}/forward`, storesToken, {
    notes: 'No stock — forward to procurement'
  });
  step('Stores forwards to procurement', forward.status === 200, forward.data?.message);

  const acceptPr = await api('PUT', `/procurement/requisitions/${ctx.prId}/accept`, procToken, {
    comments: 'Accepted for sourcing'
  });
  step('Procurement accepts requisition', acceptPr.status === 200);

  const supplierEmails = ['ict.hw@techzone.co.zw', 'ict.sw@codebridge.co.zw', 'ict.maint@profix.co.zw'];
  const allActive = await api('GET', '/procurement/suppliers?status=active&limit=50', procToken);
  const supplierIds = supplierEmails
    .map((email) => (allActive.data?.data || []).find((s) => s.user?.email === email)?._id)
    .filter(Boolean);
  step('Load 3 active suppliers for RFQ', supplierIds.length >= 3, `count=${supplierIds.length}`);

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const createRfq = await api('POST', '/procurement/rfqs', procToken, {
    title: 'E2E RFQ — laptops',
    purchaseRequisitionId: ctx.prId,
    supplierIds,
    submissionDeadline: deadline,
    status: 'open',
    items: [
      { description: `E2E-only test item ${runId}`, quantity: 10, unit: 'Each', categoryName: 'ICT Hardware' }
    ]
  });
  step('Procurement creates & publishes RFQ', createRfq.status === 201, createRfq.data?.message);
  ctx.rfqId = createRfq.data?.data?._id;

  const quotations = [];
  for (const email of supplierEmails) {
    const st = await login(email);
    const unitPrice = email.includes('hw') ? 620 : email.includes('sw') ? 640 : 660;
    const qty = 10;
    const q = await api('POST', '/supplier/quotations', st, {
      rfqId: ctx.rfqId,
      validityPeriod: 30,
      deliveryPeriod: 14,
      paymentTerms: 'Net 30',
      currency: 'USD',
      items: [
        {
          description: `E2E-only test item ${runId}`,
          quantity: qty,
          unit: 'Each',
          unitPrice,
          totalPrice: unitPrice * qty,
          vatIncluded: false
        }
      ]
    });
    step(`Supplier ${email.split('@')[0]} submits quotation`, q.status === 201, q.data?.message);
    if (q.data?.data?._id) quotations.push({ id: q.data.data._id, email, supplierId: q.data.data.supplier });
  }

  const closeRfq = await api('PUT', `/procurement/rfqs/${ctx.rfqId}/close`, procToken);
  step('Procurement closes RFQ', closeRfq.status === 200);

  const winningQuote = quotations[0];
  if (!winningQuote?.id) {
    step('Quotation workflow (blocked — no quotes submitted)', false, 'fix supplier invites');
    console.log('\n=== E2E Summary ===');
    console.log(`PASS: ${log.pass}  FAIL: ${log.fail}`);
    process.exit(1);
  }

  const hodSelect = await api('PUT', `/department/rfqs/${ctx.rfqId}/select-quotation`, hodToken, {
    quotationId: winningQuote.id,
    justification: 'Best price and delivery terms for ICT department E2E test'
  });
  step('ICT HOD selects winning quotation', hodSelect.status === 200);

  const pmAuth = await api('PUT', `/procurement/rfqs/${ctx.rfqId}/authorize-quotation`, procToken, {
    quotationId: winningQuote.id,
    comments: 'PM authorized for E2E'
  });
  step('Procurement authorizes quotation', pmAuth.status === 200);

  const acceptQ = await api('PUT', `/procurement/quotations/${winningQuote.id}/accept`, procToken, {
    comments: 'Accepted winner'
  });
  step('Procurement accepts quotation', acceptQ.status === 200);

  const createPo = await api('POST', '/procurement/purchase-orders', procToken, {
    quotationId: winningQuote.id,
    expectedDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    notes: 'E2E PO'
  });
  step('Procurement creates PO', createPo.status === 201, createPo.data?.message);
  ctx.poId = createPo.data?.data?._id;
  ctx.poNumber = createPo.data?.data?.poNumber;
  const poTotal = createPo.data?.data?.totalAmount || 0;

  const submitPo = await api('PUT', `/procurement/purchase-orders/${ctx.poId}/submit`, procToken);
  step('Procurement submits PO for approval', submitPo.status === 200);

  const hodPo = await api('PUT', `/department/purchase-orders/${ctx.poId}/approve`, hodToken, {
    comments: 'HOD PO approval E2E'
  });
  step('HOD approves PO', hodPo.status === 200);

  const financeToken = await login('paul@fossilzim.com');
  const finPo = await api('PUT', `/finance/purchase-orders/${ctx.poId}/approve`, financeToken, {
    comments: 'Finance approved E2E'
  });
  step('Finance approves PO', finPo.status === 200);

  if (poTotal >= 5000) {
    const cooToken = await login('tino@fossilzim.com');
    const cooPo = await api('PUT', `/coo/purchase-orders/${ctx.poId}/approve`, cooToken, {
      comments: 'COO approved E2E (≥ USD 5k)'
    });
    step('COO approves high-value PO', cooPo.status === 200, `total=${poTotal}`);
  } else {
    step('COO approval skipped (PO below threshold)', true, `total=${poTotal}`);
  }

  const supplierWinToken = await login(winningQuote.email);
  const ack = await api('PUT', `/supplier/purchase-orders/${ctx.poId}/acknowledge`, supplierWinToken, {
    deliveryNoteNumber: `DN-E2E-${Date.now()}`,
    expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString()
  });
  step('Winning supplier acknowledges PO', ack.status === 200);

  const poDetail = await api('GET', `/procurement/purchase-orders/${ctx.poId}`, procToken);
  const poItems = poDetail.data?.data?.items || [];
  const receive = await api('POST', '/stores/deliveries', storesToken, {
    purchaseOrderId: ctx.poId,
    deliveryNoteNumber: `GRV-E2E-${Date.now()}`,
    deliveryDate: new Date().toISOString(),
    items: poItems.map((item) => ({
      poItem: item._id,
      quantityReceived: item.quantity,
      quantityRejected: 0,
      condition: 'good'
    }))
  });
  step('Stores receives goods (GRV)', receive.status === 201, receive.data?.message);
  ctx.deliveryId = receive.data?.data?._id;
  const deliveryStatus = receive.data?.data?.status;
  if (deliveryStatus === 'accepted') {
    step('Delivery auto-accepted on receive', true);
  } else {
    const acceptDel = await api('PUT', `/stores/deliveries/${ctx.deliveryId}/accept`, storesToken, {
      status: 'accepted',
      notes: 'Accepted into stock — E2E'
    });
    step('Stores accepts delivery into inventory', acceptDel.status === 200);
  }

  const invoice = await api('POST', '/supplier/invoices', supplierWinToken, {
    purchaseOrderId: ctx.poId,
    vendorInvoiceNumber: `INV-E2E-${Date.now()}`,
    invoiceDate: new Date().toISOString(),
    items: poItems.map((item, idx) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      poItemIndex: idx
    })),
    vatAmount: poDetail.data?.data?.vatAmount || 0
  });
  step('Supplier submits invoice', invoice.status === 201, invoice.data?.message);
  ctx.invoiceId = invoice.data?.data?._id;

  const approveInv = await api('PUT', `/finance/invoices/${ctx.invoiceId}/approve`, financeToken, {
    comments: 'E2E invoice approved',
    forceApprove: invoice.data?.data?.status === 'variance'
  });
  step('Finance approves invoice', approveInv.status === 200, approveInv.data?.message);

  const payment = await api('POST', '/finance/payments', financeToken, {
    invoiceIds: [ctx.invoiceId],
    paymentDate: new Date().toISOString(),
    paymentMethod: 'bank_transfer',
    reference: `PAY-E2E-${Date.now()}`,
    complete: true
  });
  step('Finance records payment', payment.status === 201, payment.data?.message);

  // ─── PHASE 3: Extra scenarios ───
  console.log('\n--- Phase 3: Additional user scenarios ---');

  const evalRes = await api('POST', `/procurement/suppliers/${supplierIds[0]}/evaluations`, procToken, {
    evaluationType: 'initial',
    recommendation: 'approve',
    scores: {
      creditTerms: 4,
      contractualAgreements: 4,
      marketReputation: 4,
      pricing: 4,
      deliveryEfficiency: 4,
      easeInDealings: 4,
      consistentQuality: 4,
      otherNotes: 'E2E evaluation'
    }
  });
  step('Procurement records supplier evaluation', evalRes.status === 201, evalRes.data?.message);
  const evalScore = evalRes.data?.data?.overallScore;
  step('Evaluation overall score computed (1–5)', evalScore >= 3.5, `score=${evalScore}`);

  const budgetGet = await api('GET', '/finance/budgets', financeToken);
  step('Finance views budgets', budgetGet.status === 200);

  const adminToken = await login('admin@fossilzim.com');
  const audit = await api('GET', '/admin/audit-logs?limit=5', adminToken);
  step('Admin views audit logs', audit.status === 200);

  const notif = await api('GET', '/notifications', endUser);
  step('End user has notifications', notif.status === 200);

  const cancelDraft = await api('POST', '/department/requisitions', endUser, {
    title: 'Draft to cancel',
    items: [{ description: 'Temp item', category: 'ICT-HW', quantity: 1, unit: 'Each' }]
  });
  const cancelId = cancelDraft.data?.data?._id;
  const cancelRes = await api('PUT', `/department/requisitions/${cancelId}/cancel`, endUser, {
    reasonCode: 'no_longer_required',
    comments: 'E2E cancel test'
  });
  step('End user cancels own draft requisition', cancelRes.status === 200);

  const dash = await api('GET', '/dashboard/stats', procToken);
  step('Procurement dashboard stats', dash.status === 200);

  // ─── Supplier analytics (Performance, Compliance, Evaluations pages) ───
  console.log('\n--- Phase 3b: Supplier analytics ---');

  const reports = await api('GET', '/procurement/supplier-reports?limit=50', procToken);
  const summary = reports.data?.data?.summary;
  const registry = reports.data?.data?.registry || [];
  step('Performance & Compliance API (supplier-reports)', reports.status === 200);
  step('Reports summary has supplier counts', (summary?.totalSuppliers ?? 0) > 0, `total=${summary?.totalSuppliers}`);
  step('Reports summary has KYS metrics', typeof summary?.kysVerified === 'number' && typeof summary?.kysPending === 'number');
  step('Reports summary has score bands', Boolean(summary?.scoreBands));
  step('Registry includes kysPercent per supplier', registry.some((r) => typeof r.kysPercent === 'number'));
  const ratedSupplier = registry.find((r) => String(r._id) === String(supplierIds[0]));
  step('Performance: evaluated supplier has overallScore', (ratedSupplier?.overallScore ?? 0) >= 3.5, `score=${ratedSupplier?.overallScore}`);

  const dueList = await api('GET', '/procurement/evaluations/due', procToken);
  step('Evaluations due API', dueList.status === 200);
  step('Evaluations due returns suppliersDueForReview array', Array.isArray(dueList.data?.data?.suppliersDueForReview));

  const allEvals = await api('GET', '/procurement/evaluations?limit=20', procToken);
  const evalRows = allEvals.data?.data || [];
  step('Evaluations list API (All tab)', allEvals.status === 200);
  step('Evaluations list includes E2E record', evalRows.some((e) => e.overallScore >= 3.5));

  const supplierEvals = await api('GET', `/procurement/suppliers/${supplierIds[0]}/evaluations`, procToken);
  step('Supplier profile evaluations history', supplierEvals.status === 200);

  // ─── Summary ───
  console.log('\n=== E2E Summary ===');
  console.log(`PASS: ${log.pass}  FAIL: ${log.fail}`);
  if (log.fail > 0) {
    console.log('\nFailed steps:');
    log.steps.filter((s) => !s.ok).forEach((s) => console.log(`  - ${s.name}: ${s.detail}`));
    process.exit(1);
  }
  console.log('\nAll E2E steps passed on localhost.');
}

main().catch((err) => {
  console.error('\nE2E crashed:', err.message);
  process.exit(1);
});
